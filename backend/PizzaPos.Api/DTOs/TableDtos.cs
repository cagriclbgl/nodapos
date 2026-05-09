using PizzaPos.Api.Entities;

namespace PizzaPos.Api.DTOs;

public record TableDto(
    Guid Id,
    string Name,
    int Capacity,
    TableStatus Status,
    int DisplayOrder,
    bool IsActive);

public record CreateTableRequest(
    string Name,
    int Capacity,
    int DisplayOrder);

public record UpdateTableRequest(
    string Name,
    int Capacity,
    int DisplayOrder,
    bool IsActive);

public record UpdateTableStatusRequest(TableStatus Status);
