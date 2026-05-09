namespace PizzaPos.Api.Entities;

/// <summary>
/// Global outbox table — NOT tenant-scoped. Each row represents a domain event
/// emitted by the local kasa instance that the SyncWorker relays to the cloud
/// Supabase mirror. Idempotent on the cloud side (Id is unique).
/// </summary>
public class OutboxEvent : BaseEntity
{
    public string AggregateType { get; set; } = string.Empty;
    public Guid AggregateId { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = string.Empty;

    public DateTime? SentAt { get; set; }
    public int RetryCount { get; set; }
    public string? LastError { get; set; }
    public DateTime? LastAttemptAt { get; set; }
}
