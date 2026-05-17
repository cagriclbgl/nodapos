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

// --- Analytics --------------------------------------------------------------
// Tüm endpoint'ler "revenue" tanımı olarak Payment.Amount toplamını kullanır
// (kasiyer ödeme aldıkça gerçek tahsilat — supervisor kararı, 2026-05-17).
// Saat dilimi: client kendi yerel günün UTC aralığını [fromUtc, toUtc) gönderir;
// "today" yardımcı endpoint'leri ise Europe/Istanbul (UTC+3) baz alır.

public record SupervisorTodaySummaryDto(
    DateTime FromUtc,
    DateTime ToUtc,
    decimal TotalRevenue,
    int OrderCount,
    decimal AverageBasket,
    int ActiveStoreCount,
    int TotalStoreCount,
    IReadOnlyList<StoreTodayRowDto> Stores);

public record StoreTodayRowDto(
    Guid StoreId,
    string StoreName,
    bool IsActive,
    decimal Revenue,
    int OrderCount,
    decimal AverageBasket,
    int OpenOrderCount,
    DateTime? LastPaymentAt,
    int UserCount,
    int LifetimeOrderCount);

public record RevenueTrendPointDto(
    /// <summary>Yerel gün (YYYY-MM-DD) — client'in tz offset'iyle hesaplanmış.</summary>
    string Date,
    decimal Revenue,
    int OrderCount);

public record SupervisorRevenueTrendDto(
    int Days,
    IReadOnlyList<RevenueTrendPointDto> Points);

public record StoreAnalyticsDto(
    Guid StoreId,
    string StoreName,
    string Period,
    DateTime FromUtc,
    DateTime ToUtc,
    decimal TotalRevenue,
    int OrderCount,
    decimal AverageBasket,
    int OpenOrderCount,
    int CancelledOrderCount,
    IReadOnlyList<HourlyPointDto> Hourly,
    IReadOnlyList<RevenueTrendPointDto> Daily,
    IReadOnlyList<TopProductDto> TopProducts,
    IReadOnlyList<OpenOrderRowDto> OpenOrders,
    IReadOnlyList<PaymentMethodBreakdown> PaymentBreakdown,
    IReadOnlyList<OrderTypeBreakdown> OrderTypeBreakdown);

public record HourlyPointDto(
    /// <summary>0..23 — client'in yerel saati.</summary>
    int Hour,
    decimal Revenue,
    int OrderCount);

public record TopProductDto(
    Guid ProductId,
    string ProductName,
    int Quantity,
    decimal Revenue);

public record OpenOrderRowDto(
    Guid OrderId,
    string OrderNumber,
    OrderType OrderType,
    decimal Total,
    string? TableName,
    string? CustomerName,
    DateTime CreatedAt,
    FulfillmentStatus FulfillmentStatus);
