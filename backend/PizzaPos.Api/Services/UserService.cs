using Microsoft.EntityFrameworkCore;
using PizzaPos.Api.Data;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Services;

public class UserService : IUserService
{
    private readonly AppDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly ITenantProvider _tenant;

    public UserService(AppDbContext db, IPasswordHasher hasher, ITenantProvider tenant)
    {
        _db = db;
        _hasher = hasher;
        _tenant = tenant;
    }

    public async Task<IReadOnlyList<UserDto>> ListAsync(CancellationToken ct = default)
    {
        // Global Query Filter scopes to current StoreId.
        var rows = await _db.Users
            .OrderBy(u => u.Username)
            .Select(u => new UserDto(
                u.Id, u.Username, u.FullName, u.Role, u.IsActive, u.CreatedAt, u.LastLoginAt))
            .ToListAsync(ct);
        return rows;
    }

    public async Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Username))
            throw new DomainException("Username is required.");
        if (string.IsNullOrWhiteSpace(request.FullName))
            throw new DomainException("FullName is required.");
        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
            throw new DomainException("Password must be at least 6 characters.");
        if (!_tenant.HasTenant)
            throw new DomainException("No active store context.");

        var username = request.Username.Trim();
        var dup = await _db.Users.AnyAsync(u => u.Username == username, ct);
        if (dup)
            throw DomainException.Conflict($"Username '{username}' is already taken.");

        var user = new User
        {
            StoreId = _tenant.CurrentStoreId,
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

    public async Task<UserDto> UpdateAsync(Guid id, UpdateUserRequest request, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw DomainException.NotFound("User");

        // If demoting/deactivating a Manager, ensure at least one active Manager remains.
        var demotingManager =
            user.Role == UserRole.Manager &&
            ((request.Role.HasValue && request.Role.Value != UserRole.Manager) ||
             (request.IsActive == false));
        if (demotingManager)
        {
            var otherActiveManagers = await _db.Users
                .Where(u => u.Id != user.Id && u.Role == UserRole.Manager && u.IsActive)
                .CountAsync(ct);
            if (otherActiveManagers == 0)
                throw DomainException.Conflict(
                    "Cannot demote/deactivate the last active Manager of the store.");
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

    public async Task ResetPasswordAsync(Guid id, ResetPasswordRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
            throw new DomainException("Password must be at least 6 characters.");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw DomainException.NotFound("User");

        user.PasswordHash = _hasher.Hash(request.NewPassword);
        await _db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw DomainException.NotFound("User");

        if (user.Role == UserRole.Manager && user.IsActive)
        {
            var otherActiveManagers = await _db.Users
                .Where(u => u.Id != user.Id && u.Role == UserRole.Manager && u.IsActive)
                .CountAsync(ct);
            if (otherActiveManagers == 0)
                throw DomainException.Conflict(
                    "Cannot delete the last active Manager of the store.");
        }

        _db.Users.Remove(user);
        await _db.SaveChangesAsync(ct);
    }
}
