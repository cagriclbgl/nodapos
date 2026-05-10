using Microsoft.EntityFrameworkCore;
using PizzaPos.Api.Data;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Services;

public class ComboService : IComboService
{
    private readonly AppDbContext _db;

    public ComboService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<ComboDto>> ListAsync(bool? activeOnly, CancellationToken ct = default)
    {
        var query = _db.Combos
            .Include(c => c.Items)
                .ThenInclude(i => i.Category)
            .AsQueryable();

        if (activeOnly == true)
            query = query.Where(c => c.IsActive);

        var rows = await query
            .OrderBy(c => c.DisplayOrder).ThenBy(c => c.Name)
            .ToListAsync(ct);

        return rows.Select(Map).ToList();
    }

    public async Task<ComboDto?> GetAsync(Guid id, CancellationToken ct = default)
    {
        var combo = await _db.Combos
            .Include(c => c.Items)
                .ThenInclude(i => i.Category)
            .FirstOrDefaultAsync(c => c.Id == id, ct);
        return combo is null ? null : Map(combo);
    }

    public async Task<ComboDto> CreateAsync(CreateComboRequest request, CancellationToken ct = default)
    {
        ValidateBasics(request.Name, request.Price);
        if (request.Items is null || request.Items.Count == 0)
            throw new DomainException("Kombo en az bir slot içermeli.");

        await EnsureCategoriesExist(request.Items, ct);

        var combo = new Combo
        {
            Name = request.Name.Trim(),
            Description = NullIfBlank(request.Description),
            Price = request.Price,
            IsActive = true,
            DisplayOrder = request.DisplayOrder,
        };
        _db.Combos.Add(combo);

        foreach (var item in request.Items)
        {
            _db.ComboItems.Add(new ComboItem
            {
                Combo = combo,
                Label = item.Label.Trim(),
                CategoryId = item.CategoryId,
                Quantity = Math.Max(1, item.Quantity),
                DisplayOrder = item.DisplayOrder,
            });
        }
        await _db.SaveChangesAsync(ct);
        return (await GetAsync(combo.Id, ct))!;
    }

    public async Task<ComboDto> UpdateAsync(Guid id, UpdateComboRequest request, CancellationToken ct = default)
    {
        var combo = await _db.Combos
            .Include(c => c.Items)
            .FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw DomainException.NotFound("Kombo");

        ValidateBasics(request.Name, request.Price);
        if (request.Items is null || request.Items.Count == 0)
            throw new DomainException("Kombo en az bir slot içermeli.");

        await EnsureCategoriesExist(request.Items, ct);

        combo.Name = request.Name.Trim();
        combo.Description = NullIfBlank(request.Description);
        combo.Price = request.Price;
        combo.IsActive = request.IsActive;
        combo.DisplayOrder = request.DisplayOrder;

        // Slot listesi tamamen yeniden yazılır — önce mevcut item'ları sil.
        _db.ComboItems.RemoveRange(combo.Items);
        await _db.SaveChangesAsync(ct);

        foreach (var item in request.Items)
        {
            _db.ComboItems.Add(new ComboItem
            {
                ComboId = combo.Id,
                Label = item.Label.Trim(),
                CategoryId = item.CategoryId,
                Quantity = Math.Max(1, item.Quantity),
                DisplayOrder = item.DisplayOrder,
            });
        }
        await _db.SaveChangesAsync(ct);
        return (await GetAsync(combo.Id, ct))!;
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var combo = await _db.Combos.FindAsync([id], ct)
            ?? throw DomainException.NotFound("Kombo");
        _db.Combos.Remove(combo);
        await _db.SaveChangesAsync(ct);
    }

    private static void ValidateBasics(string name, decimal price)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("Kombo adı zorunlu.");
        if (price < 0)
            throw new DomainException("Kombo fiyatı negatif olamaz.");
    }

    private async Task EnsureCategoriesExist(
        IReadOnlyList<CreateComboItemRequest> items, CancellationToken ct)
    {
        var ids = items.Select(i => i.CategoryId).Distinct().ToList();
        var existing = await _db.Categories
            .Where(c => ids.Contains(c.Id))
            .Select(c => c.Id)
            .ToListAsync(ct);
        var missing = ids.Except(existing).ToList();
        if (missing.Count > 0)
            throw DomainException.NotFound($"Category {missing[0]}");
    }

    private static string? NullIfBlank(string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static ComboDto Map(Combo c) =>
        new(c.Id, c.Name, c.Description, c.Price, c.IsActive, c.DisplayOrder,
            c.Items.OrderBy(i => i.DisplayOrder)
                .Select(i => new ComboItemDto(
                    i.Id, i.Label, i.CategoryId,
                    i.Category?.Name ?? string.Empty,
                    i.Quantity, i.DisplayOrder))
                .ToList());
}
