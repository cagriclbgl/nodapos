namespace PizzaPos.Api.Entities;

public class Table : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public int Capacity { get; set; } = 4;
    public TableStatus Status { get; set; } = TableStatus.Empty;
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
