using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Services;

namespace PizzaPos.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class ReportsController : TenantControllerBase
{
    private readonly IReportService _service;

    public ReportsController(IReportService service) => _service = service;

    /// <summary>
    /// GET /api/reports/daily-summary?date=2026-05-12
    /// "date" yerel takvim günüdür (kasanın yerel saatine göre). Backend bu
    /// günü 00:00 - 24:00 (yerel) aralığına çevirip UTC'ye normalize eder.
    /// İzole edilmiş bir gün için Z-Rapor benzeri özet döner.
    /// </summary>
    [HttpGet("daily-summary")]
    public async Task<ActionResult<DailySummaryDto>> DailySummary(
        [FromQuery] string? date,
        CancellationToken ct)
    {
        // "date" boşsa kasanın local now'una düş. Format: YYYY-MM-DD.
        var localToday = DateTime.Now;
        var targetLocal = !string.IsNullOrWhiteSpace(date)
            && DateOnly.TryParseExact(
                date.Trim(), "yyyy-MM-dd", out var parsed)
            ? parsed.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified)
            : new DateTime(localToday.Year, localToday.Month, localToday.Day, 0, 0, 0, DateTimeKind.Unspecified);

        var fromUtc = DateTime.SpecifyKind(targetLocal, DateTimeKind.Local).ToUniversalTime();
        var toUtc = DateTime.SpecifyKind(targetLocal.AddDays(1), DateTimeKind.Local).ToUniversalTime();
        var label = targetLocal.ToString("yyyy-MM-dd");

        var summary = await _service.GetDailySummaryAsync(label, fromUtc, toUtc, ct);
        return Ok(summary);
    }

    /// <summary>
    /// GET /api/reports/period-summary?from=2026-05-18&to=2026-05-24&top=5
    /// Yarı-açık [from 00:00, to+1 00:00) yerel → UTC. `to` dahil edilir.
    /// `top` parametresi en çok satan ürün sayısıdır (varsayılan 5).
    /// </summary>
    [HttpGet("period-summary")]
    public async Task<ActionResult<PeriodSummaryDto>> PeriodSummary(
        [FromQuery] string from,
        [FromQuery] string to,
        [FromQuery] int top,
        CancellationToken ct)
    {
        if (!DateOnly.TryParseExact(from?.Trim() ?? "", "yyyy-MM-dd", out var fromDate))
            return BadRequest("'from' YYYY-MM-DD formatında olmalı.");
        if (!DateOnly.TryParseExact(to?.Trim() ?? "", "yyyy-MM-dd", out var toDate))
            return BadRequest("'to' YYYY-MM-DD formatında olmalı.");
        if (toDate < fromDate)
            return BadRequest("'to' tarihi 'from' tarihinden önce olamaz.");

        var fromLocal = fromDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        var toLocalExclusive = toDate.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);

        var fromUtc = DateTime.SpecifyKind(fromLocal, DateTimeKind.Local).ToUniversalTime();
        var toUtc = DateTime.SpecifyKind(toLocalExclusive, DateTimeKind.Local).ToUniversalTime();

        var limit = top > 0 ? top : 5;
        var summary = await _service.GetPeriodSummaryAsync(
            fromDate.ToString("yyyy-MM-dd"),
            toDate.ToString("yyyy-MM-dd"),
            fromUtc, toUtc, limit, ct);
        return Ok(summary);
    }
}
