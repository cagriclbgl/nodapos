using Microsoft.AspNetCore.Http;

namespace PizzaPos.Api.Auth;

/// <summary>
/// Centralised helpers for issuing/clearing the auth cookie so the same flags
/// (HttpOnly, SameSite, Secure) apply on every code path.
/// </summary>
public static class AuthCookie
{
    public static void Append(HttpResponse response, string token, DateTime expiresAtUtc, IHostEnvironment env)
    {
        response.Cookies.Append(JwtOptions.CookieName, token, BuildOptions(expiresAtUtc, env));
    }

    public static void Clear(HttpResponse response, IHostEnvironment env)
    {
        // Use Delete with matching path so the browser actually drops the cookie.
        response.Cookies.Delete(JwtOptions.CookieName, BuildClearOptions(env));
    }

    public static void AppendSupervisor(HttpResponse response, string token, DateTime expiresAtUtc, IHostEnvironment env)
    {
        response.Cookies.Append(JwtOptions.SupervisorCookieName, token, BuildOptions(expiresAtUtc, env));
    }

    public static void ClearSupervisor(HttpResponse response, IHostEnvironment env)
    {
        response.Cookies.Delete(JwtOptions.SupervisorCookieName, BuildClearOptions(env));
    }

    private static CookieOptions BuildOptions(DateTime expiresAtUtc, IHostEnvironment env) => new()
    {
        HttpOnly = true,
        IsEssential = true,
        SameSite = SameSiteMode.Lax,
        Secure = !env.IsDevelopment(),
        Path = "/",
        Expires = expiresAtUtc,
    };

    private static CookieOptions BuildClearOptions(IHostEnvironment env) => new()
    {
        HttpOnly = true,
        IsEssential = true,
        SameSite = SameSiteMode.Lax,
        Secure = !env.IsDevelopment(),
        Path = "/",
    };
}
