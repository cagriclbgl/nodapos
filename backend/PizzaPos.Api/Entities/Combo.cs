namespace PizzaPos.Api.Entities;

/// <summary>
/// Kampanya menüsü — sabit fiyatlı, içinde slot'lar olan paket. Örnek:
/// "Aile Menüsü, 599 TL — 2 orta boy pizza + 1 büyük cola".
/// Her slot ComboItem ile temsil edilir; slot seçimi kasada yapılır,
/// snapshot OrderItem'a düşer (mevcut OrderItem şeması değişmez).
/// </summary>
public class Combo : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; }

    public ICollection<ComboItem> Items { get; set; } = new List<ComboItem>();
}

public class ComboItem : TenantEntity
{
    public Guid ComboId { get; set; }
    public Combo? Combo { get; set; }

    /// <summary>Slot etiketi: "1. Pizza", "İçecek" gibi.</summary>
    public string Label { get; set; } = string.Empty;

    /// <summary>Bu slot için seçim havuzu — kasiyer bu kategori'den ürün seçer.</summary>
    public Guid CategoryId { get; set; }
    public Category? Category { get; set; }

    /// <summary>Slot'tan kaç ürün seçilecek.</summary>
    public int Quantity { get; set; } = 1;

    public int DisplayOrder { get; set; }
}
