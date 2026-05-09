using PizzaPos.Api.Entities;

namespace PizzaPos.Api.DTOs;

public record PaymentDto(
    Guid Id,
    decimal Amount,
    PaymentMethod Method,
    DateTime PaidAt,
    string? ReferenceNumber,
    string? Notes);

public record PaymentLineRequest(
    decimal Amount,
    PaymentMethod Method,
    string? ReferenceNumber,
    string? Notes);

public record CompleteOrderRequest(
    IReadOnlyList<PaymentLineRequest> Payments);
