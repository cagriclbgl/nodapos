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
    IReadOnlyList<PaymentDto> Payments);

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
