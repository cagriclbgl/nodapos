namespace PizzaPos.Api.Entities;

public class CustomerAddress : TenantEntity
{
    public Guid CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public string Label { get; set; } = string.Empty;
    public string AddressLine { get; set; } = string.Empty;
    public string? District { get; set; }
    public string? Notes { get; set; }
    public bool IsDefault { get; set; }
}
