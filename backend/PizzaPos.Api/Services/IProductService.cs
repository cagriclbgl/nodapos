using PizzaPos.Api.DTOs;

namespace PizzaPos.Api.Services;

public interface IProductService
{
    Task<IReadOnlyList<ProductDto>> ListAsync(Guid? categoryId, CancellationToken ct = default);
    Task<ProductDto?> GetAsync(Guid id, CancellationToken ct = default);
    Task<ProductDto> CreateAsync(CreateProductRequest request, CancellationToken ct = default);
    Task<ProductDto> UpdateAsync(Guid id, UpdateProductRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);

    Task<ProductOptionDto> AddOptionAsync(Guid productId, CreateProductOptionRequest request, CancellationToken ct = default);
    Task<ProductOptionDto> UpdateOptionAsync(Guid optionId, UpdateProductOptionRequest request, CancellationToken ct = default);
    Task DeleteOptionAsync(Guid optionId, CancellationToken ct = default);
}
