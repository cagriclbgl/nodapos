namespace PizzaPos.Api.Entities;

public class ProductOption : TenantEntity
{
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }

    public string GroupName { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal AdditionalPrice { get; set; }
    /// <summary>
    /// Paket servis (Delivery) sipariş tipinde uygulanan ek fiyat. Null ise
    /// AdditionalPrice'a düşülür — kasada (gel-al / dine-in) her zaman
    /// AdditionalPrice kullanılır. Product.DeliveryPrice ile aynı semantik.
    /// </summary>
    public decimal? DeliveryAdditionalPrice { get; set; }
    public bool IsRequired { get; set; }
    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; }
}
