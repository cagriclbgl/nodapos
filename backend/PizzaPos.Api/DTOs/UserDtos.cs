using PizzaPos.Api.Entities;

namespace PizzaPos.Api.DTOs;

public record UserDto(
    Guid Id,
    string Username,
    string FullName,
    UserRole Role,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? LastLoginAt);

public record CreateUserRequest(
    string Username,
    string FullName,
    string Password,
    UserRole Role);

public record UpdateUserRequest(
    string? FullName,
    UserRole? Role,
    bool? IsActive);

public record ResetPasswordRequest(
    string NewPassword);
