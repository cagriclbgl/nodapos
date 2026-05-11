namespace PizzaPos.Api.Entities;

/// <summary>
/// Kampanya menüsü — sabit fiyatlı, sabit ürün listesi olan paket. Örnek:
/// "Aile Menüsü, 599 TL — 2x Klasik Pizza + 1x Cola".
/// Yönetici doğrudan menüden ürünleri seçer; kasiyer combo'ya tıklayınca
/// dialog açılmaz, tek snapshot OrderItem olarak sepete eklenir.
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

    /// <summary>Combo'nun içerdiği ürün — Product.Name kullanılır.</summary>
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }

    /// <summary>Bu üründen kaç adet (örn. "2x Klasik Pizza").</summary>
    public int Quantity { get; set; } = 1;

    public int DisplayOrder { get; set; }
}
