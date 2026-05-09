using Microsoft.EntityFrameworkCore;
using PizzaPos.Api.Data;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Services;

public class ProductService : IProductService
{
    private readonly AppDbContext _db;

    public ProductService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<ProductDto>> ListAsync(Guid? categoryId, CancellationToken ct = default)
    {
        var query = _db.Products
            .Include(p => p.Category)
            .Include(p => p.Options)
            .AsQueryable();

        if (categoryId.HasValue)
            query = query.Where(p => p.CategoryId == categoryId.Value);

        var rows = await query
            .OrderBy(p => p.DisplayOrder).ThenBy(p => p.Name)
            .ToListAsync(ct);

        return rows.Select(Map).ToList();
    }

    public async Task<ProductDto?> GetAsync(Guid id, CancellationToken ct = default)
    {
        var p = await _db.Products
            .Include(x => x.Category)
            .Include(x => x.Options)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        return p is null ? null : Map(p);
    }

    public async Task<ProductDto> CreateAsync(CreateProductRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new DomainException("Product name is required.");
        if (request.Price < 0)
            throw new DomainException("Product price must be non-negative.");

        var category = await _db.Categories.FindAsync([request.CategoryId], ct)
            ?? throw DomainException.NotFound("Category");

        var product = new Product
        {
            CategoryId = category.Id,
            Name = request.Name.Trim(),
            Description = request.Description,
            Price = request.Price,
            ImageUrl = request.ImageUrl,
            IsAvailable = true,
            DisplayOrder = request.DisplayOrder
        };
        _db.Products.Add(product);
        await _db.SaveChangesAsync(ct);

        // Reload with includes for the response payload.
        return (await GetAsync(product.Id, ct))!;
    }

    public async Task<ProductDto> UpdateAsync(Guid id, UpdateProductRequest request, CancellationToken ct = default)
    {
        var product = await _db.Products
            .Include(p => p.Options)
            .FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw DomainException.NotFound("Product");

        if (request.Price < 0)
            throw new DomainException("Product price must be non-negative.");

        var category = await _db.Categories.FindAsync([request.CategoryId], ct)
            ?? throw DomainException.NotFound("Category");

        product.CategoryId = category.Id;
        product.Name = request.Name.Trim();
        product.Description = request.Description;
        product.Price = request.Price;
        product.ImageUrl = request.ImageUrl;
        product.IsAvailable = request.IsAvailable;
        product.DisplayOrder = request.DisplayOrder;

        await _db.SaveChangesAsync(ct);
        return (await GetAsync(product.Id, ct))!;
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var product = await _db.Products.FindAsync([id], ct)
            ?? throw DomainException.NotFound("Product");

        var inUse = await _db.OrderItems.AnyAsync(i => i.ProductId == id, ct);
        if (inUse)
            throw DomainException.Conflict(
                "Product has historical orders; mark it unavailable instead of deleting.");

        _db.Products.Remove(product);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<ProductOptionDto> AddOptionAsync(
        Guid productId, CreateProductOptionRequest request, CancellationToken ct = default)
    {
        var product = await _db.Products.FindAsync([productId], ct)
            ?? throw DomainException.NotFound("Product");

        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.GroupName))
            throw new DomainException("Option group and name are required.");

        var option = new ProductOption
        {
            ProductId = product.Id,
            GroupName = request.GroupName.Trim(),
            Name = request.Name.Trim(),
            AdditionalPrice = request.AdditionalPrice,
            IsRequired = request.IsRequired,
            IsActive = true,
            DisplayOrder = request.DisplayOrder
        };
        _db.ProductOptions.Add(option);
        await _db.SaveChangesAsync(ct);
        return MapOption(option);
    }

    public async Task<ProductOptionDto> UpdateOptionAsync(
        Guid optionId, UpdateProductOptionRequest request, CancellationToken ct = default)
    {
        var option = await _db.ProductOptions.FindAsync([optionId], ct)
            ?? throw DomainException.NotFound("Product option");

        option.GroupName = request.GroupName.Trim();
        option.Name = request.Name.Trim();
        option.AdditionalPrice = request.AdditionalPrice;
        option.IsRequired = request.IsRequired;
        option.IsActive = request.IsActive;
        option.DisplayOrder = request.DisplayOrder;

        await _db.SaveChangesAsync(ct);
        return MapOption(option);
    }

    public async Task DeleteOptionAsync(Guid optionId, CancellationToken ct = default)
    {
        var option = await _db.ProductOptions.FindAsync([optionId], ct)
            ?? throw DomainException.NotFound("Product option");
        _db.ProductOptions.Remove(option);
        await _db.SaveChangesAsync(ct);
    }

    private static ProductDto Map(Product p) =>
        new(
            p.Id,
            p.CategoryId,
            p.Category?.Name ?? string.Empty,
            p.Name,
            p.Description,
            p.Price,
            p.ImageUrl,
            p.IsAvailable,
            p.DisplayOrder,
            p.Options.OrderBy(o => o.DisplayOrder).Select(MapOption).ToList());

    private static ProductOptionDto MapOption(ProductOption o) =>
        new(o.Id, o.GroupName, o.Name, o.AdditionalPrice, o.IsRequired, o.IsActive, o.DisplayOrder);
}
