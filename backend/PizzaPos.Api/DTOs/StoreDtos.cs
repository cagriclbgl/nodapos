namespace PizzaPos.Api.DTOs;

public record StoreDto(
    Guid Id,
    string Name,
    string? Address,
    string? Phone,
    string? TaxNumber,
    bool IsActive,
    DateTime CreatedAt);

public record CreateStoreRequest(
    string Name,
    string? Address,
    string? Phone,
    string? TaxNumber);

public record UpdateStoreRequest(
    string Name,
    string? Address,
    string? Phone,
    string? TaxNumber,
    bool IsActive);
