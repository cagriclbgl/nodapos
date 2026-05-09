using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PizzaPos.Api.Data;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Sync;

/// <summary>
/// Kasa-side companion to <see cref="SyncWorker"/>. Pulls cloud-owned aggregates
/// (Product, Category, Store, User, Customer, CustomerAddress) every
/// <c>Sync:PullPollingSeconds</c> seconds and upserts them into the local SQLite
/// store. Last-pulled timestamp is persisted per aggregate in <c>sync_states</c>
/// so subsequent calls only fetch deltas. First run pulls everything (since=null).
///
/// Customer/CustomerAddress are bidirectional: the local row is overwritten only
/// when the cloud copy has a strictly newer UpdatedAt (last-writer-wins).
/// Read-only aggregates (Product, Category, Store, User) are unconditionally
/// upserted — cloud is the single source of truth.
/// </summary>
public class SyncPullWorker : BackgroundService
{
    private static readonly string[] DefaultAggregates =
        { "Store", "Category", "Product", "User", "Customer", "CustomerAddress" };

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHttpClientFactory _httpFactory;
    private readonly SyncOptions _options;
    private readonly ILogger<SyncPullWorker> _logger;

    public SyncPullWorker(
        IServiceScopeFactory scopeFactory,
        IHttpClientFactory httpFactory,
        IOptions<SyncOptions> options,
        ILogger<SyncPullWorker> logger)
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
                "SyncPullWorker disabled or CloudBaseUrl missing — exiting (enabled={Enabled}, url={Url}).",
                _options.Enabled, _options.CloudBaseUrl);
            return;
        }

        var pollDelay = TimeSpan.FromSeconds(Math.Max(5, _options.PullPollingSeconds));

        // Stagger first run so the push worker doesn't fire at the exact same instant.
        try { await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PullOnceAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SyncPullWorker tick failed");
            }

            try { await Task.Delay(pollDelay, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task PullOnceAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // We send a single "since" — the oldest of all tracked aggregates — so
        // a brand-new aggregate type added later still gets a full backfill.
        var states = await db.SyncStates.ToListAsync(ct);
        var stateByType = states.ToDictionary(s => s.AggregateType, s => s, StringComparer.OrdinalIgnoreCase);
        DateTime? since = null;
        foreach (var t in DefaultAggregates)
        {
            if (!stateByType.TryGetValue(t, out var s) || s.LastPulledAt is null)
            {
                since = null; // missing aggregate → full pull
                break;
            }
            if (since is null || s.LastPulledAt < since) since = s.LastPulledAt;
        }

        var aggregates = string.Join(',', DefaultAggregates);
        var path = "/api/sync/changes";
        var query = $"?aggregates={Uri.EscapeDataString(aggregates)}"
                  + (since.HasValue ? $"&since={Uri.EscapeDataString(since.Value.ToString("o"))}" : "");
        var pathAndQuery = path + query;

        var http = _httpFactory.CreateClient();
        http.BaseAddress = new Uri(_options.CloudBaseUrl.TrimEnd('/') + "/");
        http.Timeout = TimeSpan.FromSeconds(60);

        using var msg = new HttpRequestMessage(HttpMethod.Get, "api/sync/changes" + query);
        msg.Headers.TryAddWithoutValidation(
            HmacSignature.HeaderName,
            HmacSignature.Compute(_options.HmacSecret, System.Text.Encoding.UTF8.GetBytes(pathAndQuery)));
        msg.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        HttpResponseMessage resp;
        try
        {
            resp = await http.SendAsync(msg, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "SyncPullWorker HTTP call failed");
            return;
        }

        if (!resp.IsSuccessStatusCode)
        {
            _logger.LogWarning("SyncPullWorker HTTP {Status} — {Reason}",
                (int)resp.StatusCode, resp.ReasonPhrase);
            return;
        }

        var bodyStream = await resp.Content.ReadAsStreamAsync(ct);
        var doc = await JsonDocument.ParseAsync(bodyStream, cancellationToken: ct);

        // Cloud returns the wall-clock instant it computed the delta against.
        // Persisting that (rather than DateTime.UtcNow on the kasa) avoids
        // missing rows whose CreatedAt straddles clock-skew between the two.
        var serverNow = doc.RootElement.TryGetProperty("now", out var nowProp) && nowProp.ValueKind == JsonValueKind.String
            ? DateTime.Parse(nowProp.GetString()!, null, System.Globalization.DateTimeStyles.RoundtripKind)
            : DateTime.UtcNow;

        if (!doc.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object)
        {
            _logger.LogWarning("SyncPullWorker: response missing 'data' object");
            return;
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var totalApplied = 0;

        if (data.TryGetProperty("stores", out var stores))
            totalApplied += await UpsertSimpleAsync<Store>(db, stores, ct);
        if (data.TryGetProperty("categories", out var cats))
            totalApplied += await UpsertSimpleAsync<Category>(db, cats, ct);
        if (data.TryGetProperty("products", out var prods))
            totalApplied += await UpsertProductsAsync(db, prods, ct);
        if (data.TryGetProperty("users", out var users))
            totalApplied += await UpsertSimpleAsync<User>(db, users, ct);
        if (data.TryGetProperty("customers", out var customers))
            totalApplied += await UpsertCustomersAsync(db, customers, ct);
        if (data.TryGetProperty("customerAddresses", out var addrs))
            totalApplied += await UpsertCustomerAddressesAsync(db, addrs, ct);

        // Stamp every aggregate type — even those with zero rows — so an idle
        // aggregate doesn't drag the global "since" back to its old value.
        foreach (var t in DefaultAggregates)
        {
            if (stateByType.TryGetValue(t, out var s))
            {
                s.LastPulledAt = serverNow;
                s.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                db.SyncStates.Add(new SyncState
                {
                    AggregateType = t,
                    LastPulledAt = serverNow
                });
            }
        }

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        if (totalApplied > 0)
            _logger.LogInformation("SyncPullWorker applied {Count} row(s)", totalApplied);
    }

    // --- Upsert helpers -----------------------------------------------------

    /// <summary>
    /// Generic upsert for read-only aggregates (cloud-owned). Deserializes each
    /// element to T and applies it directly. Tenant filters are bypassed via
    /// IgnoreQueryFilters() because pull operates outside any HTTP request scope.
    /// </summary>
    private static async Task<int> UpsertSimpleAsync<T>(
        AppDbContext db, JsonElement arr, CancellationToken ct)
        where T : BaseEntity
    {
        if (arr.ValueKind != JsonValueKind.Array || arr.GetArrayLength() == 0) return 0;

        var json = arr.GetRawText();
        var rows = JsonSerializer.Deserialize<List<T>>(json, _jsonOpts) ?? new();
        if (rows.Count == 0) return 0;

        var ids = rows.Select(r => r.Id).ToList();
        var existing = await db.Set<T>().IgnoreQueryFilters()
            .Where(e => ids.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id, ct);

        foreach (var row in rows)
        {
            if (existing.TryGetValue(row.Id, out var local))
                db.Entry(local).CurrentValues.SetValues(row);
            else
                db.Set<T>().Add(row);
        }
        return rows.Count;
    }

    private static async Task<int> UpsertProductsAsync(
        AppDbContext db, JsonElement arr, CancellationToken ct)
    {
        if (arr.ValueKind != JsonValueKind.Array || arr.GetArrayLength() == 0) return 0;

        // Cloud serializes Product with its Options collection. Replace
        // option set wholesale rather than diffing (cloud is source of truth).
        var products = JsonSerializer.Deserialize<List<Product>>(arr.GetRawText(), _jsonOpts) ?? new();
        if (products.Count == 0) return 0;

        var ids = products.Select(p => p.Id).ToList();
        var existing = await db.Products.IgnoreQueryFilters()
            .Include(p => p.Options)
            .Where(p => ids.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, ct);

        foreach (var p in products)
        {
            if (existing.TryGetValue(p.Id, out var local))
            {
                db.Entry(local).CurrentValues.SetValues(p);
                db.ProductOptions.RemoveRange(local.Options);
                local.Options.Clear();
                foreach (var opt in p.Options)
                    local.Options.Add(opt);
            }
            else
            {
                db.Products.Add(p);
            }
        }
        return products.Count;
    }

    /// <summary>
    /// Customer is bidirectional. Apply cloud copy only when its UpdatedAt
    /// (or CreatedAt as fallback) is strictly newer than local — last-writer-wins.
    /// </summary>
    private static async Task<int> UpsertCustomersAsync(
        AppDbContext db, JsonElement arr, CancellationToken ct)
    {
        if (arr.ValueKind != JsonValueKind.Array || arr.GetArrayLength() == 0) return 0;

        var rows = JsonSerializer.Deserialize<List<Customer>>(arr.GetRawText(), _jsonOpts) ?? new();
        if (rows.Count == 0) return 0;

        var ids = rows.Select(r => r.Id).ToList();
        var existing = await db.Customers.IgnoreQueryFilters()
            .Where(c => ids.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, ct);

        var applied = 0;
        foreach (var row in rows)
        {
            if (existing.TryGetValue(row.Id, out var local))
            {
                if (Stamp(row) <= Stamp(local)) continue; // local is newer/equal — keep it
                db.Entry(local).CurrentValues.SetValues(row);
            }
            else
            {
                db.Customers.Add(row);
            }
            applied++;
        }
        return applied;
    }

    private static async Task<int> UpsertCustomerAddressesAsync(
        AppDbContext db, JsonElement arr, CancellationToken ct)
    {
        if (arr.ValueKind != JsonValueKind.Array || arr.GetArrayLength() == 0) return 0;

        var rows = JsonSerializer.Deserialize<List<CustomerAddress>>(arr.GetRawText(), _jsonOpts) ?? new();
        if (rows.Count == 0) return 0;

        var ids = rows.Select(r => r.Id).ToList();
        var existing = await db.CustomerAddresses.IgnoreQueryFilters()
            .Where(a => ids.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id, ct);

        var applied = 0;
        foreach (var row in rows)
        {
            if (existing.TryGetValue(row.Id, out var local))
            {
                if (Stamp(row) <= Stamp(local)) continue;
                db.Entry(local).CurrentValues.SetValues(row);
            }
            else
            {
                db.CustomerAddresses.Add(row);
            }
            applied++;
        }
        return applied;
    }

    private static DateTime Stamp(BaseEntity e) => e.UpdatedAt ?? e.CreatedAt;

    private static readonly JsonSerializerOptions _jsonOpts = new()
    {
        PropertyNameCaseInsensitive = true
    };
}
