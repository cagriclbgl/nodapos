using Microsoft.EntityFrameworkCore;
using PizzaPos.Api.Data;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly IPasswordHasher _hasher;

    public AuthService(AppDbContext db, IPasswordHasher hasher)
    {
        _db = db;
        _hasher = hasher;
    }

    public async Task<(User user, Store store, LoginResponse response)> LoginAsync(
        LoginRequest request, CancellationToken ct = default)
    {
        if (request.StoreId == Guid.Empty)
            throw new DomainException("StoreId is required.");
        if (string.IsNullOrWhiteSpace(request.Username))
            throw new DomainException("Username is required.");
        if (string.IsNullOrWhiteSpace(request.Password))
            throw new DomainException("Password is required.");

        var store = await _db.Stores.FindAsync([request.StoreId], ct)
            ?? throw DomainException.NotFound("Store");

        // Authenticated session is not yet established at login, so the Global
        // Query Filter has no tenant. IgnoreQueryFilters + explicit StoreId
        // predicate keeps the check tenant-scoped without trusting any header.
        var username = request.Username.Trim();
        var user = await _db.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u =>
                u.StoreId == store.Id &&
                u.Username == username, ct);

        if (user is null || !user.IsActive || !_hasher.Verify(request.Password, user.PasswordHash))
            throw new DomainException("Invalid username or password.", 401);

        // Bump LastLoginAt via raw UPDATE (pooler-safe; mirrors OrderService convention).
        var now = DateTime.UtcNow;
        await _db.Users
            .IgnoreQueryFilters()
            .Where(u => u.Id == user.Id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(u => u.LastLoginAt, (DateTime?)now)
                .SetProperty(u => u.UpdatedAt, (DateTime?)now), ct);
        user.LastLoginAt = now;

        return (user, store, new LoginResponse(MapUser(user), MapStore(store)));
    }

    public async Task<LoginResponse?> GetSessionAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _db.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null || !user.IsActive) return null;

        var store = await _db.Stores.FindAsync([user.StoreId], ct);
        if (store is null) return null;

        return new LoginResponse(MapUser(user), MapStore(store));
    }

    public async Task<(User user, Store store, LoginResponse response)> BootstrapAsync(
        BootstrapRequest request, CancellationToken ct = default)
    {
        if (request.StoreId == Guid.Empty)
            throw new DomainException("StoreId is required.");
        if (string.IsNullOrWhiteSpace(request.Username))
            throw new DomainException("Username is required.");
        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
            throw new DomainException("Password must be at least 6 characters.");
        if (string.IsNullOrWhiteSpace(request.FullName))
            throw new DomainException("FullName is required.");

        var store = await _db.Stores.FindAsync([request.StoreId], ct)
            ?? throw DomainException.NotFound("Store");

        var hasManager = await _db.Users
            .IgnoreQueryFilters()
            .AnyAsync(u => u.StoreId == store.Id && u.Role == UserRole.Manager, ct);
        if (hasManager)
            throw DomainException.Conflict("Store already has a Manager. Use the regular login flow.");

        var username = request.Username.Trim();
        var dup = await _db.Users
            .IgnoreQueryFilters()
            .AnyAsync(u => u.StoreId == store.Id && u.Username == username, ct);
        if (dup)
            throw DomainException.Conflict($"Username '{username}' is already taken in this store.");

        var user = new User
        {
            StoreId = store.Id,
            Username = username,
            FullName = request.FullName.Trim(),
            Role = UserRole.Manager,
            IsActive = true,
            PasswordHash = _hasher.Hash(request.Password),
            LastLoginAt = DateTime.UtcNow,
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);

        return (user, store, new LoginResponse(MapUser(user), MapStore(store)));
    }

    internal static UserDto MapUser(User u) =>
        new(u.Id, u.Username, u.FullName, u.Role, u.IsActive, u.CreatedAt, u.LastLoginAt);

    internal static StoreSummaryDto MapStore(Store s) => new(s.Id, s.Name);
}
