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
}
