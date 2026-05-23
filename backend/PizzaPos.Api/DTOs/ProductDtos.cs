namespace PizzaPos.Api.DTOs;

public record ProductDto(
    Guid Id,
    Guid CategoryId,
    string CategoryName,
    string Name,
    string? Description,
    decimal Price,
    decimal? DeliveryPrice,
    string? ImageUrl,
    bool IsAvailable,
    int DisplayOrder,
    IReadOnlyList<ProductOptionDto> Options);

public record ProductOptionDto(
    Guid Id,
    string GroupName,
    string Name,
    decimal AdditionalPrice,
    decimal? DeliveryAdditionalPrice,
    bool IsRequired,
    bool IsActive,
    int DisplayOrder);

public record CreateProductRequest(
    Guid CategoryId,
    string Name,
    string? Description,
    decimal Price,
    decimal? DeliveryPrice,
    string? ImageUrl,
    int DisplayOrder);

public record UpdateProductRequest(
    Guid CategoryId,
    string Name,
    string? Description,
    decimal Price,
    decimal? DeliveryPrice,
    string? ImageUrl,
    bool IsAvailable,
    int DisplayOrder);

public record CreateProductOptionRequest(
    string GroupName,
    string Name,
    decimal AdditionalPrice,
    decimal? DeliveryAdditionalPrice,
    bool IsRequired,
    int DisplayOrder);

public record UpdateProductOptionRequest(
    string GroupName,
    string Name,
    decimal AdditionalPrice,
    decimal? DeliveryAdditionalPrice,
    bool IsRequired,
    bool IsActive,
    int DisplayOrder);
