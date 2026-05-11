using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PizzaPos.Api.Data;
using PizzaPos.Api.Entities;
using PizzaPos.Api.Sync;

namespace PizzaPos.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/sync")]
public class SyncController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly SyncOptions _options;
    private readonly IIngestApplyService _apply;
    private readonly ILogger<SyncController> _logger;

    public SyncController(
        AppDbContext db,
        IOptions<SyncOptions> options,
        IIngestApplyService apply,
        ILogger<SyncController> logger)
    {
        _db = db;
        _options = options.Value;
        _apply = apply;
        _logger = logger;
    }

    public record IngestEventDto(
        Guid Id,
        string AggregateType,
        Guid AggregateId,
        string EventType,
        string PayloadJson,
        DateTime CreatedAt);

    /// <summary>
    /// Cloud-side ingest endpoint. Verifies HMAC signature, then upserts
    /// events idempotently using OutboxEvent.Id as the natural primary key.
    /// </summary>
    [HttpPost("ingest")]
    public async Task<IActionResult> Ingest(CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_options.HmacSecret))
            return StatusCode(503, "Sync HMAC secret not configured.");

        Request.EnableBuffering();
        using var ms = new MemoryStream();
        await Request.Body.CopyToAsync(ms, ct);
        var bytes = ms.ToArray();
        Request.Body.Position = 0;

        var sig = Request.Headers[HmacSignature.HeaderName].ToString();
        if (!HmacSignature.Verify(_options.HmacSecret, bytes, sig))
            return Unauthorized();

        var events = JsonSerializer.Deserialize<List<IngestEventDto>>(
            bytes,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (events is null || events.Count == 0)
            return Ok(new { ingested = 0, skipped = 0 });

        var ids = events.Select(e => e.Id).ToList();
        var existing = await _db.OutboxEvents
            .Where(e => ids.Contains(e.Id))
            .Select(e => e.Id)
            .ToListAsync(ct);

        var fresh = events
            .Where(e => !existing.Contains(e.Id))
            .Select(e => new OutboxEvent
            {
                Id = e.Id,
                AggregateType = e.AggregateType,
                AggregateId = e.AggregateId,
                EventType = e.EventType,
                PayloadJson = e.PayloadJson,
                CreatedAt = e.CreatedAt,
                // Cloud-side rows are inbound — already "delivered" here.
                SentAt = DateTime.UtcNow
            })
            .ToList();

        if (fresh.Count > 0)
        {
            _db.OutboxEvents.AddRange(fresh);
            await _db.SaveChangesAsync(ct);
        }

        // Apply each freshly-ingested event into the actual entity tables
        // (Order/Customer/etc.). Failures are recorded on the row but do NOT
        // cause the whole ingest to fail — the kasa already has the event in
        // its outbox marked Sent, so re-delivery isn't going to retry. A
        // background worker (future) can sweep ApplyError != null rows.
        var applied = 0;
        var failed = 0;
        foreach (var row in fresh)
        {
            var result = await _apply.ApplyAsync(row, ct);
            if (result.Success)
            {
                row.AppliedAt = DateTime.UtcNow;
                row.ApplyError = null;
                applied++;
            }
            else
            {
                row.ApplyError = result.Error;
                failed++;
                _logger.LogWarning(
                    "IngestApply failure: event {Id} ({Type}) — {Error}",
                    row.Id, row.EventType, result.Error);
            }
        }
        if (fresh.Count > 0) await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            ingested = fresh.Count,
            skipped = existing.Count,
            applied,
            applyFailed = failed,
        });
    }

    /// <summary>
    /// Pull endpoint for the kasa to fetch manager-write-domain changes plus
    /// bidirectional Customer/CustomerAddress rows. Authenticated via HMAC over
    /// (path + query string) — there's no body to sign on a GET.
    ///
    /// Returns rows where (UpdatedAt ?? CreatedAt) > since. First call passes
    /// since=null to pull everything (bootstrap). Tenant filters bypassed —
    /// kasa is the only caller and HMAC is the trust anchor.
    /// </summary>
    [HttpGet("changes")]
    public async Task<IActionResult> Changes(
        [FromQuery] DateTime? since,
        [FromQuery] string? aggregates,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_options.HmacSecret))
            return StatusCode(503, "Sync HMAC secret not configured.");

        // Sign the path + raw query string so the kasa can't be tricked into
        // requesting a different aggregate set or window via URL tampering.
        var pathAndQuery = Request.Path.Value + (Request.QueryString.HasValue ? Request.QueryString.Value : "");
        var sig = Request.Headers[HmacSignature.HeaderName].ToString();
        var bytes = System.Text.Encoding.UTF8.GetBytes(pathAndQuery!);
        if (!HmacSignature.Verify(_options.HmacSecret, bytes, sig))
            return Unauthorized();

        var serverNow = DateTime.UtcNow;
        var sinceUtc = since;
        var wanted = (aggregates ?? "Product,Category,Store,User,Customer,CustomerAddress,Combo")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => s.ToLowerInvariant())
            .ToHashSet();

        var result = new Dictionary<string, object>();

        if (wanted.Contains("store"))
        {
            var q = _db.Stores.IgnoreQueryFilters().AsQueryable();
            if (sinceUtc.HasValue) q = q.Where(x => (x.UpdatedAt ?? x.CreatedAt) > sinceUtc.Value);
            result["stores"] = await q.ToListAsync(ct);
        }
        if (wanted.Contains("category"))
        {
            var q = _db.Categories.IgnoreQueryFilters().AsQueryable();
            if (sinceUtc.HasValue) q = q.Where(x => (x.UpdatedAt ?? x.CreatedAt) > sinceUtc.Value);
            result["categories"] = await q.ToListAsync(ct);
        }
        if (wanted.Contains("product"))
        {
            var q = _db.Products.IgnoreQueryFilters().Include(p => p.Options).AsQueryable();
            if (sinceUtc.HasValue) q = q.Where(x => (x.UpdatedAt ?? x.CreatedAt) > sinceUtc.Value);
            result["products"] = await q.ToListAsync(ct);
        }
        if (wanted.Contains("combo"))
        {
            // Combo is cloud-owned (Manager-only writes). Items collection is
            // included so the kasa gets the full slot definition in one call.
            var q = _db.Combos.IgnoreQueryFilters().Include(c => c.Items).AsQueryable();
            if (sinceUtc.HasValue) q = q.Where(x => (x.UpdatedAt ?? x.CreatedAt) > sinceUtc.Value);
            result["combos"] = await q.ToListAsync(ct);
        }
        if (wanted.Contains("user"))
        {
            // Strip PasswordHash before serializing — kasa only needs identity
            // metadata for audit-trail snapshots, never the credential material.
            var q = _db.Users.IgnoreQueryFilters().AsQueryable();
            if (sinceUtc.HasValue) q = q.Where(x => (x.UpdatedAt ?? x.CreatedAt) > sinceUtc.Value);
            result["users"] = await q.Select(u => new
            {
                u.Id,
                u.StoreId,
                u.Username,
                u.FullName,
                u.Role,
                u.IsActive,
                u.CreatedAt,
                u.UpdatedAt
            }).ToListAsync(ct);
        }
        if (wanted.Contains("customer"))
        {
            var q = _db.Customers.IgnoreQueryFilters().AsQueryable();
            if (sinceUtc.HasValue) q = q.Where(x => (x.UpdatedAt ?? x.CreatedAt) > sinceUtc.Value);
            result["customers"] = await q.ToListAsync(ct);
        }
        if (wanted.Contains("customeraddress"))
        {
            var q = _db.CustomerAddresses.IgnoreQueryFilters().AsQueryable();
            if (sinceUtc.HasValue) q = q.Where(x => (x.UpdatedAt ?? x.CreatedAt) > sinceUtc.Value);
            result["customerAddresses"] = await q.ToListAsync(ct);
        }

        return Ok(new { since = sinceUtc, now = serverNow, data = result });
    }
}
