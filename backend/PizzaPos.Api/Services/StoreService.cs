using Microsoft.EntityFrameworkCore;
using PizzaPos.Api.Data;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Services;

public class StoreService : IStoreService
{
    private readonly AppDbContext _db;

    public StoreService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<StoreDto>> ListAsync(CancellationToken ct = default)
    {
        return await _db.Stores
            .OrderBy(s => s.Name)
            .Select(s => Map(s))
            .ToListAsync(ct);
    }

    public async Task<StoreDto?> GetAsync(Guid id, CancellationToken ct = default)
    {
        var s = await _db.Stores.FindAsync([id], ct);
        return s is null ? null : Map(s);
    }

    public async Task<StoreDto> CreateAsync(CreateStoreRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new DomainException("Store name is required.");

        var store = new Store
        {
            Name = request.Name.Trim(),
            Address = request.Address,
            Phone = request.Phone,
            TaxNumber = request.TaxNumber,
            IsActive = true
        };
        _db.Stores.Add(store);
        await _db.SaveChangesAsync(ct);
        return Map(store);
    }

    public async Task<StoreDto> UpdateAsync(Guid id, UpdateStoreRequest request, CancellationToken ct = default)
    {
        var store = await _db.Stores.FindAsync([id], ct)
            ?? throw DomainException.NotFound("Store");

        store.Name = request.Name.Trim();
        store.Address = request.Address;
        store.Phone = request.Phone;
        store.TaxNumber = request.TaxNumber;
        store.IsActive = request.IsActive;

        await _db.SaveChangesAsync(ct);
        return Map(store);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var store = await _db.Stores.FindAsync([id], ct)
            ?? throw DomainException.NotFound("Store");
        _db.Stores.Remove(store);
        await _db.SaveChangesAsync(ct);
    }

    private static StoreDto Map(Store s) =>
        new(s.Id, s.Name, s.Address, s.Phone, s.TaxNumber, s.IsActive, s.CreatedAt);
}
