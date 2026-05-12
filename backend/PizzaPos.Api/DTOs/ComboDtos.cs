namespace PizzaPos.Api.DTOs;

public record ComboDto(
    Guid Id,
    string Name,
    string? Description,
    decimal Price,
    decimal? DeliveryPrice,
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
    decimal? DeliveryPrice,
    int DisplayOrder,
    IReadOnlyList<CreateComboItemRequest> Items);

public record UpdateComboRequest(
    string Name,
    string? Description,
    decimal Price,
    decimal? DeliveryPrice,
    bool IsActive,
    int DisplayOrder,
    IReadOnlyList<CreateComboItemRequest> Items);

public record CreateComboItemRequest(
    Guid ProductId,
    int Quantity,
    int DisplayOrder);

/// <summary>
/// AddCombo: kasiyer kombo'yu sepete eklemek için combo id + adet gönderir.
/// Eğer combo'daki ürünlerden biri seçeneklere sahipse (örn. Boyut), kasiyer
/// her bir ürün için seçtiği opsiyon id'lerini <c>ItemOptionSelections</c>'da
/// (anahtar = comboItemId) listeler. Backend snapshot Notes'a "1x Kutu Kola
/// (Büyük)" şeklinde basar — kombo fiyatı sabit, opsiyonlar bilgi amaçlı.
/// </summary>
public record AddComboToOrderRequest(
    Guid ComboId,
    int Quantity,
    IReadOnlyDictionary<Guid, IReadOnlyList<Guid>>? ItemOptionSelections);
