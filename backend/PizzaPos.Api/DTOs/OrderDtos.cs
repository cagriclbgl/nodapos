using PizzaPos.Api.Entities;

namespace PizzaPos.Api.DTOs;

public record OrderDto(
    Guid Id,
    string OrderNumber,
    Guid? TableId,
    string? TableName,
    OrderStatus Status,
    OrderType OrderType,
    decimal Subtotal,
    decimal DiscountAmount,
    decimal Total,
    string? CustomerName,
    string? CustomerPhone,
    string? Notes,
    DateTime CreatedAt,
    DateTime? CompletedAt,
    DateTime? CancelledAt,
    IReadOnlyList<OrderItemDto> Items,
    IReadOnlyList<PaymentDto> Payments,
    string? DeliveryAddressSnapshot = null,
    string? DeliveryDistrict = null,
    FulfillmentStatus FulfillmentStatus = FulfillmentStatus.Pending,
    Guid? AssignedCourierUserId = null,
    DateTime? OutForDeliveryAt = null,
    DateTime? DeliveredAt = null,
    Guid? IncomingCallId = null);

/// <summary>
/// POST /api/orders/delivery — masasız (Takeaway/Delivery) sipariş yaratır.
/// CustomerId zorunlu (telefondan gelen kayıtlı müşteriler içindir); Delivery
/// için adres bilgisi de zorunlu (CustomerAddressId VEYA inline AddressLine).
/// </summary>
public record CreateDeliveryOrderRequest(
    OrderType OrderType,
    Guid CustomerId,
    Guid? CustomerAddressId,
    string? AddressLine,
    string? District,
    string? Notes,
    decimal DiscountAmount,
    IReadOnlyList<AddOrderItemRequest> Items,
    Guid? IncomingCallId = null);

/// <summary>
/// PATCH /api/orders/{id}/fulfillment — Pending → InKitchen → Ready → OutForDelivery → Delivered.
/// CourierUserId yalnızca OutForDelivery'ye geçerken anlamlı.
/// </summary>
public record UpdateFulfillmentStatusRequest(
    FulfillmentStatus Status,
    Guid? CourierUserId);

public record OrderItemDto(
    Guid Id,
    Guid ProductId,
    string ProductName,
    decimal UnitPrice,
    int Quantity,
    decimal LineTotal,
    string? Notes,
    IReadOnlyList<OrderItemOptionDto> Options);

public record OrderItemOptionDto(
    Guid Id,
    Guid? ProductOptionId,
    string GroupName,
    string OptionName,
    decimal AdditionalPrice);

public record CreateOrderRequest(
    Guid? TableId,
    OrderType OrderType,
    string? CustomerName,
    string? CustomerPhone,
    string? Notes,
    decimal DiscountAmount,
    IReadOnlyList<AddOrderItemRequest> Items,
    Guid? CustomerId = null);

public record AddOrderItemRequest(
    Guid ProductId,
    int Quantity,
    string? Notes,
    IReadOnlyList<Guid> ProductOptionIds);

public record UpdateOrderItemRequest(int Quantity);

public record UpdateOrderDetailsRequest(
    string? CustomerName,
    string? CustomerPhone,
    string? Notes);
