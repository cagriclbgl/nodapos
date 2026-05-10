namespace PizzaPos.Api.Entities;

public class Order : TenantEntity
{
    public string OrderNumber { get; set; } = string.Empty;

    public Guid? TableId { get; set; }
    public Table? Table { get; set; }

    public OrderStatus Status { get; set; } = OrderStatus.Active;
    public OrderType OrderType { get; set; } = OrderType.DineIn;

    public decimal Subtotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal Total { get; set; }

    public string? CustomerName { get; set; }
    public string? CustomerPhone { get; set; }
    public string? Notes { get; set; }

    /// <summary>
    /// Optional link to a Customer record. Stored without an FK constraint so
    /// the Order's snapshotted CustomerName/CustomerPhone survive even if the
    /// Customer is later deleted. Used for the customer history endpoint.
    /// </summary>
    public Guid? CustomerId { get; set; }

    /// <summary>
    /// Optional link to a CustomerAddress (used by Faz C delivery flow).
    /// Stored without an FK constraint for the same reason as CustomerId.
    /// </summary>
    public Guid? CustomerAddressId { get; set; }

    public DateTime? CompletedAt { get; set; }
    public DateTime? CancelledAt { get; set; }

    /// <summary>
    /// Delivery (paket/kurye) sipariş için adres metni snapshot'ı. CustomerAddressId
    /// silinse de bu metin korunur. DineIn/Takeaway için null.
    /// </summary>
    public string? DeliveryAddressSnapshot { get; set; }

    public string? DeliveryDistrict { get; set; }

    /// <summary>Mutfak / kurye akışı durumu. DineIn için kullanılmaz (Pending kalır).</summary>
    public FulfillmentStatus FulfillmentStatus { get; set; } = FulfillmentStatus.Pending;

    /// <summary>Atanmış kurye User Id. FK yok (audit korur). Null = atanmadı.</summary>
    public Guid? AssignedCourierUserId { get; set; }

    public DateTime? OutForDeliveryAt { get; set; }
    public DateTime? DeliveredAt { get; set; }

    /// <summary>Çağrıdan geldiyse ilgili IncomingCall.Id. FK yok.</summary>
    public Guid? IncomingCallId { get; set; }

    /// <summary>
    /// User (cashier/manager) who created the order. Stored without an FK constraint so
    /// the audit trail survives even if the User record is later deleted.
    /// </summary>
    public Guid? CreatedByUserId { get; set; }

    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
}
