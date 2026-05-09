namespace PizzaPos.Api.Services;

public interface IOutboxEmitter
{
    /// <summary>
    /// Adds an OutboxEvent to the change tracker. Caller is responsible for
    /// committing the surrounding SaveChangesAsync / transaction so the event
    /// is persisted atomically with the domain write.
    /// </summary>
    Task EmitAsync(
        string aggregateType,
        Guid aggregateId,
        string eventType,
        object payload,
        CancellationToken ct = default);
}
