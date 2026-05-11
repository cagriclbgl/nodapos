namespace PizzaPos.Api.DTOs;

public record ComboDto(
    Guid Id,
    string Name,
    string? Description,
    decimal Price,
    bool IsActive,
    int DisplayOrder,
    IReadOnlyList<ComboItemDto> Items);

public record ComboItemDto(
    Guid Id,
    Guid ProductId,
    string ProductName,
    int Quantity,
    int DisplayOrder);

public record CreateComboRequest(
    string Name,
    string? Description,
    decimal Price,
    int DisplayOrder,
    IReadOnlyList<CreateComboItemRequest> Items);

public record UpdateComboRequest(
    string Name,
    string? Description,
    decimal Price,
    bool IsActive,
    int DisplayOrder,
    IReadOnlyList<CreateComboItemRequest> Items);

public record CreateComboItemRequest(
    Guid ProductId,
    int Quantity,
    int DisplayOrder);

/// <summary>
/// AddCombo: kasiyer kombo'yu sepete eklemek için tek ID gönderir.
/// Backend tek snapshot OrderItem yaratır (ProductName=combo.Name,
/// UnitPrice=combo.Price, Notes="2x Klasik Pizza, 1x Cola").
/// </summary>
public record AddComboToOrderRequest(
    Guid ComboId,
    int Quantity);
