namespace PizzaPos.Api.Data;

/// <summary>
/// Resolves the current request's tenant (StoreId). Consumed by AppDbContext to
/// drive the multi-tenant Global Query Filter and to stamp StoreId on inserts.
/// </summary>
public interface ITenantProvider
{
    /// <summary>
    /// The StoreId for the current request. Returns Guid.Empty when no tenant
    /// is bound (e.g. health checks, migrations, or super-admin endpoints that
    /// must call IgnoreQueryFilters() explicitly).
    /// </summary>
    Guid CurrentStoreId { get; }

    bool HasTenant { get; }
}
