using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Auth;

/// <summary>
/// Reads the authenticated user's Id (from the <c>sub</c> claim). Returns null
/// when the request is anonymous so callers can opt-in to audit stamping.
/// </summary>
public interface ICurrentUserAccessor
{
    Guid? UserId { get; }
    string? Username { get; }
    UserRole? Role { get; }
    Guid? StoreId { get; }
    bool IsAuthenticated { get; }
    bool IsSupervisor { get; }
    string? SubjectType { get; }
}
