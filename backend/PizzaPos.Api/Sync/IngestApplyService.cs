using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PizzaPos.Api.Data;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Sync;

/// <summary>
/// Materializes outbox events shipped from the kasa into the cloud's actual
/// Order/Customer/etc. tables. Without this, the SyncController.Ingest just
/// stores envelopes in <c>outbox_events</c> — admin panel never sees the rows.
///
/// Each handler is idempotent: re-applying the same event is a no-op (entity
/// existence is checked by the natural key shipped in the payload). Tenant
/// query filters are bypassed because the cloud apply runs outside any HTTP
/// request scope (no JWT → no current store).
/// </summary>
public interface IIngestApplyService
{
    Task<ApplyResult> ApplyAsync(OutboxEvent evt, CancellationToken ct);
}

public record ApplyResult(bool Success, string? Error);

public class IngestApplyService : IIngestApplyService
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly AppDbContext _db;
    private readonly ILogger<IngestApplyService> _logger;

    public IngestApplyService(AppDbContext db, ILogger<IngestApplyService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<ApplyResult> ApplyAsync(OutboxEvent evt, CancellationToken ct)
    {
        try
        {
            using var doc = JsonDocument.Parse(evt.PayloadJson);
            var root = doc.RootElement;
            var data = root.TryGetProperty("data", out var d) ? d : root;
            var storeId = root.TryGetProperty("storeId", out var s) && s.ValueKind == JsonValueKind.String
                ? Guid.Parse(s.GetString()!)
                : Guid.Empty;

            switch (evt.EventType)
            {
                case "OrderCreated":              await ApplyOrderCreatedAsync(data, storeId, ct); break;
                case "OrderItemAdded":            await ApplyOrderItemAddedAsync(data, ct); break;
                case "OrderItemQuantityUpdated":  await ApplyOrderItemQuantityUpdatedAsync(data, ct); break;
                case "OrderItemRemoved":          await ApplyOrderItemRemovedAsync(data, ct); break;
                case "OrderDetailsUpdated":       await ApplyOrderDetailsUpdatedAsync(data, ct); break;
                case "OrderCompleted":            await ApplyOrderCompletedAsync(data, ct); break;
                case "OrderCancelled":            await ApplyOrderCancelledAsync(data, ct); break;
                case "OrderFulfillmentUpdated":   await ApplyOrderFulfillmentUpdatedAsync(data, ct); break;

                case "TableStatusChanged":        await ApplyTableStatusChangedAsync(data, ct); break;

                case "CustomerCreated":           await ApplyCustomerUpsertAsync(data, ct, isCreate: true); break;
                case "CustomerUpdated":           await ApplyCustomerUpsertAsync(data, ct, isCreate: false); break;
                case "CustomerDeleted":           await ApplyCustomerDeletedAsync(data, ct); break;

                case "CustomerAddressAdded":      await ApplyCustomerAddressUpsertAsync(data, ct, isCreate: true); break;
                case "CustomerAddressUpdated":    await ApplyCustomerAddressUpsertAsync(data, ct, isCreate: false); break;
                case "CustomerAddressDeleted":    await ApplyCustomerAddressDeletedAsync(data, ct); break;

                case "IncomingCallReceived":      await ApplyIncomingCallReceivedAsync(data, ct); break;
                case "IncomingCallResolved":      await ApplyIncomingCallResolvedAsync(data, ct); break;
                case "IncomingCallNoteUpdated":   await ApplyIncomingCallNoteUpdatedAsync(data, ct); break;

                default:
                    _logger.LogWarning("IngestApply: unknown event type {EventType} (id={Id})",
                        evt.EventType, evt.Id);
                    return new ApplyResult(false, $"Unknown event type '{evt.EventType}'");
            }

            return new ApplyResult(true, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "IngestApply failed for event {Id} ({EventType})",
                evt.Id, evt.EventType);
            var msg = ex.Message.Length > 1900 ? ex.Message[..1900] : ex.Message;
            return new ApplyResult(false, msg);
        }
    }

    // --- Order handlers -----------------------------------------------------

    private async Task ApplyOrderCreatedAsync(JsonElement data, Guid envelopeStoreId, CancellationToken ct)
    {
        var orderId = data.GetProperty("id").GetGuid();

        // Idempotent: if the order already exists, this is a re-delivery.
        var exists = await _db.Orders.IgnoreQueryFilters()
            .AnyAsync(o => o.Id == orderId, ct);
        if (exists) return;

        // Fall back to envelope storeId when payload omits it (older events).
        var storeId = TryGetGuid(data, "storeId") ?? envelopeStoreId;
        if (storeId == Guid.Empty)
            throw new InvalidOperationException("OrderCreated missing storeId");

        var order = new Order
        {
            Id = orderId,
            StoreId = storeId,
            OrderNumber = data.GetProperty("orderNumber").GetString() ?? "",
            TableId = TryGetGuid(data, "tableId"),
            OrderType = data.TryGetProperty("orderType", out var ot) ? (OrderType)ot.GetInt32() : OrderType.DineIn,
            Status = data.TryGetProperty("status", out var st) ? (OrderStatus)st.GetInt32() : OrderStatus.Active,
            Subtotal = TryGetDecimal(data, "subtotal") ?? 0m,
            DiscountAmount = TryGetDecimal(data, "discountAmount") ?? 0m,
            Total = TryGetDecimal(data, "total") ?? 0m,
            CustomerId = TryGetGuid(data, "customerId"),
            CustomerName = TryGetString(data, "customerName"),
            CustomerPhone = TryGetString(data, "customerPhone"),
            Notes = TryGetString(data, "notes"),
            CreatedByUserId = TryGetGuid(data, "createdByUserId"),
            CreatedAt = TryGetDateTime(data, "createdAt") ?? DateTime.UtcNow,
            DeliveryAddressSnapshot = TryGetString(data, "deliveryAddressSnapshot"),
            DeliveryDistrict = TryGetString(data, "deliveryDistrict"),
            FulfillmentStatus = data.TryGetProperty("fulfillmentStatus", out var fs)
                && fs.ValueKind == JsonValueKind.Number
                ? (FulfillmentStatus)fs.GetInt32() : FulfillmentStatus.Pending,
            AssignedCourierUserId = TryGetGuid(data, "assignedCourierUserId"),
            OutForDeliveryAt = TryGetDateTime(data, "outForDeliveryAt"),
            DeliveredAt = TryGetDateTime(data, "deliveredAt"),
            IncomingCallId = TryGetGuid(data, "incomingCallId"),
        };

        _db.Orders.Add(order);

        if (data.TryGetProperty("items", out var items) && items.ValueKind == JsonValueKind.Array)
        {
            foreach (var i in items.EnumerateArray())
            {
                var productId = i.GetProperty("productId").GetGuid();
                var productName = i.GetProperty("productName").GetString() ?? "";
                var unitPrice = i.GetProperty("unitPrice").GetDecimal();

                // v0.1.22: Kasa SQLite'ında olup cloud Postgres'inde olmayan
                // ürünler için lazy backfill. CLAUDE.md kuralı "Products cloud-only
                // yazılır" der ama pratikte kasa lokalde ürün yaratabiliyor (seed,
                // hızlı test). FK violation'a düşmesin diye snapshot'tan placeholder
                // Product yarat. Cloud admin sonra rename + Category set edebilir.
                await EnsureProductExistsAsync(productId, storeId, productName, unitPrice, ct);

                var item = new OrderItem
                {
                    Id = i.GetProperty("id").GetGuid(),
                    StoreId = storeId,
                    OrderId = orderId,
                    ProductId = productId,
                    ProductName = productName,
                    UnitPrice = unitPrice,
                    Quantity = i.GetProperty("quantity").GetInt32(),
                    LineTotal = i.GetProperty("lineTotal").GetDecimal(),
                    Notes = TryGetString(i, "notes"),
                };
                _db.OrderItems.Add(item);

                if (i.TryGetProperty("options", out var opts) && opts.ValueKind == JsonValueKind.Array)
                {
                    foreach (var o in opts.EnumerateArray())
                    {
                        _db.OrderItemOptions.Add(new OrderItemOption
                        {
                            Id = o.GetProperty("id").GetGuid(),
                            StoreId = storeId,
                            OrderItemId = item.Id,
                            ProductOptionId = TryGetGuid(o, "productOptionId"),
                            GroupName = o.GetProperty("groupName").GetString() ?? "",
                            OptionName = o.GetProperty("optionName").GetString() ?? "",
                            AdditionalPrice = o.GetProperty("additionalPrice").GetDecimal(),
                        });
                    }
                }
            }
        }

        // Reflect the table occupancy state the kasa already moved into.
        if (order.TableId is Guid tableId)
        {
            var table = await _db.Tables.IgnoreQueryFilters()
                .FirstOrDefaultAsync(t => t.Id == tableId, ct);
            if (table is not null && table.Status == TableStatus.Empty)
                table.Status = TableStatus.Occupied;
        }

        await _db.SaveChangesAsync(ct);
    }

    private async Task ApplyOrderItemAddedAsync(JsonElement data, CancellationToken ct)
    {
        var itemId = data.GetProperty("itemId").GetGuid();
        var exists = await _db.OrderItems.IgnoreQueryFilters().AnyAsync(i => i.Id == itemId, ct);
        if (exists) return;

        var orderId = data.GetProperty("orderId").GetGuid();
        var order = await _db.Orders.IgnoreQueryFilters()
            .FirstOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null)
            throw new InvalidOperationException($"OrderItemAdded references missing Order {orderId}");

        var productId = data.GetProperty("productId").GetGuid();
        var productName = data.GetProperty("productName").GetString() ?? "";
        var unitPrice = data.GetProperty("unitPrice").GetDecimal();
        // Same lazy-backfill semantik (bkz. ApplyOrderCreatedAsync).
        await EnsureProductExistsAsync(productId, order.StoreId, productName, unitPrice, ct);

        _db.OrderItems.Add(new OrderItem
        {
            Id = itemId,
            StoreId = order.StoreId,
            OrderId = orderId,
            ProductId = productId,
            ProductName = productName,
            UnitPrice = unitPrice,
            Quantity = data.GetProperty("quantity").GetInt32(),
            LineTotal = data.GetProperty("lineTotal").GetDecimal(),
        });
        await _db.SaveChangesAsync(ct);

        await RecalcOrderTotalsAsync(orderId, ct);
    }

    /// <summary>
    /// Cloud'da olmayan ürünleri snapshot'tan lazy yaratır. CategoryId zorunlu
    /// (Product FK); store'da herhangi bir kategori varsa onunla bağla, yoksa
    /// "(Otomatik)" placeholder kategori yarat. IsAvailable=false ile gizler;
    /// admin /admin/products'ta görüp düzenleyebilir veya silebilir.
    /// </summary>
    private async Task EnsureProductExistsAsync(
        Guid productId, Guid storeId, string productName, decimal unitPrice, CancellationToken ct)
    {
        var exists = await _db.Products.IgnoreQueryFilters()
            .AnyAsync(p => p.Id == productId, ct);
        if (exists) return;

        var categoryId = await _db.Categories.IgnoreQueryFilters()
            .Where(c => c.StoreId == storeId)
            .OrderBy(c => c.DisplayOrder)
            .Select(c => c.Id)
            .FirstOrDefaultAsync(ct);

        if (categoryId == Guid.Empty)
        {
            var placeholderCat = new Category
            {
                Id = Guid.NewGuid(),
                StoreId = storeId,
                Name = "(Otomatik)",
                DisplayOrder = 9999,
                IsActive = true,
            };
            _db.Categories.Add(placeholderCat);
            await _db.SaveChangesAsync(ct);
            categoryId = placeholderCat.Id;
            _logger.LogWarning(
                "Cloud lazy backfill: Store {StoreId} hiç kategori yok, '(Otomatik)' placeholder yaratıldı.",
                storeId);
        }

        _db.Products.Add(new Product
        {
            Id = productId,
            StoreId = storeId,
            CategoryId = categoryId,
            Name = string.IsNullOrWhiteSpace(productName) ? "(Bilinmeyen)" : productName,
            Price = unitPrice,
            IsAvailable = false,
            DisplayOrder = 9999,
        });
        await _db.SaveChangesAsync(ct);

        _logger.LogWarning(
            "Cloud lazy backfill: Product {Id} '{Name}' kasada vardı, cloud'da yoktu — placeholder yaratıldı (IsAvailable=false).",
            productId, productName);
    }

    private async Task ApplyOrderItemQuantityUpdatedAsync(JsonElement data, CancellationToken ct)
    {
        var itemId = data.GetProperty("itemId").GetGuid();
        var quantity = data.GetProperty("quantity").GetInt32();
        var lineTotal = data.GetProperty("lineTotal").GetDecimal();

        var rows = await _db.OrderItems.IgnoreQueryFilters()
            .Where(i => i.Id == itemId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(i => i.Quantity, quantity)
                .SetProperty(i => i.LineTotal, lineTotal)
                .SetProperty(i => i.UpdatedAt, (DateTime?)DateTime.UtcNow), ct);

        if (rows == 0)
            throw new InvalidOperationException($"OrderItemQuantityUpdated: item {itemId} not found");

        var orderId = data.GetProperty("orderId").GetGuid();
        await RecalcOrderTotalsAsync(orderId, ct);
    }

    private async Task ApplyOrderItemRemovedAsync(JsonElement data, CancellationToken ct)
    {
        var itemId = data.GetProperty("itemId").GetGuid();
        var orderId = data.GetProperty("orderId").GetGuid();
        var autoCancelled = data.TryGetProperty("autoCancelled", out var ac) && ac.GetBoolean();

        // Cascade on order_item_options handles the option rows too.
        await _db.OrderItems.IgnoreQueryFilters()
            .Where(i => i.Id == itemId)
            .ExecuteDeleteAsync(ct);

        if (autoCancelled)
        {
            var now = DateTime.UtcNow;
            await _db.Orders.IgnoreQueryFilters()
                .Where(o => o.Id == orderId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(o => o.Status, OrderStatus.Cancelled)
                    .SetProperty(o => o.CancelledAt, (DateTime?)now)
                    .SetProperty(o => o.Subtotal, 0m)
                    .SetProperty(o => o.Total, 0m)
                    .SetProperty(o => o.UpdatedAt, (DateTime?)now), ct);
            await FreeTableForOrderAsync(orderId, ct);
        }
        else
        {
            await RecalcOrderTotalsAsync(orderId, ct);
        }
    }

    private async Task ApplyOrderDetailsUpdatedAsync(JsonElement data, CancellationToken ct)
    {
        var orderId = data.GetProperty("orderId").GetGuid();
        var customerId = TryGetGuid(data, "customerId");
        var name = TryGetString(data, "customerName");
        var phone = TryGetString(data, "customerPhone");
        var notes = TryGetString(data, "notes");

        await _db.Orders.IgnoreQueryFilters()
            .Where(o => o.Id == orderId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.CustomerId, customerId)
                .SetProperty(o => o.CustomerName, name)
                .SetProperty(o => o.CustomerPhone, phone)
                .SetProperty(o => o.Notes, notes)
                .SetProperty(o => o.UpdatedAt, (DateTime?)DateTime.UtcNow), ct);
    }

    private async Task ApplyOrderFulfillmentUpdatedAsync(JsonElement data, CancellationToken ct)
    {
        var orderId = data.GetProperty("orderId").GetGuid();
        var status = data.TryGetProperty("fulfillmentStatus", out var fs)
            && fs.ValueKind == JsonValueKind.Number
            ? (FulfillmentStatus)fs.GetInt32()
            : FulfillmentStatus.Pending;
        var courierUserId = TryGetGuid(data, "courierUserId");
        var outForDeliveryAt = TryGetDateTime(data, "outForDeliveryAt");
        var deliveredAt = TryGetDateTime(data, "deliveredAt");
        var updatedAt = TryGetDateTime(data, "updatedAt") ?? DateTime.UtcNow;

        var rows = await _db.Orders.IgnoreQueryFilters()
            .Where(o => o.Id == orderId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.FulfillmentStatus, status)
                .SetProperty(o => o.AssignedCourierUserId, courierUserId)
                .SetProperty(o => o.OutForDeliveryAt, outForDeliveryAt)
                .SetProperty(o => o.DeliveredAt, deliveredAt)
                .SetProperty(o => o.UpdatedAt, (DateTime?)updatedAt), ct);

        if (rows == 0)
            _logger.LogWarning(
                "OrderFulfillmentUpdated: order {Id} not found cloud-side.", orderId);
    }

    private async Task ApplyTableStatusChangedAsync(JsonElement data, CancellationToken ct)
    {
        var tableId = data.GetProperty("tableId").GetGuid();
        var status = data.TryGetProperty("status", out var st) && st.ValueKind == JsonValueKind.Number
            ? (TableStatus)st.GetInt32()
            : TableStatus.Empty;
        var updatedAt = TryGetDateTime(data, "updatedAt") ?? DateTime.UtcNow;

        await _db.Tables.IgnoreQueryFilters()
            .Where(t => t.Id == tableId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.Status, status)
                .SetProperty(t => t.UpdatedAt, (DateTime?)updatedAt), ct);
    }

    private async Task ApplyOrderCompletedAsync(JsonElement data, CancellationToken ct)
    {
        var orderId = data.GetProperty("orderId").GetGuid();
        var completedAt = TryGetDateTime(data, "completedAt") ?? DateTime.UtcNow;

        // Idempotent: if order is already Completed, payments are already in.
        var current = await _db.Orders.IgnoreQueryFilters()
            .Where(o => o.Id == orderId)
            .Select(o => new { o.Status, o.StoreId })
            .FirstOrDefaultAsync(ct);
        if (current is null)
            throw new InvalidOperationException($"OrderCompleted: order {orderId} not found");
        if (current.Status == OrderStatus.Completed) return;

        if (data.TryGetProperty("payments", out var payments) && payments.ValueKind == JsonValueKind.Array)
        {
            foreach (var p in payments.EnumerateArray())
            {
                var pid = TryGetGuid(p, "id");
                if (pid is Guid pidVal &&
                    await _db.Payments.IgnoreQueryFilters().AnyAsync(x => x.Id == pidVal, ct))
                    continue;

                _db.Payments.Add(new Payment
                {
                    Id = pid ?? Guid.NewGuid(),
                    StoreId = current.StoreId,
                    OrderId = orderId,
                    Amount = p.GetProperty("amount").GetDecimal(),
                    Method = (PaymentMethod)p.GetProperty("method").GetInt32(),
                    PaidAt = TryGetDateTime(p, "paidAt") ?? completedAt,
                    ReferenceNumber = TryGetString(p, "referenceNumber"),
                    Notes = TryGetString(p, "notes"),
                    CreatedByUserId = TryGetGuid(p, "createdByUserId"),
                });
            }
            await _db.SaveChangesAsync(ct);
        }

        await _db.Orders.IgnoreQueryFilters()
            .Where(o => o.Id == orderId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.Status, OrderStatus.Completed)
                .SetProperty(o => o.CompletedAt, (DateTime?)completedAt)
                .SetProperty(o => o.UpdatedAt, (DateTime?)DateTime.UtcNow), ct);

        await FreeTableForOrderAsync(orderId, ct);
    }

    private async Task ApplyOrderCancelledAsync(JsonElement data, CancellationToken ct)
    {
        var orderId = data.GetProperty("orderId").GetGuid();
        var cancelledAt = TryGetDateTime(data, "cancelledAt") ?? DateTime.UtcNow;

        var current = await _db.Orders.IgnoreQueryFilters()
            .Where(o => o.Id == orderId)
            .Select(o => new { o.Status })
            .FirstOrDefaultAsync(ct);
        if (current is null) return; // unknown order, nothing to do
        if (current.Status == OrderStatus.Cancelled) return; // idempotent

        await _db.Orders.IgnoreQueryFilters()
            .Where(o => o.Id == orderId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.Status, OrderStatus.Cancelled)
                .SetProperty(o => o.CancelledAt, (DateTime?)cancelledAt)
                .SetProperty(o => o.UpdatedAt, (DateTime?)DateTime.UtcNow), ct);

        await FreeTableForOrderAsync(orderId, ct);
    }

    // --- Customer handlers --------------------------------------------------

    private async Task ApplyCustomerUpsertAsync(JsonElement data, CancellationToken ct, bool isCreate)
    {
        var id = data.GetProperty("id").GetGuid();
        var storeId = data.GetProperty("storeId").GetGuid();
        var name = data.GetProperty("name").GetString() ?? "";
        var phone = data.GetProperty("phone").GetString() ?? "";
        var notes = TryGetString(data, "notes");
        var isActive = data.TryGetProperty("isActive", out var ia) && ia.GetBoolean();
        var updatedAt = TryGetDateTime(data, "updatedAt");
        var createdAt = TryGetDateTime(data, "createdAt") ?? DateTime.UtcNow;

        var existing = await _db.Customers.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == id, ct);
        if (existing is null)
        {
            _db.Customers.Add(new Customer
            {
                Id = id,
                StoreId = storeId,
                Name = name,
                Phone = phone,
                Notes = notes,
                IsActive = isActive,
                CreatedAt = createdAt,
                UpdatedAt = updatedAt,
            });
        }
        else
        {
            // Last-writer-wins: skip if local copy is newer-or-equal.
            var localStamp = existing.UpdatedAt ?? existing.CreatedAt;
            var incomingStamp = updatedAt ?? createdAt;
            if (incomingStamp <= localStamp) return;

            existing.Name = name;
            existing.Phone = phone;
            existing.Notes = notes;
            existing.IsActive = isActive;
            existing.UpdatedAt = updatedAt;
        }
        await _db.SaveChangesAsync(ct);
    }

    private async Task ApplyCustomerDeletedAsync(JsonElement data, CancellationToken ct)
    {
        var id = data.GetProperty("id").GetGuid();
        await _db.Customers.IgnoreQueryFilters()
            .Where(c => c.Id == id)
            .ExecuteDeleteAsync(ct);
    }

    private async Task ApplyCustomerAddressUpsertAsync(JsonElement data, CancellationToken ct, bool isCreate)
    {
        var id = data.GetProperty("id").GetGuid();
        var storeId = data.GetProperty("storeId").GetGuid();
        var customerId = data.GetProperty("customerId").GetGuid();
        var label = data.GetProperty("label").GetString() ?? "";
        var line = data.GetProperty("addressLine").GetString() ?? "";
        var district = TryGetString(data, "district");
        var notes = TryGetString(data, "notes");
        var isDefault = data.TryGetProperty("isDefault", out var idf) && idf.GetBoolean();
        var updatedAt = TryGetDateTime(data, "updatedAt");
        var createdAt = TryGetDateTime(data, "createdAt") ?? DateTime.UtcNow;

        var existing = await _db.CustomerAddresses.IgnoreQueryFilters()
            .FirstOrDefaultAsync(a => a.Id == id, ct);
        if (existing is null)
        {
            _db.CustomerAddresses.Add(new CustomerAddress
            {
                Id = id,
                StoreId = storeId,
                CustomerId = customerId,
                Label = label,
                AddressLine = line,
                District = district,
                Notes = notes,
                IsDefault = isDefault,
                CreatedAt = createdAt,
                UpdatedAt = updatedAt,
            });
        }
        else
        {
            var localStamp = existing.UpdatedAt ?? existing.CreatedAt;
            var incomingStamp = updatedAt ?? createdAt;
            if (incomingStamp <= localStamp) return;

            existing.Label = label;
            existing.AddressLine = line;
            existing.District = district;
            existing.Notes = notes;
            existing.IsDefault = isDefault;
            existing.UpdatedAt = updatedAt;
        }
        await _db.SaveChangesAsync(ct);
    }

    private async Task ApplyCustomerAddressDeletedAsync(JsonElement data, CancellationToken ct)
    {
        var id = data.GetProperty("id").GetGuid();
        await _db.CustomerAddresses.IgnoreQueryFilters()
            .Where(a => a.Id == id)
            .ExecuteDeleteAsync(ct);
    }

    // --- IncomingCall handlers ---------------------------------------------

    private async Task ApplyIncomingCallReceivedAsync(JsonElement data, CancellationToken ct)
    {
        var id = data.GetProperty("id").GetGuid();
        var exists = await _db.IncomingCalls.IgnoreQueryFilters()
            .AnyAsync(c => c.Id == id, ct);
        if (exists) return;

        var storeId = data.GetProperty("storeId").GetGuid();
        _db.IncomingCalls.Add(new IncomingCall
        {
            Id = id,
            StoreId = storeId,
            Phone = TryGetString(data, "phone"),
            LineNumber = data.TryGetProperty("lineNumber", out var ln) && ln.ValueKind == JsonValueKind.Number
                ? ln.GetInt32() : null,
            ReceivedAt = TryGetDateTime(data, "receivedAt") ?? DateTime.UtcNow,
            MatchedCustomerId = TryGetGuid(data, "matchedCustomerId"),
            Status = data.TryGetProperty("status", out var st) && st.ValueKind == JsonValueKind.Number
                ? (IncomingCallStatus)st.GetInt32() : IncomingCallStatus.New,
            CreatedAt = TryGetDateTime(data, "createdAt") ?? DateTime.UtcNow,
        });
        await _db.SaveChangesAsync(ct);
    }

    private async Task ApplyIncomingCallResolvedAsync(JsonElement data, CancellationToken ct)
    {
        var id = data.GetProperty("id").GetGuid();
        var status = data.TryGetProperty("status", out var st) && st.ValueKind == JsonValueKind.Number
            ? (IncomingCallStatus)st.GetInt32() : IncomingCallStatus.Handled;
        var resolvedOrderId = TryGetGuid(data, "resolvedOrderId");
        var handledByUserId = TryGetGuid(data, "handledByUserId");
        var handledAt = TryGetDateTime(data, "handledAt");
        var updatedAt = TryGetDateTime(data, "updatedAt") ?? DateTime.UtcNow;

        var rows = await _db.IncomingCalls.IgnoreQueryFilters()
            .Where(c => c.Id == id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.Status, status)
                .SetProperty(c => c.ResolvedOrderId, resolvedOrderId)
                .SetProperty(c => c.HandledByUserId, handledByUserId)
                .SetProperty(c => c.HandledAt, handledAt)
                .SetProperty(c => c.UpdatedAt, (DateTime?)updatedAt), ct);

        if (rows == 0)
            _logger.LogWarning("IncomingCallResolved: call {Id} not found in cloud — possibly applied before Received event.", id);
    }

    private async Task ApplyIncomingCallNoteUpdatedAsync(JsonElement data, CancellationToken ct)
    {
        var id = data.GetProperty("id").GetGuid();
        var note = TryGetString(data, "note");
        var updatedAt = TryGetDateTime(data, "updatedAt") ?? DateTime.UtcNow;

        await _db.IncomingCalls.IgnoreQueryFilters()
            .Where(c => c.Id == id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.Note, note)
                .SetProperty(c => c.UpdatedAt, (DateTime?)updatedAt), ct);
    }

    // --- Helpers ------------------------------------------------------------

    private async Task RecalcOrderTotalsAsync(Guid orderId, CancellationToken ct)
    {
        var subtotal = await _db.OrderItems.IgnoreQueryFilters()
            .Where(i => i.OrderId == orderId)
            .SumAsync(i => (decimal?)i.LineTotal, ct) ?? 0m;

        var discount = await _db.Orders.IgnoreQueryFilters()
            .Where(o => o.Id == orderId)
            .Select(o => o.DiscountAmount)
            .FirstOrDefaultAsync(ct);

        var total = Math.Max(0m, subtotal - discount);
        await _db.Orders.IgnoreQueryFilters()
            .Where(o => o.Id == orderId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.Subtotal, subtotal)
                .SetProperty(o => o.Total, total)
                .SetProperty(o => o.UpdatedAt, (DateTime?)DateTime.UtcNow), ct);
    }

    private async Task FreeTableForOrderAsync(Guid orderId, CancellationToken ct)
    {
        var tableId = await _db.Orders.IgnoreQueryFilters()
            .Where(o => o.Id == orderId)
            .Select(o => o.TableId)
            .FirstOrDefaultAsync(ct);

        if (tableId is Guid tid)
        {
            await _db.Tables.IgnoreQueryFilters()
                .Where(t => t.Id == tid)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(t => t.Status, TableStatus.Empty)
                    .SetProperty(t => t.UpdatedAt, (DateTime?)DateTime.UtcNow), ct);
        }
    }

    private static string? TryGetString(JsonElement el, string name) =>
        el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private static Guid? TryGetGuid(JsonElement el, string name) =>
        el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String && Guid.TryParse(v.GetString(), out var g) ? g : null;

    private static decimal? TryGetDecimal(JsonElement el, string name) =>
        el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDecimal() : null;

    private static DateTime? TryGetDateTime(JsonElement el, string name)
    {
        if (!el.TryGetProperty(name, out var v) || v.ValueKind != JsonValueKind.String) return null;
        return DateTime.TryParse(v.GetString(), null,
            System.Globalization.DateTimeStyles.RoundtripKind, out var dt) ? dt : null;
    }
}
