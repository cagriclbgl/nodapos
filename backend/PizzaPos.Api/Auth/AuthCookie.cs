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
        // Production deploy: frontend (Vercel: nodapos.com) ile API
        // (Hetzner: api.nodapos.com) farklı subdomain'lerde, yani cross-site.
        // SameSite=Lax cross-site fetch'lerde cookie göndermez → login geçer
        // ama sonraki API çağrılarında 401 patlar. None+Secure şart.
        // Development'ta (kasa lokal localhost:3000 ↔ :5000) Lax yeterli ve
        // bazı browser'lar localhost'u esnek saydığı için sorun çıkmaz.
        SameSite = env.IsDevelopment() ? SameSiteMode.Lax : SameSiteMode.None,
        Secure = !env.IsDevelopment(),
        Path = "/",
        Expires = expiresAtUtc,
    };

    private static CookieOptions BuildClearOptions(IHostEnvironment env) => new()
    {
        HttpOnly = true,
        IsEssential = true,
        SameSite = env.IsDevelopment() ? SameSiteMode.Lax : SameSiteMode.None,
        Secure = !env.IsDevelopment(),
        Path = "/",
    };
}
