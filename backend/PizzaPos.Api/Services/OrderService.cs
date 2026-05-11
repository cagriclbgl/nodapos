using Microsoft.EntityFrameworkCore;
using PizzaPos.Api.Auth;
using PizzaPos.Api.Data;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Services;

public class OrderService : IOrderService
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserAccessor _currentUser;
    private readonly IOutboxEmitter _outbox;

    public OrderService(AppDbContext db, ICurrentUserAccessor currentUser, IOutboxEmitter outbox)
    {
        _db = db;
        _currentUser = currentUser;
        _outbox = outbox;
    }

    public async Task<IReadOnlyList<OrderDto>> ListAsync(
        OrderStatus? status,
        Guid? tableId,
        OrderType? orderType,
        DateTime? from,
        DateTime? to,
        CancellationToken ct = default)
    {
        var query = _db.Orders
            .Include(o => o.Table)
            .Include(o => o.Items).ThenInclude(i => i.Options)
            .Include(o => o.Payments)
            .AsQueryable();

        if (status.HasValue) query = query.Where(o => o.Status == status.Value);
        if (tableId.HasValue) query = query.Where(o => o.TableId == tableId.Value);
        if (orderType.HasValue) query = query.Where(o => o.OrderType == orderType.Value);
        if (from.HasValue) query = query.Where(o => o.CreatedAt >= from.Value);
        if (to.HasValue) query = query.Where(o => o.CreatedAt <= to.Value);

        var rows = await query.OrderByDescending(o => o.CreatedAt).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<OrderDto?> GetAsync(Guid id, CancellationToken ct = default)
    {
        var order = await LoadFullAsync(id, ct);
        return order is null ? null : Map(order);
    }

    public async Task<OrderDto> CreateAsync(CreateOrderRequest request, CancellationToken ct = default)
    {
        if (request.Items is null || request.Items.Count == 0)
            throw new DomainException("Order must contain at least one item.");

        Table? table = null;
        if (request.TableId.HasValue)
        {
            table = await _db.Tables.FindAsync([request.TableId.Value], ct)
                ?? throw DomainException.NotFound("Table");
        }

        // If a CustomerId is provided, snapshot Name/Phone from the Customer
        // record. Frontend may also pass free-text CustomerName/CustomerPhone
        // (e.g. when no Customer is selected) — when both arrive, the
        // resolved Customer wins so we keep a single source of truth.
        string? customerName = request.CustomerName;
        string? customerPhone = request.CustomerPhone;
        Guid? customerId = null;
        if (request.CustomerId.HasValue)
        {
            var customer = await _db.Customers
                .FirstOrDefaultAsync(c => c.Id == request.CustomerId.Value, ct)
                ?? throw DomainException.NotFound("Customer");
            customerId = customer.Id;
            customerName = customer.Name;
            customerPhone = customer.Phone;
        }

        var order = new Order
        {
            OrderNumber = GenerateOrderNumber(),
            TableId = table?.Id,
            OrderType = request.OrderType,
            Status = OrderStatus.Active,
            CustomerId = customerId,
            CustomerName = customerName,
            CustomerPhone = customerPhone,
            Notes = request.Notes,
            DiscountAmount = request.DiscountAmount < 0 ? 0 : request.DiscountAmount,
            CreatedByUserId = _currentUser.UserId
        };

        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        _db.Orders.Add(order);

        foreach (var line in request.Items)
            await BuildAndAttachItemAsync(order, line, ct);

        RecalculateTotals(order);

        if (table is not null && table.Status == TableStatus.Empty)
            table.Status = TableStatus.Occupied;

        await _db.SaveChangesAsync(ct);

        // Full snapshot — apply on cloud needs every field to materialize the
        // Order graph atomically (items + per-item options). Ids of children
        // come along so re-delivery is idempotent.
        await _outbox.EmitAsync("Order", order.Id, "OrderCreated",
            new
            {
                order.Id,
                order.StoreId,
                order.OrderNumber,
                order.TableId,
                order.OrderType,
                status = order.Status,
                order.Subtotal,
                order.DiscountAmount,
                order.Total,
                order.CustomerId,
                order.CustomerName,
                order.CustomerPhone,
                order.Notes,
                order.CreatedByUserId,
                createdAt = order.CreatedAt,
                items = order.Items.Select(i => new
                {
                    i.Id,
                    i.ProductId,
                    i.ProductName,
                    i.UnitPrice,
                    i.Quantity,
                    i.LineTotal,
                    i.Notes,
                    options = i.Options.Select(o => new
                    {
                        o.Id,
                        o.ProductOptionId,
                        o.GroupName,
                        o.OptionName,
                        o.AdditionalPrice
                    })
                })
            }, ct);
        await _db.SaveChangesAsync(ct);

        await tx.CommitAsync(ct);

        return (await GetAsync(order.Id, ct))!;
    }

    public async Task<OrderDto> AddItemAsync(Guid orderId, AddOrderItemRequest line, CancellationToken ct = default)
    {
        if (line.Quantity <= 0)
            throw new DomainException("Item quantity must be positive.");

        // Lightweight projection — we only need a few fields to validate.
        // Loading the full graph (Items.Options) and then UPDATEing Order via
        // the change tracker hit DbUpdateConcurrencyException under the
        // Supabase pooler (0 rows reported even with no concurrency tokens).
        // Building the new item directly + recomputing totals via a raw
        // ExecuteUpdate sidesteps that path entirely.
        var orderInfo = await _db.Orders
            .Where(o => o.Id == orderId)
            .Select(o => new { o.Id, o.Status, o.DiscountAmount })
            .FirstOrDefaultAsync(ct)
            ?? throw DomainException.NotFound("Order");

        if (orderInfo.Status != OrderStatus.Active)
            throw DomainException.Conflict("Cannot add items to a non-active order.");

        var product = await _db.Products
            .Include(p => p.Options)
            .FirstOrDefaultAsync(p => p.Id == line.ProductId, ct)
            ?? throw DomainException.NotFound($"Product {line.ProductId}");

        if (!product.IsAvailable)
            throw DomainException.Conflict($"Product '{product.Name}' is unavailable.");

        var item = new OrderItem
        {
            OrderId = orderInfo.Id,
            ProductId = product.Id,
            ProductName = product.Name,   // SNAPSHOT
            UnitPrice = product.Price,    // SNAPSHOT
            Quantity = line.Quantity,
            Notes = line.Notes
        };

        decimal optionsTotal = 0m;
        if (line.ProductOptionIds is { Count: > 0 })
        {
            var requested = line.ProductOptionIds.Distinct().ToHashSet();
            var matched = product.Options.Where(o => requested.Contains(o.Id)).ToList();
            if (matched.Count != requested.Count)
                throw new DomainException("One or more options do not belong to the product.");

            foreach (var opt in matched)
            {
                if (!opt.IsActive)
                    throw DomainException.Conflict($"Option '{opt.Name}' is inactive.");
                item.Options.Add(new OrderItemOption
                {
                    ProductOptionId = opt.Id,
                    GroupName = opt.GroupName,            // SNAPSHOT
                    OptionName = opt.Name,                // SNAPSHOT
                    AdditionalPrice = opt.AdditionalPrice // SNAPSHOT
                });
                optionsTotal += opt.AdditionalPrice;
            }
        }

        item.LineTotal = (item.UnitPrice + optionsTotal) * item.Quantity;

        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        _db.OrderItems.Add(item);
        await _db.SaveChangesAsync(ct);

        // Recompute Subtotal/Total fresh from DB (includes the just-inserted
        // item) and push to Order via raw UPDATE. The query filter scopes to
        // the current tenant's StoreId automatically.
        var newSubtotal = await _db.OrderItems
            .Where(i => i.OrderId == orderInfo.Id)
            .SumAsync(i => (decimal?)i.LineTotal, ct) ?? 0m;
        var newTotal = Math.Max(0m, newSubtotal - orderInfo.DiscountAmount);
        var now = DateTime.UtcNow;

        var rows = await _db.Orders
            .Where(o => o.Id == orderInfo.Id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.Subtotal, newSubtotal)
                .SetProperty(o => o.Total, newTotal)
                .SetProperty(o => o.UpdatedAt, (DateTime?)now), ct);

        if (rows == 0)
            throw DomainException.Conflict("Order disappeared while updating totals.");

        await _outbox.EmitAsync("Order", orderInfo.Id, "OrderItemAdded",
            new
            {
                orderId = orderInfo.Id,
                itemId = item.Id,
                productId = product.Id,
                productName = item.ProductName,
                unitPrice = item.UnitPrice,
                quantity = item.Quantity,
                lineTotal = item.LineTotal
            }, ct);
        await _db.SaveChangesAsync(ct);

        await tx.CommitAsync(ct);

        return (await GetAsync(orderInfo.Id, ct))!;
    }

    public async Task<OrderDto> UpdateItemAsync(
        Guid orderId, Guid itemId, UpdateOrderItemRequest request, CancellationToken ct = default)
    {
        if (request.Quantity <= 0)
            throw new DomainException("Item quantity must be positive.");

        var orderInfo = await _db.Orders
            .Where(o => o.Id == orderId)
            .Select(o => new { o.Id, o.Status, o.DiscountAmount })
            .FirstOrDefaultAsync(ct)
            ?? throw DomainException.NotFound("Order");

        if (orderInfo.Status != OrderStatus.Active)
            throw DomainException.Conflict("Cannot modify items on a non-active order.");

        var item = await _db.OrderItems
            .Where(i => i.Id == itemId && i.OrderId == orderInfo.Id)
            .Select(i => new { i.Id, i.UnitPrice })
            .FirstOrDefaultAsync(ct)
            ?? throw DomainException.NotFound("OrderItem");

        var optionsSum = await _db.OrderItemOptions
            .Where(o => o.OrderItemId == itemId)
            .SumAsync(o => (decimal?)o.AdditionalPrice, ct) ?? 0m;

        var newLineTotal = (item.UnitPrice + optionsSum) * request.Quantity;
        var now = DateTime.UtcNow;

        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        var itemRows = await _db.OrderItems
            .Where(i => i.Id == itemId && i.OrderId == orderInfo.Id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(i => i.Quantity, request.Quantity)
                .SetProperty(i => i.LineTotal, newLineTotal)
                .SetProperty(i => i.UpdatedAt, (DateTime?)now), ct);
        if (itemRows == 0)
            throw DomainException.Conflict("Order item disappeared while updating.");

        var newSubtotal = await _db.OrderItems
            .Where(i => i.OrderId == orderInfo.Id)
            .SumAsync(i => (decimal?)i.LineTotal, ct) ?? 0m;
        var newTotal = Math.Max(0m, newSubtotal - orderInfo.DiscountAmount);

        await _db.Orders
            .Where(o => o.Id == orderInfo.Id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.Subtotal, newSubtotal)
                .SetProperty(o => o.Total, newTotal)
                .SetProperty(o => o.UpdatedAt, (DateTime?)now), ct);

        await _outbox.EmitAsync("Order", orderInfo.Id, "OrderItemQuantityUpdated",
            new
            {
                orderId = orderInfo.Id,
                itemId,
                quantity = request.Quantity,
                lineTotal = newLineTotal
            }, ct);
        await _db.SaveChangesAsync(ct);

        await tx.CommitAsync(ct);
        return (await GetAsync(orderInfo.Id, ct))!;
    }

    public async Task<OrderDto> RemoveItemAsync(Guid orderId, Guid itemId, CancellationToken ct = default)
    {
        var orderInfo = await _db.Orders
            .Where(o => o.Id == orderId)
            .Select(o => new { o.Id, o.Status, o.DiscountAmount, o.TableId })
            .FirstOrDefaultAsync(ct)
            ?? throw DomainException.NotFound("Order");

        if (orderInfo.Status != OrderStatus.Active)
            throw DomainException.Conflict("Cannot remove items from a non-active order.");

        var now = DateTime.UtcNow;

        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        // Cascade delete on order_item_options is configured at the FK level,
        // so removing the OrderItem row drops its option snapshots in the same SQL.
        var deleted = await _db.OrderItems
            .Where(i => i.Id == itemId && i.OrderId == orderInfo.Id)
            .ExecuteDeleteAsync(ct);
        if (deleted == 0)
            throw DomainException.NotFound("OrderItem");

        var remaining = await _db.OrderItems
            .Where(i => i.OrderId == orderInfo.Id)
            .CountAsync(ct);

        if (remaining == 0)
        {
            // Empty cart on an active order has no meaningful state — auto-cancel
            // and free the table so the operator gets a clean slate.
            await _db.Orders
                .Where(o => o.Id == orderInfo.Id)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(o => o.Status, OrderStatus.Cancelled)
                    .SetProperty(o => o.CancelledAt, (DateTime?)now)
                    .SetProperty(o => o.Subtotal, 0m)
                    .SetProperty(o => o.Total, 0m)
                    .SetProperty(o => o.UpdatedAt, (DateTime?)now), ct);

            if (orderInfo.TableId is Guid tableId)
            {
                await _db.Tables
                    .Where(t => t.Id == tableId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(t => t.Status, TableStatus.Empty)
                        .SetProperty(t => t.UpdatedAt, (DateTime?)now), ct);
            }
        }
        else
        {
            var newSubtotal = await _db.OrderItems
                .Where(i => i.OrderId == orderInfo.Id)
                .SumAsync(i => (decimal?)i.LineTotal, ct) ?? 0m;
            var newTotal = Math.Max(0m, newSubtotal - orderInfo.DiscountAmount);

            await _db.Orders
                .Where(o => o.Id == orderInfo.Id)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(o => o.Subtotal, newSubtotal)
                    .SetProperty(o => o.Total, newTotal)
                    .SetProperty(o => o.UpdatedAt, (DateTime?)now), ct);
        }

        await _outbox.EmitAsync("Order", orderInfo.Id, "OrderItemRemoved",
            new
            {
                orderId = orderInfo.Id,
                itemId,
                autoCancelled = (remaining == 0)
            }, ct);
        await _db.SaveChangesAsync(ct);

        await tx.CommitAsync(ct);
        return (await GetAsync(orderInfo.Id, ct))!;
    }

    public async Task<OrderDto> UpdateDetailsAsync(
        Guid orderId, UpdateOrderDetailsRequest request, CancellationToken ct = default)
    {
        var orderInfo = await _db.Orders
            .Where(o => o.Id == orderId)
            .Select(o => new { o.Id, o.Status })
            .FirstOrDefaultAsync(ct)
            ?? throw DomainException.NotFound("Order");

        if (orderInfo.Status != OrderStatus.Active)
            throw DomainException.Conflict("Cannot edit details on a non-active order.");

        var customerName = string.IsNullOrWhiteSpace(request.CustomerName) ? null : request.CustomerName.Trim();
        var customerPhone = string.IsNullOrWhiteSpace(request.CustomerPhone) ? null : request.CustomerPhone.Trim();
        var notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        var customerId = request.CustomerId;

        // Eger CustomerId verildiyse Customer kaydini cek + Name/Phone'i snapshot
        // olarak override et (CreateAsync ile ayni pattern). Boylece kasiyer
        // siparis acildiktan sonra muhsteri linkleyebilir, gecmise dokunmadan.
        if (customerId is Guid cid)
        {
            var cust = await _db.Customers
                .Where(c => c.Id == cid)
                .Select(c => new { c.Name, c.Phone })
                .FirstOrDefaultAsync(ct)
                ?? throw DomainException.NotFound("Customer");
            customerName = cust.Name;
            customerPhone = cust.Phone;
        }

        var now = DateTime.UtcNow;

        var rows = await _db.Orders
            .Where(o => o.Id == orderInfo.Id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.CustomerId, customerId)
                .SetProperty(o => o.CustomerName, customerName)
                .SetProperty(o => o.CustomerPhone, customerPhone)
                .SetProperty(o => o.Notes, notes)
                .SetProperty(o => o.UpdatedAt, (DateTime?)now), ct);
        if (rows == 0)
            throw DomainException.Conflict("Order disappeared while updating details.");

        await _outbox.EmitAsync("Order", orderInfo.Id, "OrderDetailsUpdated",
            new
            {
                orderId = orderInfo.Id,
                customerId,
                customerName,
                customerPhone,
                notes
            }, ct);
        await _db.SaveChangesAsync(ct);

        return (await GetAsync(orderInfo.Id, ct))!;
    }

    /// <summary>
    /// Atomic transaction:
    ///   1) Validate Order is Active and total payment >= Order.Total
    ///   2) Insert Payment rows
    ///   3) Order.Status = Completed, CompletedAt = now
    ///   4) Linked Table.Status = Empty
    /// All four steps commit together or none at all.
    /// </summary>
    public async Task<OrderDto> CompleteAsync(
        Guid orderId, CompleteOrderRequest request, CancellationToken ct = default)
    {
        if (request.Payments is null || request.Payments.Count == 0)
            throw new DomainException("At least one payment line is required.");
        if (request.Payments.Any(p => p.Amount <= 0))
            throw new DomainException("Each payment amount must be positive.");

        // Lightweight projection — see AddItemAsync for rationale (avoids the
        // tracker-based UPDATE path that hit DbUpdateConcurrencyException).
        var orderInfo = await _db.Orders
            .Where(o => o.Id == orderId)
            .Select(o => new { o.Id, o.Status, o.Total, o.TableId })
            .FirstOrDefaultAsync(ct)
            ?? throw DomainException.NotFound("Order");

        if (orderInfo.Status != OrderStatus.Active)
            throw DomainException.Conflict("Only active orders can be completed.");

        var totalPaid = request.Payments.Sum(p => p.Amount);
        if (totalPaid < orderInfo.Total)
            throw new DomainException(
                $"Insufficient payment. Order total {orderInfo.Total:0.00}, paid {totalPaid:0.00}.");

        var now = DateTime.UtcNow;

        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        // 1) Insert Payment rows. Hold references so we can emit their Ids in
        // the OrderCompleted payload — needed for idempotent cloud-side apply.
        var actorId = _currentUser.UserId;
        var paymentRows = new List<Payment>(request.Payments.Count);
        foreach (var p in request.Payments)
        {
            var pay = new Payment
            {
                OrderId = orderInfo.Id,
                Amount = p.Amount,
                Method = p.Method,
                PaidAt = now,
                ReferenceNumber = p.ReferenceNumber,
                Notes = p.Notes,
                CreatedByUserId = actorId
            };
            _db.Payments.Add(pay);
            paymentRows.Add(pay);
        }
        await _db.SaveChangesAsync(ct);

        // 2) Mark Order as Completed.
        var orderRows = await _db.Orders
            .Where(o => o.Id == orderInfo.Id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.Status, OrderStatus.Completed)
                .SetProperty(o => o.CompletedAt, (DateTime?)now)
                .SetProperty(o => o.UpdatedAt, (DateTime?)now), ct);
        if (orderRows == 0)
            throw DomainException.Conflict("Order disappeared while completing.");

        // 3) Free the linked table, if any.
        if (orderInfo.TableId is Guid tableId)
        {
            await _db.Tables
                .Where(t => t.Id == tableId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(t => t.Status, TableStatus.Empty)
                    .SetProperty(t => t.UpdatedAt, (DateTime?)now), ct);
        }

        await _outbox.EmitAsync("Order", orderInfo.Id, "OrderCompleted",
            new
            {
                orderId = orderInfo.Id,
                total = orderInfo.Total,
                completedAt = now,
                payments = paymentRows.Select(p => new
                {
                    p.Id,
                    p.Amount,
                    p.Method,
                    paidAt = p.PaidAt,
                    p.ReferenceNumber,
                    p.Notes,
                    p.CreatedByUserId
                })
            }, ct);
        await _db.SaveChangesAsync(ct);

        await tx.CommitAsync(ct);

        return (await GetAsync(orderInfo.Id, ct))!;
    }

    public async Task<OrderDto> AddComboAsync(Guid orderId, AddComboToOrderRequest request, CancellationToken ct = default)
    {
        if (request.Quantity <= 0)
            throw new DomainException("Combo quantity must be positive.");
        if (request.Selections is null || request.Selections.Count == 0)
            throw new DomainException("Slot seçimleri eksik.");

        var orderInfo = await _db.Orders
            .Where(o => o.Id == orderId)
            .Select(o => new { o.Id, o.Status, o.DiscountAmount })
            .FirstOrDefaultAsync(ct)
            ?? throw DomainException.NotFound("Order");

        if (orderInfo.Status != OrderStatus.Active)
            throw DomainException.Conflict("Cannot add combo to a non-active order.");

        var combo = await _db.Combos
            .Include(c => c.Items)
            .FirstOrDefaultAsync(c => c.Id == request.ComboId, ct)
            ?? throw DomainException.NotFound("Kombo");

        if (!combo.IsActive)
            throw DomainException.Conflict($"Kombo '{combo.Name}' aktif değil.");

        // Her slot için seçim sayısı slot.Quantity ile eşleşmeli; ürünler aynı
        // store'da ve slot kategorisinden olmalı.
        var slotById = combo.Items.ToDictionary(i => i.Id);
        var allProductIds = request.Selections
            .SelectMany(s => s.ProductIds)
            .Distinct()
            .ToList();
        var products = await _db.Products
            .Where(p => allProductIds.Contains(p.Id))
            .Select(p => new { p.Id, p.Name, p.CategoryId, p.IsAvailable })
            .ToListAsync(ct);
        var productById = products.ToDictionary(p => p.Id);

        var summaryParts = new List<string>();
        Guid? firstProductId = null;
        foreach (var slot in combo.Items.OrderBy(i => i.DisplayOrder))
        {
            var sel = request.Selections.FirstOrDefault(s => s.ComboItemId == slot.Id)
                ?? throw new DomainException($"'{slot.Label}' slotu için seçim eksik.");

            if (sel.ProductIds.Count != slot.Quantity)
                throw new DomainException(
                    $"'{slot.Label}' slotu için {slot.Quantity} ürün seçilmeli (gönderilen: {sel.ProductIds.Count}).");

            var pickedNames = new List<string>();
            foreach (var pid in sel.ProductIds)
            {
                if (!productById.TryGetValue(pid, out var prod))
                    throw DomainException.NotFound($"Product {pid}");
                if (!prod.IsAvailable)
                    throw DomainException.Conflict($"Ürün '{prod.Name}' kullanılamıyor.");
                if (prod.CategoryId != slot.CategoryId)
                    throw new DomainException(
                        $"'{prod.Name}' '{slot.Label}' slotunun kategorisinde değil.");
                pickedNames.Add(prod.Name);
                firstProductId ??= prod.Id;
            }
            summaryParts.Add($"{slot.Label}: {string.Join(", ", pickedNames)}");
            _ = slotById; // slot kullanımını analyze warning'ten korur
        }

        if (firstProductId is null)
            throw new DomainException("Kombo seçimleri boş.");

        // ProductId, snapshot mantığı korunsun diye gerçek bir ürün ID'sine
        // bağlanır (slot'taki ilk seçim). Görünüm/raporda ProductName ve
        // UnitPrice override eder, çünkü OrderItem snapshot fields'ları doldurur.
        var item = new OrderItem
        {
            OrderId = orderInfo.Id,
            ProductId = firstProductId.Value,
            ProductName = combo.Name,        // SNAPSHOT (combo adı)
            UnitPrice = combo.Price,         // SNAPSHOT (combo fiyatı)
            Quantity = request.Quantity,
            Notes = string.Join(" | ", summaryParts),
        };
        item.LineTotal = item.UnitPrice * item.Quantity;

        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        _db.OrderItems.Add(item);
        await _db.SaveChangesAsync(ct);

        var newSubtotal = await _db.OrderItems
            .Where(i => i.OrderId == orderInfo.Id)
            .SumAsync(i => (decimal?)i.LineTotal, ct) ?? 0m;
        var newTotal = Math.Max(0m, newSubtotal - orderInfo.DiscountAmount);
        var now = DateTime.UtcNow;

        await _db.Orders
            .Where(o => o.Id == orderInfo.Id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.Subtotal, newSubtotal)
                .SetProperty(o => o.Total, newTotal)
                .SetProperty(o => o.UpdatedAt, (DateTime?)now), ct);

        await _outbox.EmitAsync("Order", orderInfo.Id, "OrderItemAdded",
            new
            {
                orderId = orderInfo.Id,
                itemId = item.Id,
                productId = item.ProductId,
                productName = item.ProductName,
                unitPrice = item.UnitPrice,
                quantity = item.Quantity,
                lineTotal = item.LineTotal,
                notes = item.Notes,
                comboId = combo.Id,
            }, ct);
        await _db.SaveChangesAsync(ct);

        await tx.CommitAsync(ct);
        return (await GetAsync(orderInfo.Id, ct))!;
    }

    public async Task<OrderDto> CreateDeliveryAsync(
        CreateDeliveryOrderRequest request, CancellationToken ct = default)
    {
        if (request.Items is null || request.Items.Count == 0)
            throw new DomainException("Order must contain at least one item.");
        if (request.OrderType is not (OrderType.Takeaway or OrderType.Delivery))
            throw new DomainException("CreateDelivery only supports Takeaway or Delivery order types.");

        var customer = await _db.Customers
            .Include(c => c.Addresses)
            .FirstOrDefaultAsync(c => c.Id == request.CustomerId, ct)
            ?? throw DomainException.NotFound("Customer");

        // Delivery: adres metni zorunlu (CustomerAddress'ten snapshot ya da inline).
        string? addressSnapshot = null;
        string? addressDistrict = null;
        Guid? customerAddressId = null;

        if (request.OrderType == OrderType.Delivery)
        {
            if (request.CustomerAddressId.HasValue)
            {
                var addr = customer.Addresses.FirstOrDefault(a => a.Id == request.CustomerAddressId.Value)
                    ?? throw DomainException.NotFound("CustomerAddress");
                addressSnapshot = addr.AddressLine;
                addressDistrict = addr.District;
                customerAddressId = addr.Id;
            }
            else if (!string.IsNullOrWhiteSpace(request.AddressLine))
            {
                addressSnapshot = request.AddressLine.Trim();
                addressDistrict = string.IsNullOrWhiteSpace(request.District) ? null : request.District.Trim();
            }
            else
            {
                throw new DomainException(
                    "Delivery siparişi için CustomerAddressId veya AddressLine zorunlu.");
            }
        }

        var order = new Order
        {
            OrderNumber = GenerateOrderNumber(),
            TableId = null,
            OrderType = request.OrderType,
            Status = OrderStatus.Active,
            CustomerId = customer.Id,
            CustomerAddressId = customerAddressId,
            CustomerName = customer.Name,                     // SNAPSHOT
            CustomerPhone = customer.Phone,                   // SNAPSHOT
            DeliveryAddressSnapshot = addressSnapshot,        // SNAPSHOT
            DeliveryDistrict = addressDistrict,
            FulfillmentStatus = FulfillmentStatus.Pending,
            IncomingCallId = request.IncomingCallId,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            DiscountAmount = request.DiscountAmount < 0 ? 0 : request.DiscountAmount,
            CreatedByUserId = _currentUser.UserId,
        };

        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        _db.Orders.Add(order);

        foreach (var line in request.Items)
            await BuildAndAttachItemAsync(order, line, ct);

        RecalculateTotals(order);

        await _db.SaveChangesAsync(ct);

        // Çağrıdan geldiyse o çağrıyı Handled olarak bağla.
        if (request.IncomingCallId.HasValue)
        {
            var now = DateTime.UtcNow;
            await _db.IncomingCalls
                .Where(c => c.Id == request.IncomingCallId.Value)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(c => c.Status, IncomingCallStatus.Handled)
                    .SetProperty(c => c.ResolvedOrderId, (Guid?)order.Id)
                    .SetProperty(c => c.HandledByUserId, _currentUser.UserId)
                    .SetProperty(c => c.HandledAt, (DateTime?)now)
                    .SetProperty(c => c.UpdatedAt, (DateTime?)now), ct);

            await _outbox.EmitAsync("IncomingCall", request.IncomingCallId.Value, "IncomingCallResolved",
                new
                {
                    id = request.IncomingCallId.Value,
                    storeId = order.StoreId,
                    status = IncomingCallStatus.Handled,
                    resolvedOrderId = order.Id,
                    handledByUserId = _currentUser.UserId,
                    handledAt = now,
                    updatedAt = now,
                }, ct);
        }

        await _outbox.EmitAsync("Order", order.Id, "OrderCreated",
            new
            {
                order.Id,
                order.StoreId,
                order.OrderNumber,
                order.TableId,
                order.OrderType,
                status = order.Status,
                order.Subtotal,
                order.DiscountAmount,
                order.Total,
                order.CustomerId,
                order.CustomerName,
                order.CustomerPhone,
                order.Notes,
                order.CreatedByUserId,
                createdAt = order.CreatedAt,
                deliveryAddressSnapshot = order.DeliveryAddressSnapshot,
                deliveryDistrict = order.DeliveryDistrict,
                fulfillmentStatus = order.FulfillmentStatus,
                assignedCourierUserId = order.AssignedCourierUserId,
                outForDeliveryAt = order.OutForDeliveryAt,
                deliveredAt = order.DeliveredAt,
                incomingCallId = order.IncomingCallId,
                items = order.Items.Select(i => new
                {
                    i.Id,
                    i.ProductId,
                    i.ProductName,
                    i.UnitPrice,
                    i.Quantity,
                    i.LineTotal,
                    i.Notes,
                    options = i.Options.Select(o => new
                    {
                        o.Id,
                        o.ProductOptionId,
                        o.GroupName,
                        o.OptionName,
                        o.AdditionalPrice
                    })
                })
            }, ct);
        await _db.SaveChangesAsync(ct);

        await tx.CommitAsync(ct);

        return (await GetAsync(order.Id, ct))!;
    }

    public async Task<OrderDto> CancelAsync(Guid orderId, CancellationToken ct = default)
    {
        var orderInfo = await _db.Orders
            .Where(o => o.Id == orderId)
            .Select(o => new { o.Id, o.Status, o.TableId })
            .FirstOrDefaultAsync(ct)
            ?? throw DomainException.NotFound("Order");

        if (orderInfo.Status != OrderStatus.Active)
            throw DomainException.Conflict("Only active orders can be cancelled.");

        var now = DateTime.UtcNow;

        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        var orderRows = await _db.Orders
            .Where(o => o.Id == orderInfo.Id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.Status, OrderStatus.Cancelled)
                .SetProperty(o => o.CancelledAt, (DateTime?)now)
                .SetProperty(o => o.UpdatedAt, (DateTime?)now), ct);
        if (orderRows == 0)
            throw DomainException.Conflict("Order disappeared while cancelling.");

        if (orderInfo.TableId is Guid tableId)
        {
            await _db.Tables
                .Where(t => t.Id == tableId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(t => t.Status, TableStatus.Empty)
                    .SetProperty(t => t.UpdatedAt, (DateTime?)now), ct);
        }

        await _outbox.EmitAsync("Order", orderInfo.Id, "OrderCancelled",
            new
            {
                orderId = orderInfo.Id,
                cancelledAt = now
            }, ct);
        await _db.SaveChangesAsync(ct);

        await tx.CommitAsync(ct);

        return (await GetAsync(orderInfo.Id, ct))!;
    }

    public async Task<OrderDto> UpdateFulfillmentAsync(
        Guid orderId, UpdateFulfillmentStatusRequest request, CancellationToken ct = default)
    {
        var orderInfo = await _db.Orders
            .Where(o => o.Id == orderId)
            .Select(o => new
            {
                o.Id,
                o.Status,
                o.OrderType,
                o.OutForDeliveryAt,
                o.DeliveredAt
            })
            .FirstOrDefaultAsync(ct)
            ?? throw DomainException.NotFound("Order");

        if (orderInfo.Status != OrderStatus.Active)
            throw DomainException.Conflict("Cannot change fulfillment on a non-active order.");
        if (orderInfo.OrderType == OrderType.DineIn)
            throw DomainException.Conflict(
                "Fulfillment transitions apply to Takeaway/Delivery orders only.");

        var newStatus = request.Status;
        var courierUserId = request.CourierUserId;

        if (newStatus == FulfillmentStatus.OutForDelivery
            && orderInfo.OrderType == OrderType.Delivery
            && courierUserId is null)
            throw new DomainException(
                "CourierUserId is required when moving a Delivery order to OutForDelivery.");

        var now = DateTime.UtcNow;
        // Stamp transition timestamps when entering each terminal-ish state;
        // otherwise preserve the existing timestamp (kasiyer rollback edebilir).
        var newOutForDeliveryAt = newStatus == FulfillmentStatus.OutForDelivery
            ? (DateTime?)now : orderInfo.OutForDeliveryAt;
        var newDeliveredAt = newStatus == FulfillmentStatus.Delivered
            ? (DateTime?)now : orderInfo.DeliveredAt;

        var rows = await _db.Orders
            .Where(o => o.Id == orderInfo.Id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(o => o.FulfillmentStatus, newStatus)
                .SetProperty(o => o.AssignedCourierUserId, courierUserId)
                .SetProperty(o => o.OutForDeliveryAt, newOutForDeliveryAt)
                .SetProperty(o => o.DeliveredAt, newDeliveredAt)
                .SetProperty(o => o.UpdatedAt, (DateTime?)now), ct);
        if (rows == 0)
            throw DomainException.Conflict("Order disappeared while updating fulfillment.");

        await _outbox.EmitAsync("Order", orderInfo.Id, "OrderFulfillmentUpdated",
            new
            {
                orderId = orderInfo.Id,
                fulfillmentStatus = newStatus,
                courierUserId,
                outForDeliveryAt = newOutForDeliveryAt,
                deliveredAt = newDeliveredAt,
                updatedAt = now
            }, ct);
        await _db.SaveChangesAsync(ct);

        return (await GetAsync(orderInfo.Id, ct))!;
    }

    /// <summary>
    /// Snapshots Product.Name/Price and ProductOption.Name/AdditionalPrice into
    /// the OrderItem/OrderItemOption so future menu edits do not mutate history.
    /// </summary>
    private async Task BuildAndAttachItemAsync(Order order, AddOrderItemRequest line, CancellationToken ct)
    {
        if (line.Quantity <= 0)
            throw new DomainException("Item quantity must be positive.");

        var product = await _db.Products
            .Include(p => p.Options)
            .FirstOrDefaultAsync(p => p.Id == line.ProductId, ct)
            ?? throw DomainException.NotFound($"Product {line.ProductId}");

        if (!product.IsAvailable)
            throw DomainException.Conflict($"Product '{product.Name}' is unavailable.");

        var item = new OrderItem
        {
            ProductId = product.Id,
            ProductName = product.Name,   // SNAPSHOT
            UnitPrice = product.Price,    // SNAPSHOT
            Quantity = line.Quantity,
            Notes = line.Notes
        };

        decimal optionsTotal = 0m;
        if (line.ProductOptionIds is { Count: > 0 })
        {
            var requested = line.ProductOptionIds.Distinct().ToHashSet();
            var matched = product.Options.Where(o => requested.Contains(o.Id)).ToList();
            if (matched.Count != requested.Count)
                throw new DomainException("One or more options do not belong to the product.");

            foreach (var opt in matched)
            {
                if (!opt.IsActive)
                    throw DomainException.Conflict($"Option '{opt.Name}' is inactive.");
                item.Options.Add(new OrderItemOption
                {
                    ProductOptionId = opt.Id,
                    GroupName = opt.GroupName,            // SNAPSHOT
                    OptionName = opt.Name,                // SNAPSHOT
                    AdditionalPrice = opt.AdditionalPrice // SNAPSHOT
                });
                optionsTotal += opt.AdditionalPrice;
            }
        }

        item.LineTotal = (item.UnitPrice + optionsTotal) * item.Quantity;
        order.Items.Add(item);
    }

    private static void RecalculateTotals(Order order)
    {
        order.Subtotal = order.Items.Sum(i => i.LineTotal);
        var total = order.Subtotal - order.DiscountAmount;
        order.Total = total < 0 ? 0 : total;
    }

    private static string GenerateOrderNumber()
    {
        // {yyMMdd}-{HHmmss}-{NNN} — race-safe, paired with the (StoreId, OrderNumber) unique index.
        var rnd = Random.Shared.Next(100, 999);
        return $"{DateTime.UtcNow:yyMMdd-HHmmss}-{rnd}";
    }

    private Task<Order?> LoadFullAsync(Guid id, CancellationToken ct) =>
        _db.Orders
            .Include(o => o.Table)
            .Include(o => o.Items).ThenInclude(i => i.Options)
            .Include(o => o.Payments)
            .FirstOrDefaultAsync(o => o.Id == id, ct);

    private static OrderDto Map(Order o) =>
        new(
            o.Id,
            o.OrderNumber,
            o.TableId,
            o.Table?.Name,
            o.Status,
            o.OrderType,
            o.Subtotal,
            o.DiscountAmount,
            o.Total,
            o.CustomerName,
            o.CustomerPhone,
            o.Notes,
            o.CreatedAt,
            o.CompletedAt,
            o.CancelledAt,
            o.Items.Select(MapItem).ToList(),
            o.Payments.OrderBy(p => p.PaidAt).Select(MapPayment).ToList(),
            o.DeliveryAddressSnapshot,
            o.DeliveryDistrict,
            o.FulfillmentStatus,
            o.AssignedCourierUserId,
            o.OutForDeliveryAt,
            o.DeliveredAt,
            o.IncomingCallId);

    private static OrderItemDto MapItem(OrderItem i) =>
        new(
            i.Id,
            i.ProductId,
            i.ProductName,
            i.UnitPrice,
            i.Quantity,
            i.LineTotal,
            i.Notes,
            i.Options.Select(MapOption).ToList());

    private static OrderItemOptionDto MapOption(OrderItemOption o) =>
        new(o.Id, o.ProductOptionId, o.GroupName, o.OptionName, o.AdditionalPrice);

    private static PaymentDto MapPayment(Payment p) =>
        new(p.Id, p.Amount, p.Method, p.PaidAt, p.ReferenceNumber, p.Notes);
}
