namespace PizzaPos.Api.Entities;

public class OrderItemOption : TenantEntity
{
    public Guid OrderItemId { get; set; }
    public OrderItem? OrderItem { get; set; }

    // Nullable: if the underlying ProductOption is later deleted, the historical
    // record still survives via the snapshot fields below.
    public Guid? ProductOptionId { get; set; }
    public ProductOption? ProductOption { get; set; }

    // SNAPSHOT: copied from ProductOption at the moment the option is selected.
    public string GroupName { get; set; } = string.Empty;
    public string OptionName { get; set; } = string.Empty;
    public decimal AdditionalPrice { get; set; }
}
