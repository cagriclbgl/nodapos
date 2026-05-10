using PizzaPos.Api.Entities;

namespace PizzaPos.Api.DTOs;

/// <summary>
/// Kasa main process'in çağrı geldiğinde POST ettiği body. Phone null/boş olabilir
/// (bilinmeyen numara). LineNumber çok hatlı kutularda dolu gelir.
/// </summary>
public record RecordIncomingCallRequest(
    string? Phone,
    int? LineNumber,
    DateTime? ReceivedAt,
    string? RawPayloadHex);

/// <summary>
/// POST /api/incoming-calls response'u. MatchedCustomer var ise modal müşteri
/// kartını + son siparişleri direkt gösterebilir; yoksa "yeni müşteri" akışına gider.
/// </summary>
public record IncomingCallDto(
    Guid Id,
    string? Phone,
    int? LineNumber,
    DateTime ReceivedAt,
    IncomingCallStatus Status,
    Guid? MatchedCustomerId,
    Guid? ResolvedOrderId,
    DateTime? HandledAt,
    string? Note,
    CustomerSummaryDto? MatchedCustomer,
    IReadOnlyList<RecentOrderSummaryDto> RecentOrders);

public record CustomerSummaryDto(
    Guid Id,
    string Name,
    string Phone,
    string? DefaultAddressLine,
    string? DefaultAddressDistrict);

public record RecentOrderSummaryDto(
    Guid Id,
    string OrderNumber,
    DateTime CreatedAt,
    decimal Total,
    OrderStatus Status,
    OrderType OrderType);

public record ResolveIncomingCallRequest(
    Guid? OrderId,
    IncomingCallStatus? Status);

public record UpdateIncomingCallNoteRequest(string? Note);
