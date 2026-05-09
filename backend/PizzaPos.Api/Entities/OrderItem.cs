namespace PizzaPos.Api.Entities;

public class OrderItem : TenantEntity
{
    public Guid OrderId { get; set; }
    public Order? Order { get; set; }

    public Guid ProductId { get; set; }
    public Product? Product { get; set; }

    // SNAPSHOT: copied from Product at the moment the item is added to the order.
    // Future changes to Product.Name / Product.Price MUST NOT mutate historical orders.
    public string ProductName { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }

    public int Quantity { get; set; } = 1;

    // LineTotal = (UnitPrice + sum(OrderItemOption.AdditionalPrice)) * Quantity
    public decimal LineTotal { get; set; }

    public string? Notes { get; set; }

    public ICollection<OrderItemOption> Options { get; set; } = new List<OrderItemOption>();
}
