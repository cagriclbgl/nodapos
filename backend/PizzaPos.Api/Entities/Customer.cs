namespace PizzaPos.Api.Entities;

public class Customer : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<CustomerAddress> Addresses { get; set; } = new List<CustomerAddress>();
}
