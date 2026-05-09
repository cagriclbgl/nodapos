namespace PizzaPos.Api.Entities;

public class StoreRegistrationRequest : BaseEntity
{
    public string StoreName { get; set; } = string.Empty;
    public string ContactName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? Notes { get; set; }

    public StoreRegistrationStatus Status { get; set; } = StoreRegistrationStatus.Pending;
    public DateTime? ProcessedAt { get; set; }
    public Guid? ProcessedBySupervisorId { get; set; }
    public Guid? CreatedStoreId { get; set; }
    public string? RejectionReason { get; set; }
}
