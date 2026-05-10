using Microsoft.EntityFrameworkCore;
using PizzaPos.Api.Auth;
using PizzaPos.Api.Data;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Services;

public class IncomingCallService : IIncomingCallService
{
    private const int DefaultListLimit = 200;
    private const int MaxListLimit = 500;
    private const int RecentOrdersForModal = 3;

    private readonly AppDbContext _db;
    private readonly ITenantProvider _tenant;
    private readonly ICurrentUserAccessor _currentUser;
    private readonly IOutboxEmitter _outbox;

    public IncomingCallService(
        AppDbContext db,
        ITenantProvider tenant,
        ICurrentUserAccessor currentUser,
        IOutboxEmitter outbox)
    {
        _db = db;
        _tenant = tenant;
        _currentUser = currentUser;
        _outbox = outbox;
    }

    public async Task<IncomingCallDto> RecordAsync(RecordIncomingCallRequest request, CancellationToken ct = default)
    {
        if (!_tenant.HasTenant)
            throw new DomainException("No active store context.");

        var phone = NormalizePhone(request.Phone);
        var receivedAt = request.ReceivedAt ?? DateTime.UtcNow;

        // Numarayı bilinen müşteriyle eşleştir. Customer.Phone formatları
        // arasında küçük tutarsızlıklar olabileceği için hem normalize edilmiş
        // hem de orijinal formla aynı anda eşleştirme dener.
        Customer? matched = null;
        if (!string.IsNullOrWhiteSpace(phone))
        {
            matched = await _db.Customers
                .Include(c => c.Addresses)
                .FirstOrDefaultAsync(c => c.Phone == phone, ct);

            if (matched is null)
            {
                // Telefon formatı tutarsızsa son 7 hane match'i (örn: +905551234567 vs 5551234567).
                var tail = phone.Length >= 7 ? phone[^7..] : phone;
                matched = await _db.Customers
                    .Include(c => c.Addresses)
                    .Where(c => EF.Functions.ILike(c.Phone, "%" + tail))
                    .FirstOrDefaultAsync(ct);
            }
        }

        var call = new IncomingCall
        {
            Phone = phone,
            LineNumber = request.LineNumber,
            ReceivedAt = receivedAt,
            MatchedCustomerId = matched?.Id,
            Status = IncomingCallStatus.New,
            RawPayloadHex = string.IsNullOrWhiteSpace(request.RawPayloadHex)
                ? null
                : request.RawPayloadHex.Trim(),
        };

        _db.IncomingCalls.Add(call);
        await _db.SaveChangesAsync(ct);

        await _outbox.EmitAsync("IncomingCall", call.Id, "IncomingCallReceived",
            new
            {
                call.Id,
                call.StoreId,
                call.Phone,
                call.LineNumber,
                call.ReceivedAt,
                call.MatchedCustomerId,
                status = call.Status,
                call.CreatedAt,
            }, ct);
        await _db.SaveChangesAsync(ct);

        var recentOrders = matched is null
            ? new List<RecentOrderSummaryDto>()
            : await LoadRecentOrdersAsync(matched.Id, matched.Phone, RecentOrdersForModal, ct);

        return Map(call, matched, recentOrders);
    }

    public async Task<IReadOnlyList<IncomingCallDto>> ListAsync(
        DateTime? from,
        DateTime? to,
        IncomingCallStatus? status,
        int? limit,
        CancellationToken ct = default)
    {
        var query = _db.IncomingCalls.AsQueryable();
        if (from.HasValue) query = query.Where(c => c.ReceivedAt >= from.Value);
        if (to.HasValue) query = query.Where(c => c.ReceivedAt <= to.Value);
        if (status.HasValue) query = query.Where(c => c.Status == status.Value);

        var take = Math.Clamp(limit ?? DefaultListLimit, 1, MaxListLimit);

        var rows = await query
            .OrderByDescending(c => c.ReceivedAt)
            .Take(take)
            .ToListAsync(ct);

        // Sadece eşleşen Customer ve son sipariş özetini topluca yükle (N+1 önleme).
        var customerIds = rows
            .Where(r => r.MatchedCustomerId.HasValue)
            .Select(r => r.MatchedCustomerId!.Value)
            .Distinct()
            .ToList();

        var customers = customerIds.Count == 0
            ? new Dictionary<Guid, Customer>()
            : await _db.Customers
                .Include(c => c.Addresses)
                .Where(c => customerIds.Contains(c.Id))
                .ToDictionaryAsync(c => c.Id, ct);

        var orderIds = rows
            .Where(r => r.ResolvedOrderId.HasValue)
            .Select(r => r.ResolvedOrderId!.Value)
            .Distinct()
            .ToList();

        var orders = orderIds.Count == 0
            ? new Dictionary<Guid, RecentOrderSummaryDto>()
            : await _db.Orders
                .Where(o => orderIds.Contains(o.Id))
                .Select(o => new RecentOrderSummaryDto(
                    o.Id, o.OrderNumber, o.CreatedAt, o.Total, o.Status, o.OrderType))
                .ToDictionaryAsync(s => s.Id, ct);

        return rows.Select(c =>
        {
            customers.TryGetValue(c.MatchedCustomerId ?? Guid.Empty, out var cust);
            var orderList = c.ResolvedOrderId.HasValue
                && orders.TryGetValue(c.ResolvedOrderId.Value, out var ord)
                ? new List<RecentOrderSummaryDto> { ord }
                : new List<RecentOrderSummaryDto>();
            return Map(c, cust, orderList);
        }).ToList();
    }

    public async Task<IncomingCallDto?> GetAsync(Guid id, CancellationToken ct = default)
    {
        var call = await _db.IncomingCalls.FirstOrDefaultAsync(c => c.Id == id, ct);
        if (call is null) return null;

        Customer? customer = null;
        if (call.MatchedCustomerId.HasValue)
        {
            customer = await _db.Customers
                .Include(c => c.Addresses)
                .FirstOrDefaultAsync(c => c.Id == call.MatchedCustomerId.Value, ct);
        }

        var recentOrders = customer is null
            ? new List<RecentOrderSummaryDto>()
            : await LoadRecentOrdersAsync(customer.Id, customer.Phone, RecentOrdersForModal, ct);

        return Map(call, customer, recentOrders);
    }

    public async Task<IncomingCallDto> ResolveAsync(
        Guid id, ResolveIncomingCallRequest request, CancellationToken ct = default)
    {
        var call = await _db.IncomingCalls.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw DomainException.NotFound("IncomingCall");

        var newStatus = request.Status
            ?? (request.OrderId.HasValue ? IncomingCallStatus.Handled : call.Status);

        if (request.OrderId.HasValue)
        {
            var orderExists = await _db.Orders.AnyAsync(o => o.Id == request.OrderId.Value, ct);
            if (!orderExists) throw DomainException.NotFound("Order");
            call.ResolvedOrderId = request.OrderId.Value;
            newStatus = IncomingCallStatus.Handled;
        }

        var now = DateTime.UtcNow;
        call.Status = newStatus;
        call.HandledAt = now;
        call.HandledByUserId = _currentUser.UserId;
        call.UpdatedAt = now;

        await _db.SaveChangesAsync(ct);

        await _outbox.EmitAsync("IncomingCall", call.Id, "IncomingCallResolved",
            new
            {
                call.Id,
                call.StoreId,
                status = call.Status,
                call.ResolvedOrderId,
                call.HandledByUserId,
                handledAt = call.HandledAt,
                call.UpdatedAt,
            }, ct);
        await _db.SaveChangesAsync(ct);

        return (await GetAsync(call.Id, ct))!;
    }

    public async Task<IncomingCallDto> UpdateNoteAsync(
        Guid id, UpdateIncomingCallNoteRequest request, CancellationToken ct = default)
    {
        var call = await _db.IncomingCalls.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw DomainException.NotFound("IncomingCall");

        call.Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        call.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _outbox.EmitAsync("IncomingCall", call.Id, "IncomingCallNoteUpdated",
            new
            {
                call.Id,
                call.StoreId,
                call.Note,
                call.UpdatedAt,
            }, ct);
        await _db.SaveChangesAsync(ct);

        return (await GetAsync(call.Id, ct))!;
    }

    // --- helpers ------------------------------------------------------------

    private async Task<List<RecentOrderSummaryDto>> LoadRecentOrdersAsync(
        Guid customerId, string customerPhone, int take, CancellationToken ct)
    {
        return await _db.Orders
            .Where(o => o.CustomerId == customerId || o.CustomerPhone == customerPhone)
            .OrderByDescending(o => o.CreatedAt)
            .Take(take)
            .Select(o => new RecentOrderSummaryDto(
                o.Id, o.OrderNumber, o.CreatedAt, o.Total, o.Status, o.OrderType))
            .ToListAsync(ct);
    }

    /// <summary>
    /// Telefon numarası normalize: tüm boşluk/parantez/tire kaldırılır, sadece
    /// rakamlar ve baştaki + işareti tutulur. "+90 555 123 45 67" → "+905551234567".
    /// "0555..." formatı korunur (Türkiye yerel format) — kullanıcının Customer
    /// tablosunda nasıl tuttuğuna saygı gösterir; LIKE fallback ile son 7 hane
    /// üzerinden gevşek match yine çalışır.
    /// </summary>
    public static string? NormalizePhone(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var trimmed = raw.Trim();
        var sb = new System.Text.StringBuilder(trimmed.Length);
        for (int i = 0; i < trimmed.Length; i++)
        {
            var c = trimmed[i];
            if (i == 0 && c == '+') sb.Append('+');
            else if (char.IsDigit(c)) sb.Append(c);
        }
        return sb.Length == 0 ? null : sb.ToString();
    }

    private static IncomingCallDto Map(
        IncomingCall call,
        Customer? matched,
        IReadOnlyList<RecentOrderSummaryDto> recentOrders)
    {
        CustomerSummaryDto? customer = null;
        if (matched is not null)
        {
            var def = matched.Addresses.FirstOrDefault(a => a.IsDefault)
                   ?? matched.Addresses.FirstOrDefault();
            customer = new CustomerSummaryDto(
                matched.Id,
                matched.Name,
                matched.Phone,
                def?.AddressLine,
                def?.District);
        }

        return new IncomingCallDto(
            call.Id,
            call.Phone,
            call.LineNumber,
            call.ReceivedAt,
            call.Status,
            call.MatchedCustomerId,
            call.ResolvedOrderId,
            call.HandledAt,
            call.Note,
            customer,
            recentOrders);
    }
}
