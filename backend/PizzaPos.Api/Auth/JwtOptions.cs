namespace PizzaPos.Api.Auth;

public class JwtOptions
{
    public string Issuer { get; set; } = "PizzaPos";
    public string Audience { get; set; } = "PizzaPos.Web";
    public int ExpiryHours { get; set; } = 12;

    /// <summary>
    /// HMAC-SHA256 signing secret. Must be at least 32 characters in production.
    /// In Development we fall back to a fixed dev secret if missing.
    /// </summary>
    public string? Secret { get; set; }

    public const string CookieName = "pizza_auth";
    public const string SupervisorCookieName = "pizza_supervisor";
    public const string StoreIdClaim = "store_id";
    public const string SubjectTypeClaim = "sub_type";
    public const string SubjectTypeUser = "user";
    public const string SubjectTypeSupervisor = "supervisor";
    public const string SupervisorRole = "Supervisor";

    /// <summary>Hard-coded fallback used only when Environment=Development.</summary>
    public const string DevSecretFallback =
        "pizza-pos-development-only-secret-change-me-please-32+";
}
