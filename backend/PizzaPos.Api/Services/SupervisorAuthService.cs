using Microsoft.EntityFrameworkCore;
using PizzaPos.Api.Data;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Services;

public class SupervisorAuthService : ISupervisorAuthService
{
    private readonly AppDbContext _db;
    private readonly IPasswordHasher _hasher;

    public SupervisorAuthService(AppDbContext db, IPasswordHasher hasher)
    {
        _db = db;
        _hasher = hasher;
    }

    public async Task<(Supervisor supervisor, SupervisorSessionResponse response)> LoginAsync(
        SupervisorLoginRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Username))
            throw new DomainException("Username is required.");
        if (string.IsNullOrWhiteSpace(request.Password))
            throw new DomainException("Password is required.");

        var username = request.Username.Trim();
        var sup = await _db.Supervisors
            .FirstOrDefaultAsync(s => s.Username == username, ct);

        if (sup is null || !sup.IsActive || !_hasher.Verify(request.Password, sup.PasswordHash))
            throw new DomainException("Invalid username or password.", 401);

        var now = DateTime.UtcNow;
        await _db.Supervisors
            .Where(s => s.Id == sup.Id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.LastLoginAt, (DateTime?)now)
                .SetProperty(x => x.UpdatedAt, (DateTime?)now), ct);
        sup.LastLoginAt = now;

        return (sup, new SupervisorSessionResponse(Map(sup)));
    }

    public async Task<SupervisorSessionResponse?> GetSessionAsync(Guid supervisorId, CancellationToken ct = default)
    {
        var sup = await _db.Supervisors.FindAsync([supervisorId], ct);
        if (sup is null || !sup.IsActive) return null;
        return new SupervisorSessionResponse(Map(sup));
    }

    internal static SupervisorDto Map(Supervisor s) =>
        new(s.Id, s.Username, s.FullName, s.IsActive, s.CreatedAt, s.LastLoginAt);
}
