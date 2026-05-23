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

    public async Task<PeriodSummaryDto> GetPeriodSummaryAsync(
        string fromLabel,
        string toLabel,
        DateTime fromUtc,
        DateTime toUtc,
        int topProductsLimit,
        CancellationToken ct = default)
    {
        var completedOrders = await _db.Orders
            .Where(o => o.Status == OrderStatus.Completed
                     && o.CompletedAt >= fromUtc
                     && o.CompletedAt < toUtc)
            .Select(o => new
            {
                o.Id,
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

        // En çok satan ürünler — sadece tamamlanmış siparişlerin item'larından.
        // Tek bir ProductId için snapshot ProductName farklı olabilir (ürün
        // rename edilmiş eski siparişler ile). GROUP BY sadece ProductId; isim
        // için MIN snapshot. Anonymous projection sonrası DTO'ya map — EF'in
        // record projection çevirisi yamuk olabiliyor.
        var topRaw = await _db.OrderItems
            .Where(i => i.Order!.Status == OrderStatus.Completed
                     && i.Order.CompletedAt >= fromUtc
                     && i.Order.CompletedAt < toUtc)
            .GroupBy(i => i.ProductId)
            .Select(g => new
            {
                ProductId = g.Key,
                ProductName = g.Min(i => i.ProductName) ?? "(silinmiş)",
                Quantity = g.Sum(i => i.Quantity),
                Revenue = g.Sum(i => i.LineTotal),
            })
            .OrderByDescending(r => r.Quantity)
            .Take(Math.Max(1, topProductsLimit))
            .ToListAsync(ct);

        var topProducts = topRaw
            .Select(r => new TopProductRow(r.ProductId, r.ProductName, r.Quantity, r.Revenue))
            .ToList();

        return new PeriodSummaryDto(
            FromDate: fromLabel,
            ToDate: toLabel,
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
            OrderTypeBreakdown: orderTypeBreakdown,
            TopProducts: topProducts);
    }
}
