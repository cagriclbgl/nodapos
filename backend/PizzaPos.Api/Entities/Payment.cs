namespace PizzaPos.Api.Entities;

public class Payment : TenantEntity
{
    public Guid OrderId { get; set; }
    public Order? Order { get; set; }

    public decimal Amount { get; set; }
    public PaymentMethod Method { get; set; } = PaymentMethod.Cash;
    public DateTime PaidAt { get; set; } = DateTime.UtcNow;

    public string? ReferenceNumber { get; set; }
    public string? Notes { get; set; }

    /// <summary>
    /// User (cashier/manager) who took the payment. Stored without an FK constraint
    /// so the audit trail survives even if the User record is later deleted.
    /// </summary>
    public Guid? CreatedByUserId { get; set; }
}
