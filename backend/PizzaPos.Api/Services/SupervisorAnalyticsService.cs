using Microsoft.EntityFrameworkCore;
using PizzaPos.Api.Data;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Services;

public class SupervisorAnalyticsService : ISupervisorAnalyticsService
{
    private readonly AppDbContext _db;

    public SupervisorAnalyticsService(AppDbContext db) => _db = db;

    public async Task<SupervisorTodaySummaryDto> GetTodayAsync(int tzOffsetMinutes, CancellationToken ct = default)
    {
        var (fromUtc, toUtc) = TodayRange(tzOffsetMinutes);

        var stores = await _db.Stores
            .IgnoreQueryFilters()
            .OrderBy(s => s.Name)
            .Select(s => new { s.Id, s.Name, s.IsActive })
            .ToListAsync(ct);

        var paymentAgg = await _db.Payments
            .IgnoreQueryFilters()
            .Where(p => p.PaidAt >= fromUtc && p.PaidAt < toUtc)
            .GroupBy(p => p.StoreId)
            .Select(g => new
            {
                StoreId = g.Key,
                Revenue = g.Sum(p => p.Amount),
                OrderCount = g.Select(p => p.OrderId).Distinct().Count(),
                LastPaymentAt = g.Max(p => (DateTime?)p.PaidAt)
            })
            .ToDictionaryAsync(x => x.StoreId, ct);

        var openAgg = await _db.Orders
            .IgnoreQueryFilters()
            .Where(o => o.Status == OrderStatus.Active)
            .GroupBy(o => o.StoreId)
            .Select(g => new { StoreId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StoreId, x => x.Count, ct);

        var userCounts = await _db.Users
            .IgnoreQueryFilters()
            .GroupBy(u => u.StoreId)
            .Select(g => new { StoreId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StoreId, x => x.Count, ct);

        var lifetimeCompleted = await _db.Orders
            .IgnoreQueryFilters()
            .Where(o => o.Status == OrderStatus.Completed)
            .GroupBy(o => o.StoreId)
            .Select(g => new { StoreId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StoreId, x => x.Count, ct);

        var rows = stores.Select(s =>
        {
            paymentAgg.TryGetValue(s.Id, out var pa);
            openAgg.TryGetValue(s.Id, out var oc);
            userCounts.TryGetValue(s.Id, out var uc);
            lifetimeCompleted.TryGetValue(s.Id, out var lc);
            var rev = pa?.Revenue ?? 0m;
            var ord = pa?.OrderCount ?? 0;
            return new StoreTodayRowDto(
                s.Id, s.Name, s.IsActive,
                rev, ord,
                ord > 0 ? rev / ord : 0m,
                oc, pa?.LastPaymentAt,
                uc, lc);
        }).ToList();

        var totalRev = rows.Sum(r => r.Revenue);
        var totalOrd = rows.Sum(r => r.OrderCount);
        var activeStoreCount = rows.Count(r => r.OrderCount > 0);

        return new SupervisorTodaySummaryDto(
            fromUtc, toUtc,
            totalRev, totalOrd,
            totalOrd > 0 ? totalRev / totalOrd : 0m,
            activeStoreCount, stores.Count,
            rows);
    }

    public async Task<SupervisorRevenueTrendDto> GetRevenueTrendAsync(int days, int tzOffsetMinutes, CancellationToken ct = default)
    {
        days = Math.Clamp(days, 1, 90);
        var (todayStartUtc, todayEndUtc) = TodayRange(tzOffsetMinutes);
        var fromUtc = todayStartUtc.AddDays(-(days - 1));
        var toUtc = todayEndUtc;
        var offset = TimeSpan.FromMinutes(tzOffsetMinutes);

        var payments = await _db.Payments
            .IgnoreQueryFilters()
            .Where(p => p.PaidAt >= fromUtc && p.PaidAt < toUtc)
            .Select(p => new { p.PaidAt, p.Amount, p.OrderId })
            .ToListAsync(ct);

        var byDay = payments
            .GroupBy(p => DateOnly.FromDateTime((p.PaidAt + offset).Date))
            .ToDictionary(g => g.Key, g => new
            {
                Revenue = g.Sum(x => x.Amount),
                OrderCount = g.Select(x => x.OrderId).Distinct().Count()
            });

        var firstLocalDay = (fromUtc + offset).Date;
        var points = new List<RevenueTrendPointDto>(days);
        for (int i = 0; i < days; i++)
        {
            var date = DateOnly.FromDateTime(firstLocalDay.AddDays(i));
            byDay.TryGetValue(date, out var agg);
            points.Add(new RevenueTrendPointDto(
                date.ToString("yyyy-MM-dd"),
                agg?.Revenue ?? 0m,
                agg?.OrderCount ?? 0));
        }

        return new SupervisorRevenueTrendDto(days, points);
    }

    public async Task<StoreAnalyticsDto?> GetStoreAnalyticsAsync(Guid storeId, string period, int tzOffsetMinutes, CancellationToken ct = default)
    {
        var store = await _db.Stores
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.Id == storeId, ct);
        if (store is null) return null;

        period = string.IsNullOrWhiteSpace(period) ? "today" : period.Trim().ToLowerInvariant();
        var (fromUtc, toUtc) = PeriodRange(period, tzOffsetMinutes);
        var offset = TimeSpan.FromMinutes(tzOffsetMinutes);

        var payments = await _db.Payments
            .IgnoreQueryFilters()
            .Where(p => p.StoreId == storeId && p.PaidAt >= fromUtc && p.PaidAt < toUtc)
            .Select(p => new { p.PaidAt, p.Amount, p.OrderId, p.Method })
            .ToListAsync(ct);

        var revenue = payments.Sum(p => p.Amount);
        var orderCount = payments.Select(p => p.OrderId).Distinct().Count();

        var openOrderCount = await _db.Orders
            .IgnoreQueryFilters()
            .CountAsync(o => o.StoreId == storeId && o.Status == OrderStatus.Active, ct);

        var cancelledCount = await _db.Orders
            .IgnoreQueryFilters()
            .CountAsync(o => o.StoreId == storeId
                && o.Status == OrderStatus.Cancelled
                && o.CancelledAt >= fromUtc
                && o.CancelledAt < toUtc, ct);

        List<HourlyPointDto> hourly;
        List<RevenueTrendPointDto> daily;
        if (period == "today")
        {
            var hourGroups = payments
                .GroupBy(p => (p.PaidAt + offset).Hour)
                .ToDictionary(g => g.Key, g => new
                {
                    Revenue = g.Sum(x => x.Amount),
                    OrderCount = g.Select(x => x.OrderId).Distinct().Count()
                });
            hourly = Enumerable.Range(0, 24).Select(h =>
            {
                hourGroups.TryGetValue(h, out var agg);
                return new HourlyPointDto(h, agg?.Revenue ?? 0m, agg?.OrderCount ?? 0);
            }).ToList();
            daily = new List<RevenueTrendPointDto>();
        }
        else
        {
            hourly = new List<HourlyPointDto>();
            int days = period == "30d" ? 30 : 7;
            var byDay = payments
                .GroupBy(p => DateOnly.FromDateTime((p.PaidAt + offset).Date))
                .ToDictionary(g => g.Key, g => new
                {
                    Revenue = g.Sum(x => x.Amount),
                    OrderCount = g.Select(x => x.OrderId).Distinct().Count()
                });
            var firstLocalDay = (fromUtc + offset).Date;
            daily = Enumerable.Range(0, days).Select(i =>
            {
                var date = DateOnly.FromDateTime(firstLocalDay.AddDays(i));
                byDay.TryGetValue(date, out var agg);
                return new RevenueTrendPointDto(
                    date.ToString("yyyy-MM-dd"),
                    agg?.Revenue ?? 0m,
                    agg?.OrderCount ?? 0);
            }).ToList();
        }

        // Completed order ID'leri önce çek — OrderItems üzerinde navigation
        // üzerinden join + composite GroupBy + record-pozisyonel projection
        // EF Core 9 PG provider'ında translate edilemiyor; iki adımlı plan
        // hem güvenli hem yeterince hızlı (günlük < birkaç bin order).
        var completedOrderIds = await _db.Orders
            .IgnoreQueryFilters()
            .Where(o => o.StoreId == storeId
                && o.Status == OrderStatus.Completed
                && o.CompletedAt >= fromUtc
                && o.CompletedAt < toUtc)
            .Select(o => o.Id)
            .ToListAsync(ct);

        List<TopProductDto> topProducts;
        if (completedOrderIds.Count == 0)
        {
            topProducts = new List<TopProductDto>();
        }
        else
        {
            var topProductRows = await _db.OrderItems
                .IgnoreQueryFilters()
                .Where(oi => oi.StoreId == storeId && completedOrderIds.Contains(oi.OrderId))
                .GroupBy(oi => new { oi.ProductId, oi.ProductName })
                .Select(g => new
                {
                    g.Key.ProductId,
                    g.Key.ProductName,
                    Quantity = g.Sum(x => x.Quantity),
                    Revenue = g.Sum(x => x.LineTotal),
                })
                .OrderByDescending(x => x.Quantity)
                .Take(10)
                .ToListAsync(ct);

            topProducts = topProductRows
                .Select(r => new TopProductDto(r.ProductId, r.ProductName, r.Quantity, r.Revenue))
                .ToList();
        }

        var openOrders = period == "today"
            ? await _db.Orders
                .IgnoreQueryFilters()
                .Where(o => o.StoreId == storeId && o.Status == OrderStatus.Active)
                .OrderByDescending(o => o.CreatedAt)
                .Take(20)
                .Select(o => new OpenOrderRowDto(
                    o.Id,
                    o.OrderNumber,
                    o.OrderType,
                    o.Total,
                    o.Table != null ? o.Table.Name : null,
                    o.CustomerName,
                    o.CreatedAt,
                    o.FulfillmentStatus))
                .ToListAsync(ct)
            : new List<OpenOrderRowDto>();

        var paymentBreakdown = payments
            .GroupBy(p => p.Method)
            .Select(g => new PaymentMethodBreakdown(
                g.Key,
                g.Select(x => x.OrderId).Distinct().Count(),
                g.Sum(x => x.Amount)))
            .OrderBy(b => (int)b.Method)
            .ToList();

        // EF Core 9 PG provider GroupBy + record-pozisyonel projection
        // ikilisini çeviremiyor; anonymous type ile materialize edip
        // in-memory DTO'ya çeviriyoruz.
        var orderTypeRows = await _db.Orders
            .IgnoreQueryFilters()
            .Where(o => o.StoreId == storeId
                && o.Status == OrderStatus.Completed
                && o.CompletedAt >= fromUtc
                && o.CompletedAt < toUtc)
            .GroupBy(o => o.OrderType)
            .Select(g => new
            {
                OrderType = g.Key,
                Count = g.Count(),
                Total = g.Sum(x => x.Total),
            })
            .ToListAsync(ct);

        var orderTypeBreakdown = orderTypeRows
            .Select(x => new OrderTypeBreakdown(x.OrderType, x.Count, x.Total))
            .OrderBy(b => (int)b.OrderType)
            .ToList();

        return new StoreAnalyticsDto(
            store.Id, store.Name, period,
            fromUtc, toUtc,
            revenue, orderCount,
            orderCount > 0 ? revenue / orderCount : 0m,
            openOrderCount, cancelledCount,
            hourly, daily,
            topProducts, openOrders,
            paymentBreakdown, orderTypeBreakdown);
    }

    private static (DateTime fromUtc, DateTime toUtc) TodayRange(int tzOffsetMinutes)
    {
        var offset = TimeSpan.FromMinutes(tzOffsetMinutes);
        var nowLocal = DateTime.UtcNow + offset;
        var localMidnight = new DateTime(nowLocal.Year, nowLocal.Month, nowLocal.Day, 0, 0, 0, DateTimeKind.Unspecified);
        var fromUtc = DateTime.SpecifyKind(localMidnight - offset, DateTimeKind.Utc);
        return (fromUtc, fromUtc.AddDays(1));
    }

    private static (DateTime fromUtc, DateTime toUtc) PeriodRange(string period, int tzOffsetMinutes)
    {
        var (todayStart, todayEnd) = TodayRange(tzOffsetMinutes);
        return period switch
        {
            "30d" => (todayStart.AddDays(-29), todayEnd),
            "7d" => (todayStart.AddDays(-6), todayEnd),
            _ => (todayStart, todayEnd),
        };
    }
}
