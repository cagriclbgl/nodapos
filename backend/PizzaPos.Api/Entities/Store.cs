namespace PizzaPos.Api.Entities;

public class Store : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public string? TaxNumber { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<Table> Tables { get; set; } = new List<Table>();
    public ICollection<Category> Categories { get; set; } = new List<Category>();
    public ICollection<Product> Products { get; set; } = new List<Product>();
    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
