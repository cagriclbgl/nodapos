using Microsoft.EntityFrameworkCore;
using PizzaPos.Api.Data;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Services;

public class CategoryService : ICategoryService
{
    private readonly AppDbContext _db;

    public CategoryService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<CategoryDto>> ListAsync(CancellationToken ct = default)
    {
        return await _db.Categories
            .OrderBy(c => c.DisplayOrder).ThenBy(c => c.Name)
            .Select(c => Map(c))
            .ToListAsync(ct);
    }

    public async Task<CategoryDto?> GetAsync(Guid id, CancellationToken ct = default)
    {
        var c = await _db.Categories.FindAsync([id], ct);
        return c is null ? null : Map(c);
    }

    public async Task<CategoryDto> CreateAsync(CreateCategoryRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new DomainException("Category name is required.");

        var cat = new Category
        {
            Name = request.Name.Trim(),
            Description = request.Description,
            DisplayOrder = request.DisplayOrder,
            IsActive = true
        };
        _db.Categories.Add(cat);
        await _db.SaveChangesAsync(ct);
        return Map(cat);
    }

    public async Task<CategoryDto> UpdateAsync(Guid id, UpdateCategoryRequest request, CancellationToken ct = default)
    {
        var cat = await _db.Categories.FindAsync([id], ct)
            ?? throw DomainException.NotFound("Category");

        cat.Name = request.Name.Trim();
        cat.Description = request.Description;
        cat.DisplayOrder = request.DisplayOrder;
        cat.IsActive = request.IsActive;

        await _db.SaveChangesAsync(ct);
        return Map(cat);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var cat = await _db.Categories.FindAsync([id], ct)
            ?? throw DomainException.NotFound("Category");

        var hasProducts = await _db.Products.AnyAsync(p => p.CategoryId == id, ct);
        if (hasProducts)
            throw DomainException.Conflict("Category has products. Move or delete them first.");

        _db.Categories.Remove(cat);
        await _db.SaveChangesAsync(ct);
    }

    private static CategoryDto Map(Category c) =>
        new(c.Id, c.Name, c.Description, c.DisplayOrder, c.IsActive);
}
