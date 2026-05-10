using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Auth;

public class JwtTokenService : IJwtTokenService
{
    private readonly JwtOptions _options;

    public JwtTokenService(IOptions<JwtOptions> options)
    {
        _options = options.Value;
    }

    public (string Token, DateTime ExpiresAtUtc) Issue(User user)
    {
        var (now, expires, creds) = Prepare();
        // Sadece short claim adlari ("name","role"). MapInboundClaims=false
        // ile birlikte identity bunlari oldugu gibi tasiyacak; TokenValidation
        // parameters NameClaimType/RoleClaimType olarak kisa formu kullaniyor.
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new("name", user.Username),
            new("role", user.Role.ToString()),
            new(JwtOptions.StoreIdClaim, user.StoreId.ToString()),
            new(JwtOptions.SubjectTypeClaim, JwtOptions.SubjectTypeUser),
        };
        return Sign(claims, now, expires, creds);
    }

    public (string Token, DateTime ExpiresAtUtc) IssueForSupervisor(Supervisor supervisor)
    {
        var (now, expires, creds) = Prepare();
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, supervisor.Id.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new("name", supervisor.Username),
            new("role", JwtOptions.SupervisorRole),
            new(JwtOptions.SubjectTypeClaim, JwtOptions.SubjectTypeSupervisor),
        };
        return Sign(claims, now, expires, creds);
    }

    private (DateTime Now, DateTime Expires, SigningCredentials Creds) Prepare()
    {
        var secret = _options.Secret;
        if (string.IsNullOrWhiteSpace(secret) || secret.Length < 32)
            throw new InvalidOperationException(
                "JWT secret is not configured or too short (need >= 32 chars).");

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var now = DateTime.UtcNow;
        var expires = now.AddHours(_options.ExpiryHours <= 0 ? 12 : _options.ExpiryHours);
        return (now, expires, creds);
    }

    private (string Token, DateTime ExpiresAtUtc) Sign(IEnumerable<Claim> claims, DateTime now, DateTime expires, SigningCredentials creds)
    {
        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            notBefore: now,
            expires: expires,
            signingCredentials: creds);
        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }
}
