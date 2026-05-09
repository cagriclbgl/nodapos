namespace PizzaPos.Api.DTOs;

public record CustomerListItemDto(
    Guid Id,
    string Name,
    string Phone,
    bool IsActive,
    int OrderCount,
    DateTime? LastOrderAt);

public record CustomerAddressDto(
    Guid Id,
    string Label,
    string AddressLine,
    string? District,
    string? Notes,
    bool IsDefault);

public record CustomerDto(
    Guid Id,
    string Name,
    string Phone,
    string? Notes,
    bool IsActive,
    DateTime CreatedAt,
    IReadOnlyList<CustomerAddressDto> Addresses);

public record CreateCustomerRequest(
    string Name,
    string Phone,
    string? Notes);

public record UpdateCustomerRequest(
    string? Name,
    string? Phone,
    string? Notes,
    bool? IsActive);

public record AddressRequest(
    string Label,
    string AddressLine,
    string? District,
    string? Notes,
    bool IsDefault);
