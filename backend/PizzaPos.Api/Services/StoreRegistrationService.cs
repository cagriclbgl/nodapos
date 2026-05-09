using Microsoft.EntityFrameworkCore;
using PizzaPos.Api.Data;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Services;

public class StoreRegistrationService : IStoreRegistrationService
{
    private readonly AppDbContext _db;
    private readonly IPasswordHasher _hasher;

    public StoreRegistrationService(AppDbContext db, IPasswordHasher hasher)
    {
        _db = db;
        _hasher = hasher;
    }

    public async Task<Guid> CreateAsync(CreateStoreRegistrationRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.StoreName))
            throw new DomainException("StoreName is required.");
        if (string.IsNullOrWhiteSpace(request.ContactName))
            throw new DomainException("ContactName is required.");
        if (string.IsNullOrWhiteSpace(request.Phone))
            throw new DomainException("Phone is required.");

        var phone = request.Phone.Trim();
        var since = DateTime.UtcNow.AddHours(-24);
        var dup = await _db.StoreRegistrationRequests
            .AnyAsync(r => r.Phone == phone && r.Status == StoreRegistrationStatus.Pending && r.CreatedAt >= since, ct);
        if (dup)
            throw DomainException.Conflict("A pending request from this phone already exists. Please wait for review.");

        var entity = new StoreRegistrationRequest
        {
            StoreName = request.StoreName.Trim(),
            ContactName = request.ContactName.Trim(),
            Phone = phone,
            Email = NullIfBlank(request.Email),
            Address = NullIfBlank(request.Address),
            Notes = NullIfBlank(request.Notes),
            Status = StoreRegistrationStatus.Pending,
        };
        _db.StoreRegistrationRequests.Add(entity);
        await _db.SaveChangesAsync(ct);
        return entity.Id;
    }

    public async Task<IReadOnlyList<StoreRegistrationRequestDto>> ListAsync(StoreRegistrationStatus? status, CancellationToken ct = default)
    {
        var q = _db.StoreRegistrationRequests.AsQueryable();
        if (status.HasValue) q = q.Where(r => r.Status == status.Value);
        return await q
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => Map(r))
            .ToListAsync(ct);
    }

    public async Task<StoreRegistrationRequestDto?> GetAsync(Guid id, CancellationToken ct = default)
    {
        var r = await _db.StoreRegistrationRequests.FindAsync([id], ct);
        return r is null ? null : Map(r);
    }

    public async Task<ApproveRegistrationResponse> ApproveAsync(Guid id, ApproveRegistrationRequest request, Guid supervisorId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.ManagerUsername))
            throw new DomainException("ManagerUsername is required.");
        if (string.IsNullOrWhiteSpace(request.ManagerPassword) || request.ManagerPassword.Length < 6)
            throw new DomainException("ManagerPassword must be at least 6 characters.");
        if (string.IsNullOrWhiteSpace(request.ManagerFullName))
            throw new DomainException("ManagerFullName is required.");

        var reg = await _db.StoreRegistrationRequests.FirstOrDefaultAsync(r => r.Id == id, ct)
            ?? throw DomainException.NotFound("Registration request");
        if (reg.Status != StoreRegistrationStatus.Pending)
            throw DomainException.Conflict($"Request is already {reg.Status}.");

        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        var store = new Store
        {
            Name = (request.StoreNameOverride ?? reg.StoreName).Trim(),
            Address = NullIfBlank(request.Address) ?? reg.Address,
            Phone = NullIfBlank(request.Phone) ?? reg.Phone,
            IsActive = true,
        };
        _db.Stores.Add(store);
        await _db.SaveChangesAsync(ct);

        var username = request.ManagerUsername.Trim();
        var manager = new User
        {
            StoreId = store.Id,
            Username = username,
            FullName = request.ManagerFullName.Trim(),
            Role = UserRole.Manager,
            IsActive = true,
            PasswordHash = _hasher.Hash(request.ManagerPassword),
        };
        _db.Users.Add(manager);

        var now = DateTime.UtcNow;
        reg.Status = StoreRegistrationStatus.Approved;
        reg.ProcessedAt = now;
        reg.ProcessedBySupervisorId = supervisorId;
        reg.CreatedStoreId = store.Id;
        reg.RejectionReason = null;

        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new ApproveRegistrationResponse(store.Id, manager.Id);
    }

    public async Task<StoreRegistrationRequestDto> RejectAsync(Guid id, RejectRegistrationRequest request, Guid supervisorId, CancellationToken ct = default)
    {
        var reg = await _db.StoreRegistrationRequests.FirstOrDefaultAsync(r => r.Id == id, ct)
            ?? throw DomainException.NotFound("Registration request");
        if (reg.Status != StoreRegistrationStatus.Pending)
            throw DomainException.Conflict($"Request is already {reg.Status}.");

        reg.Status = StoreRegistrationStatus.Rejected;
        reg.ProcessedAt = DateTime.UtcNow;
        reg.ProcessedBySupervisorId = supervisorId;
        reg.RejectionReason = NullIfBlank(request.Reason);
        await _db.SaveChangesAsync(ct);
        return Map(reg);
    }

    private static string? NullIfBlank(string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    internal static StoreRegistrationRequestDto Map(StoreRegistrationRequest r) =>
        new(r.Id, r.StoreName, r.ContactName, r.Phone, r.Email, r.Address, r.Notes,
            r.Status, r.CreatedAt, r.ProcessedAt, r.CreatedStoreId, r.RejectionReason);
}
