namespace PizzaPos.Api.DTOs;

public record StoreSummaryDto(
    Guid Id,
    string Name);

public record LoginRequest(
    Guid StoreId,
    string Username,
    string Password);

public record LoginResponse(
    UserDto User,
    StoreSummaryDto Store);

public record BootstrapRequest(
    Guid StoreId,
    string Username,
    string Password,
    string FullName);
