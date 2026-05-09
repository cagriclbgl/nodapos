using Microsoft.EntityFrameworkCore;
using PizzaPos.Api.Data;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Services;

public class SupervisorAdminService : ISupervisorAdminService
{
    private readonly AppDbContext _db;
    private readonly IPasswordHasher _hasher;

    public SupervisorAdminService(AppDbContext db, IPasswordHasher hasher)
    {
        _db = db;
        _hasher = hasher;
    }

    public async Task<SupervisorDashboardDto> GetDashboardAsync(CancellationToken ct = default)
    {
        var totalStores = await _db.Stores.CountAsync(ct);
        var activeStores = await _db.Stores.CountAsync(s => s.IsActive, ct);
        var pending = await _db.StoreRegistrationRequests
            .CountAsync(r => r.Status == StoreRegistrationStatus.Pending, ct);
        var totalUsers = await _db.Users.IgnoreQueryFilters().CountAsync(ct);
        return new SupervisorDashboardDto(totalStores, activeStores, pending, totalUsers);
    }

    public async Task<IReadOnlyList<StoreOverviewDto>> ListStoresAsync(CancellationToken ct = default)
    {
        var userCounts = await _db.Users
            .IgnoreQueryFilters()
            .GroupBy(u => u.StoreId)
            .Select(g => new { StoreId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StoreId, x => x.Count, ct);

        var orderCounts = await _db.Orders
            .IgnoreQueryFilters()
            .Where(o => o.Status == OrderStatus.Completed)
            .GroupBy(o => o.StoreId)
            .Select(g => new { StoreId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StoreId, x => x.Count, ct);

        var stores = await _db.Stores.OrderBy(s => s.Name).ToListAsync(ct);

        return stores.Select(s => new StoreOverviewDto(
            s.Id, s.Name, s.Address, s.Phone, s.TaxNumber, s.IsActive, s.CreatedAt,
            userCounts.TryGetValue(s.Id, out var uc) ? uc : 0,
            orderCounts.TryGetValue(s.Id, out var oc) ? oc : 0
        )).ToList();
    }

    public async Task<StoreDto?> GetStoreAsync(Guid storeId, CancellationToken ct = default)
    {
        var s = await _db.Stores.FindAsync([storeId], ct);
        return s is null ? null : MapStore(s);
    }

    public async Task<StoreDto> UpdateStoreAsync(Guid storeId, UpdateStoreRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new DomainException("Store name is required.");

        var store = await _db.Stores.FindAsync([storeId], ct)
            ?? throw DomainException.NotFound("Store");

        store.Name = request.Name.Trim();
        store.Address = request.Address;
        store.Phone = request.Phone;
        store.TaxNumber = request.TaxNumber;
        store.IsActive = request.IsActive;
        await _db.SaveChangesAsync(ct);
        return MapStore(store);
    }

    public async Task<IReadOnlyList<UserDto>> ListStoreUsersAsync(Guid storeId, CancellationToken ct = default)
    {
        await EnsureStoreExists(storeId, ct);
        return await _db.Users
            .IgnoreQueryFilters()
            .Where(u => u.StoreId == storeId)
            .OrderBy(u => u.Username)
            .Select(u => new UserDto(u.Id, u.Username, u.FullName, u.Role, u.IsActive, u.CreatedAt, u.LastLoginAt))
            .ToListAsync(ct);
    }

    public async Task<UserDto> CreateStoreUserAsync(Guid storeId, SupervisorCreateUserRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Username))
            throw new DomainException("Username is required.");
        if (string.IsNullOrWhiteSpace(request.FullName))
            throw new DomainException("FullName is required.");
        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
            throw new DomainException("Password must be at least 6 characters.");

        await EnsureStoreExists(storeId, ct);

        var username = request.Username.Trim();
        var dup = await _db.Users
            .IgnoreQueryFilters()
            .AnyAsync(u => u.StoreId == storeId && u.Username == username, ct);
        if (dup)
            throw DomainException.Conflict($"Username '{username}' is already taken in this store.");

        var user = new User
        {
            StoreId = storeId,
            Username = username,
            FullName = request.FullName.Trim(),
            Role = request.Role,
            IsActive = true,
            PasswordHash = _hasher.Hash(request.Password),
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);
        return AuthService.MapUser(user);
    }

    public async Task<UserDto> UpdateStoreUserAsync(Guid storeId, Guid userId, UpdateUserRequest request, CancellationToken ct = default)
    {
        var user = await _db.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.StoreId == storeId && u.Id == userId, ct)
            ?? throw DomainException.NotFound("User");

        var demotingManager =
            user.Role == UserRole.Manager &&
            ((request.Role.HasValue && request.Role.Value != UserRole.Manager) ||
             (request.IsActive == false));
        if (demotingManager)
        {
            var others = await _db.Users
                .IgnoreQueryFilters()
                .Where(u => u.StoreId == storeId && u.Id != userId && u.Role == UserRole.Manager && u.IsActive)
                .CountAsync(ct);
            if (others == 0)
                throw DomainException.Conflict("Cannot demote/deactivate the last active Manager of the store.");
        }

        if (!string.IsNullOrWhiteSpace(request.FullName))
            user.FullName = request.FullName.Trim();
        if (request.Role.HasValue)
            user.Role = request.Role.Value;
        if (request.IsActive.HasValue)
            user.IsActive = request.IsActive.Value;

        await _db.SaveChangesAsync(ct);
        return AuthService.MapUser(user);
    }

    public async Task ResetStoreUserPasswordAsync(Guid storeId, Guid userId, ResetPasswordRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
            throw new DomainException("Password must be at least 6 characters.");

        var user = await _db.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.StoreId == storeId && u.Id == userId, ct)
            ?? throw DomainException.NotFound("User");

        user.PasswordHash = _hasher.Hash(request.NewPassword);
        await _db.SaveChangesAsync(ct);
    }

    private async Task EnsureStoreExists(Guid storeId, CancellationToken ct)
    {
        var exists = await _db.Stores.AnyAsync(s => s.Id == storeId, ct);
        if (!exists) throw DomainException.NotFound("Store");
    }

    private static StoreDto MapStore(Store s) =>
        new(s.Id, s.Name, s.Address, s.Phone, s.TaxNumber, s.IsActive, s.CreatedAt);
}
