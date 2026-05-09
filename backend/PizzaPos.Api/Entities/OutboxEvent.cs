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

    // Kasa-side delivery tracking (push: outbox → cloud).
    public DateTime? SentAt { get; set; }
    public int RetryCount { get; set; }
    public string? LastError { get; set; }
    public DateTime? LastAttemptAt { get; set; }

    // Cloud-side apply tracking. SentAt is stamped by Ingest as "stored in
    // outbox table"; AppliedAt is stamped only when the event has been
    // materialized into the actual Order/Customer/etc. row(s). NULL on the
    // kasa side, populated only on the cloud mirror after a successful
    // IngestApplyService run.
    public DateTime? AppliedAt { get; set; }
    public string? ApplyError { get; set; }
}
