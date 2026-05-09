using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PizzaPos.Api.Data;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Sync;

/// <summary>
/// Polls outbox_events and POSTs unsent rows to the cloud /api/sync/ingest
/// endpoint. SentAt is stamped on success; failures bump RetryCount and
/// schedule the next attempt with exponential backoff (max 300s, max 10 retries).
/// </summary>
public class SyncWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHttpClientFactory _httpFactory;
    private readonly SyncOptions _options;
    private readonly ILogger<SyncWorker> _logger;

    public SyncWorker(
        IServiceScopeFactory scopeFactory,
        IHttpClientFactory httpFactory,
        IOptions<SyncOptions> options,
        ILogger<SyncWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _httpFactory = httpFactory;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled || string.IsNullOrWhiteSpace(_options.CloudBaseUrl))
        {
            _logger.LogInformation(
                "SyncWorker disabled or CloudBaseUrl missing — exiting (enabled={Enabled}, url={Url}).",
                _options.Enabled, _options.CloudBaseUrl);
            return;
        }

        var pollDelay = TimeSpan.FromSeconds(Math.Max(1, _options.PollingSeconds));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessBatchAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SyncWorker batch failed");
            }

            try { await Task.Delay(pollDelay, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task ProcessBatchAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Pull unsent rows; eligibility filter (backoff) computed in-memory
        // because EF.Functions.DateDiffSecond is provider-specific.
        var unsent = await db.OutboxEvents
            .Where(e => e.SentAt == null && e.RetryCount < 10)
            .OrderBy(e => e.CreatedAt)
            .Take(Math.Max(1, _options.BatchSize) * 4)
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        var batch = unsent
            .Where(e => e.LastAttemptAt is null
                || (now - e.LastAttemptAt.Value).TotalSeconds >= ComputeBackoffSeconds(e.RetryCount))
            .Take(Math.Max(1, _options.BatchSize))
            .ToList();

        if (batch.Count == 0) return;

        var http = _httpFactory.CreateClient();
        http.BaseAddress = new Uri(_options.CloudBaseUrl.TrimEnd('/') + "/");
        http.Timeout = TimeSpan.FromSeconds(30);

        var body = JsonSerializer.SerializeToUtf8Bytes(
            batch.Select(e => new
            {
                id = e.Id,
                aggregateType = e.AggregateType,
                aggregateId = e.AggregateId,
                eventType = e.EventType,
                payloadJson = e.PayloadJson,
                createdAt = e.CreatedAt
            }));

        using var msg = new HttpRequestMessage(HttpMethod.Post, "api/sync/ingest")
        {
            Content = new ByteArrayContent(body)
        };
        msg.Content.Headers.ContentType =
            new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");
        msg.Headers.TryAddWithoutValidation(
            HmacSignature.HeaderName, HmacSignature.Compute(_options.HmacSecret, body));

        try
        {
            var resp = await http.SendAsync(msg, ct);
            if (resp.IsSuccessStatusCode)
            {
                var sentAt = DateTime.UtcNow;
                foreach (var e in batch) e.SentAt = sentAt;
                await db.SaveChangesAsync(ct);
                _logger.LogInformation("SyncWorker delivered {Count} events", batch.Count);
            }
            else
            {
                await MarkFailureAsync(db, batch, $"HTTP {(int)resp.StatusCode}", ct);
            }
        }
        catch (Exception ex)
        {
            await MarkFailureAsync(db, batch, ex.Message, ct);
        }
    }

    private static int ComputeBackoffSeconds(int retry) =>
        Math.Min((int)Math.Pow(2, Math.Min(retry, 8)), 300);

    private static async Task MarkFailureAsync(
        AppDbContext db, List<OutboxEvent> batch, string error, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var truncated = error.Length > 500 ? error[..500] : error;
        foreach (var e in batch)
        {
            e.RetryCount++;
            e.LastError = truncated;
            e.LastAttemptAt = now;
        }
        await db.SaveChangesAsync(ct);
    }
}
