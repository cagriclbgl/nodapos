using PizzaPos.Api.Entities;

namespace PizzaPos.Api.DTOs;

public record SupervisorDto(
    Guid Id,
    string Username,
    string FullName,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? LastLoginAt);

public record SupervisorLoginRequest(
    string Username,
    string Password);

public record SupervisorSessionResponse(
    SupervisorDto Supervisor);

public record SupervisorDashboardDto(
    int TotalStores,
    int ActiveStores,
    int PendingRegistrations,
    int TotalUsers);

// --- Store registration -----------------------------------------------------

public record StoreRegistrationRequestDto(
    Guid Id,
    string StoreName,
    string ContactName,
    string Phone,
    string? Email,
    string? Address,
    string? Notes,
    StoreRegistrationStatus Status,
    DateTime CreatedAt,
    DateTime? ProcessedAt,
    Guid? CreatedStoreId,
    string? RejectionReason);

public record CreateStoreRegistrationRequest(
    string StoreName,
    string ContactName,
    string Phone,
    string? Email,
    string? Address,
    string? Notes);

public record ApproveRegistrationRequest(
    string? StoreNameOverride,
    string? Address,
    string? Phone,
    string ManagerUsername,
    string ManagerPassword,
    string ManagerFullName);

public record ApproveRegistrationResponse(
    Guid StoreId,
    Guid ManagerUserId);

public record RejectRegistrationRequest(
    string? Reason);

// --- Cross-store admin ------------------------------------------------------

public record StoreOverviewDto(
    Guid Id,
    string Name,
    string? Address,
    string? Phone,
    string? TaxNumber,
    bool IsActive,
    DateTime CreatedAt,
    int UserCount,
    int OrderCount);

public record SupervisorCreateUserRequest(
    string Username,
    string FullName,
    string Password,
    UserRole Role);
