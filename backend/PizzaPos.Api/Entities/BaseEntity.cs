namespace PizzaPos.Api.Entities;

public abstract class BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

public abstract class TenantEntity : BaseEntity
{
    public Guid StoreId { get; set; }
    public Store? Store { get; set; }
}
