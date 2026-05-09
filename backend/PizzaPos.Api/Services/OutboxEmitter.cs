using System.Text.Json;
using System.Text.Json.Serialization;
using PizzaPos.Api.Data;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Services;

public class OutboxEmitter : IOutboxEmitter
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private readonly AppDbContext _db;
    private readonly ITenantProvider _tenant;

    public OutboxEmitter(AppDbContext db, ITenantProvider tenant)
    {
        _db = db;
        _tenant = tenant;
    }

    public async Task EmitAsync(
        string aggregateType,
        Guid aggregateId,
        string eventType,
        object payload,
        CancellationToken ct = default)
    {
        // Wrap caller's payload with a stable envelope so the cloud side
        // always knows which tenant the event belongs to.
        var envelope = new
        {
            storeId = _tenant.HasTenant ? _tenant.CurrentStoreId : (Guid?)null,
            data = payload
        };
        var json = JsonSerializer.Serialize(envelope, JsonOpts);

        await _db.OutboxEvents.AddAsync(new OutboxEvent
        {
            Id = Guid.NewGuid(),
            AggregateType = aggregateType,
            AggregateId = aggregateId,
            EventType = eventType,
            PayloadJson = json,
            CreatedAt = DateTime.UtcNow,
            RetryCount = 0
        }, ct);
    }
}
