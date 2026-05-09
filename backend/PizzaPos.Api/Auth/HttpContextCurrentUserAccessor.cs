using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Auth;

public class HttpContextCurrentUserAccessor : ICurrentUserAccessor
{
    private readonly IHttpContextAccessor _accessor;

    public HttpContextCurrentUserAccessor(IHttpContextAccessor accessor)
    {
        _accessor = accessor;
    }

    public bool IsAuthenticated => _accessor.HttpContext?.User?.Identity?.IsAuthenticated == true;

    public Guid? UserId
    {
        get
        {
            var raw = FindClaim(JwtRegisteredClaimNames.Sub) ?? FindClaim(ClaimTypes.NameIdentifier);
            return Guid.TryParse(raw, out var id) ? id : null;
        }
    }

    public string? Username => FindClaim("name") ?? FindClaim(ClaimTypes.Name);

    public UserRole? Role
    {
        get
        {
            var raw = FindClaim("role") ?? FindClaim(ClaimTypes.Role);
            return Enum.TryParse<UserRole>(raw, ignoreCase: true, out var r) ? r : null;
        }
    }

    public Guid? StoreId
    {
        get
        {
            var raw = FindClaim(JwtOptions.StoreIdClaim);
            return Guid.TryParse(raw, out var id) ? id : null;
        }
    }

    public string? SubjectType => FindClaim(JwtOptions.SubjectTypeClaim);

    public bool IsSupervisor =>
        SubjectType == JwtOptions.SubjectTypeSupervisor
        || (FindClaim("role") ?? FindClaim(ClaimTypes.Role)) == JwtOptions.SupervisorRole;

    private string? FindClaim(string type) =>
        _accessor.HttpContext?.User?.FindFirst(type)?.Value;
}
