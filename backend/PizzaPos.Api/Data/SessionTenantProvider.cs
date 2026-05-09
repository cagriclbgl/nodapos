using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace PizzaPos.Api.Data;

/// <summary>
/// Resolves the current tenant from (in order):
///   1. The authenticated user's <c>store_id</c> claim (set at login time).
///   2. The legacy <c>X-Store-Id</c> request header (still required for the
///      anonymous bootstrap flow: store listing, login, initial Manager seed).
///
/// When neither is present, HasTenant=false and the Global Query Filter scopes
/// every TenantEntity query to Guid.Empty, returning no rows by default — the
/// safe fallback for any tenant-scoped endpoint.
/// </summary>
public class SessionTenantProvider : ITenantProvider
{
    public const string HeaderName = "X-Store-Id";
    public const string StoreIdClaim = "store_id";

    private readonly Guid _storeId;
    private readonly bool _hasTenant;

    public SessionTenantProvider(IHttpContextAccessor accessor)
    {
        var ctx = accessor.HttpContext;
        if (ctx is null) return;

        // Prefer the authenticated session's claim — it is signed and tamper-resistant.
        var claim = ctx.User?.FindFirst(StoreIdClaim)?.Value;
        if (!string.IsNullOrEmpty(claim)
            && Guid.TryParse(claim, out var fromClaim)
            && fromClaim != Guid.Empty)
        {
            _storeId = fromClaim;
            _hasTenant = true;
            return;
        }

        // Fallback: header (used by anonymous endpoints during the login bootstrap).
        if (ctx.Request.Headers.TryGetValue(HeaderName, out var raw)
            && Guid.TryParse(raw.ToString(), out var fromHeader)
            && fromHeader != Guid.Empty)
        {
            _storeId = fromHeader;
            _hasTenant = true;
        }
    }

    public Guid CurrentStoreId => _storeId;
    public bool HasTenant => _hasTenant;
}
