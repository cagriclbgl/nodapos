namespace PizzaPos.Api.Entities;

/// <summary>
/// Kasa-only state row. Tracks the last successful pull timestamp per
/// aggregate type so SyncPullWorker can request only fresh changes from cloud
/// (incremental pull). On a fresh install LastPulledAt is null and the worker
/// requests since=null which the cloud interprets as "send everything".
///
/// Cloud Postgres carries this table too (single shared schema) but never
/// reads or writes it — the cloud-side ingest path is push-only.
/// </summary>
public class SyncState : BaseEntity
{
    public string AggregateType { get; set; } = string.Empty;
    public DateTime? LastPulledAt { get; set; }
}
