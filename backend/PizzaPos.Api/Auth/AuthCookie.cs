using Microsoft.AspNetCore.Http;

namespace PizzaPos.Api.Auth;

/// <summary>
/// Centralised helpers for issuing/clearing the auth cookie so the same flags
/// (HttpOnly, SameSite, Secure) apply on every code path.
///
/// SameSite/Secure REQUEST.IsHttps'e göre belirlenir, env'e değil:
///  - Cloud (HTTPS, cross-subdomain): None + Secure — cross-site fetch için şart.
///  - Kasa (Electron, HTTP localhost): Lax + non-Secure — HTTP üzerinde Secure
///    cookie browser tarafından zaten reddedilirdi. Bu sayede aynı build hem
///    cloud (Hetzner) hem kasa Electron için çalışır; ASPNETCORE_ENVIRONMENT
///    fark etmez.
/// </summary>
public static class AuthCookie
{
    public static void Append(HttpResponse response, string token, DateTime expiresAtUtc, IHostEnvironment env)
    {
        response.Cookies.Append(JwtOptions.CookieName, token, BuildOptions(response.HttpContext, expiresAtUtc));
    }

    public static void Clear(HttpResponse response, IHostEnvironment env)
    {
        response.Cookies.Delete(JwtOptions.CookieName, BuildClearOptions(response.HttpContext));
    }

    public static void AppendSupervisor(HttpResponse response, string token, DateTime expiresAtUtc, IHostEnvironment env)
    {
        response.Cookies.Append(JwtOptions.SupervisorCookieName, token, BuildOptions(response.HttpContext, expiresAtUtc));
    }

    public static void ClearSupervisor(HttpResponse response, IHostEnvironment env)
    {
        response.Cookies.Delete(JwtOptions.SupervisorCookieName, BuildClearOptions(response.HttpContext));
    }

    private static CookieOptions BuildOptions(HttpContext ctx, DateTime expiresAtUtc) => new()
    {
        HttpOnly = true,
        IsEssential = true,
        SameSite = ctx.Request.IsHttps ? SameSiteMode.None : SameSiteMode.Lax,
        Secure = ctx.Request.IsHttps,
        Path = "/",
        Expires = expiresAtUtc,
    };

    private static CookieOptions BuildClearOptions(HttpContext ctx) => new()
    {
        HttpOnly = true,
        IsEssential = true,
        SameSite = ctx.Request.IsHttps ? SameSiteMode.None : SameSiteMode.Lax,
        Secure = ctx.Request.IsHttps,
        Path = "/",
    };
}
