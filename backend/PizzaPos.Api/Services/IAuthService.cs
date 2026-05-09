using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Services;

public interface IAuthService
{
    /// <summary>
    /// Validates credentials for the given store and returns the user + store summary.
    /// </summary>
    Task<(User user, Store store, LoginResponse response)> LoginAsync(
        LoginRequest request, CancellationToken ct = default);

    /// <summary>
    /// Builds a fresh response payload (used by /auth/me on every request).
    /// </summary>
    Task<LoginResponse?> GetSessionAsync(Guid userId, CancellationToken ct = default);

    /// <summary>
    /// Creates the very first Manager for a store. Refuses if any Manager already exists.
    /// </summary>
    Task<(User user, Store store, LoginResponse response)> BootstrapAsync(
        BootstrapRequest request, CancellationToken ct = default);
}
