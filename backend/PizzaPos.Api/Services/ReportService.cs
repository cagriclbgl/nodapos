using Microsoft.EntityFrameworkCore;
using PizzaPos.Api.Data;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Services;

public class ReportService : IReportService
{
    private readonly AppDbContext _db;

    public ReportService(AppDbContext db) => _db = db;

    public async Task<DailySummaryDto> GetDailySummaryAsync(
        string dateLabel, DateTime fromUtc, DateTime toUtc, CancellationToken ct = default)
    {
        // Tamamlanan siparişler — Total / OrderType / Item kırılımı için.
        var completedOrders = await _db.Orders
            .Where(o => o.Status == OrderStatus.Completed
                     && o.CompletedAt >= fromUtc
                     && o.CompletedAt < toUtc)
            .Select(o => new
            {
                o.Total,
                o.DiscountAmount,
                o.OrderType,
                ItemQuantity = o.Items.Sum(i => (int?)i.Quantity) ?? 0,
            })
            .ToListAsync(ct);

        var cancelledCount = await _db.Orders
            .Where(o => o.Status == OrderStatus.Cancelled
                     && o.CancelledAt >= fromUtc
                     && o.CancelledAt < toUtc)
            .CountAsync(ct);

        // Ödeme yöntemi — Payment.PaidAt'e göre filtrelenir (siparişin tamamlanma
        // anı ile aynı transaction'da yazılır, ama farkı kullanıcı senaryolarında
        // payment'in kendi tarihi otorite).
        var paymentRows = await _db.Payments
            .Where(p => p.PaidAt >= fromUtc && p.PaidAt < toUtc)
            .GroupBy(p => p.Method)
            .Select(g => new PaymentMethodBreakdown(g.Key, g.Count(), g.Sum(p => p.Amount)))
            .ToListAsync(ct);

        var orderTypeBreakdown = completedOrders
            .GroupBy(o => o.OrderType)
            .Select(g => new OrderTypeBreakdown(g.Key, g.Count(), g.Sum(o => o.Total)))
            .OrderBy(b => (int)b.OrderType)
            .ToList();

        return new DailySummaryDto(
            Date: dateLabel,
            RangeStartUtc: fromUtc,
            RangeEndUtc: toUtc,
            CompletedOrderCount: completedOrders.Count,
            CancelledOrderCount: cancelledCount,
            TotalRevenue: completedOrders.Sum(o => o.Total),
            TotalDiscount: completedOrders.Sum(o => o.DiscountAmount),
            TotalItemQuantity: completedOrders.Sum(o => o.ItemQuantity),
            PaymentBreakdown: paymentRows
                .OrderBy(p => (int)p.Method)
                .ToList(),
            OrderTypeBreakdown: orderTypeBreakdown);
    }
}
