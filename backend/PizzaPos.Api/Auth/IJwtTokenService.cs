using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Auth;

public interface IJwtTokenService
{
    /// <summary>Issues a signed JWT for the given user, returning the encoded token and its expiry.</summary>
    (string Token, DateTime ExpiresAtUtc) Issue(User user);

    /// <summary>Issues a signed JWT for a Supervisor (no StoreId claim, role=Supervisor).</summary>
    (string Token, DateTime ExpiresAtUtc) IssueForSupervisor(Supervisor supervisor);
}
