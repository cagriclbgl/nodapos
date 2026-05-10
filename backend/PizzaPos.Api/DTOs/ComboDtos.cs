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
    string Label,
    Guid CategoryId,
    string CategoryName,
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
    string Label,
    Guid CategoryId,
    int Quantity,
    int DisplayOrder);

/// <summary>
/// Sipariş ekranından combo eklemek için kullanılır. Her slot için kasiyerin
/// seçtiği ürünler. Backend slot başına tek bir snapshot OrderItem yaratır;
/// ProductId, slot seçimlerinin ilkidir (FK için), ProductName/UnitPrice ise
/// Combo'dan kopyalanır (tarihsel snapshot).
/// </summary>
public record AddComboToOrderRequest(
    Guid ComboId,
    int Quantity,
    IReadOnlyList<ComboSlotSelection> Selections);

public record ComboSlotSelection(
    Guid ComboItemId,
    IReadOnlyList<Guid> ProductIds);
