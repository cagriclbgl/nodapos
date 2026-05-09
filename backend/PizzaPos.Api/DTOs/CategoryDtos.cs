namespace PizzaPos.Api.DTOs;

public record CategoryDto(
    Guid Id,
    string Name,
    string? Description,
    int DisplayOrder,
    bool IsActive);

public record CreateCategoryRequest(
    string Name,
    string? Description,
    int DisplayOrder);

public record UpdateCategoryRequest(
    string Name,
    string? Description,
    int DisplayOrder,
    bool IsActive);
