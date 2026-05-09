namespace PizzaPos.Api.Entities;

public class Product : TenantEntity
{
    public Guid CategoryId { get; set; }
    public Category? Category { get; set; }

    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsAvailable { get; set; } = true;
    public int DisplayOrder { get; set; }

    public ICollection<ProductOption> Options { get; set; } = new List<ProductOption>();
    public ICollection<OrderItem> OrderItems { get; set; } = new List<OrderItem>();
}
