using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Services;

public interface IOrderService
{
    Task<IReadOnlyList<OrderDto>> ListAsync(
        OrderStatus? status,
        Guid? tableId,
        DateTime? from,
        DateTime? to,
        CancellationToken ct = default);

    Task<OrderDto?> GetAsync(Guid id, CancellationToken ct = default);
    Task<OrderDto> CreateAsync(CreateOrderRequest request, CancellationToken ct = default);
    Task<OrderDto> AddItemAsync(Guid orderId, AddOrderItemRequest item, CancellationToken ct = default);

    Task<OrderDto> UpdateItemAsync(Guid orderId, Guid itemId, UpdateOrderItemRequest request, CancellationToken ct = default);
    Task<OrderDto> RemoveItemAsync(Guid orderId, Guid itemId, CancellationToken ct = default);

    Task<OrderDto> UpdateDetailsAsync(Guid orderId, UpdateOrderDetailsRequest request, CancellationToken ct = default);

    /// <summary>
    /// Atomically: writes Payment rows, marks Order as Completed, and frees the
    /// linked Table (Status=Empty). Rolls back fully on any failure.
    /// </summary>
    Task<OrderDto> CompleteAsync(Guid orderId, CompleteOrderRequest request, CancellationToken ct = default);

    Task<OrderDto> CancelAsync(Guid orderId, CancellationToken ct = default);

    /// <summary>
    /// Combo'yu siparişe tek bir snapshot OrderItem olarak ekler. Her slot
    /// seçimleri Notes alanına yazılır. ProductId slot'tan seçilen ilk ürün
    /// olur (FK için), ProductName ve UnitPrice Combo'dan kopyalanır.
    /// </summary>
    Task<OrderDto> AddComboAsync(Guid orderId, AddComboToOrderRequest request, CancellationToken ct = default);

    /// <summary>
    /// Masasız (Takeaway/Delivery) sipariş yaratır. Caller ID akışı ve genel
    /// paket sipariş ekranı kullanır. CustomerId zorunlu; Delivery için
    /// adres bilgisi (CustomerAddressId VEYA inline AddressLine) zorunlu.
    /// IncomingCallId verilirse o çağrı otomatik Handled olarak işaretlenir.
    /// </summary>
    Task<OrderDto> CreateDeliveryAsync(CreateDeliveryOrderRequest request, CancellationToken ct = default);

    /// <summary>
    /// Delivery transition akışı: Pending → InKitchen → Ready → OutForDelivery → Delivered.
    /// CourierUserId yalnızca OutForDelivery'ye geçerken set edilir.
    /// </summary>
    Task<OrderDto> UpdateFulfillmentAsync(
        Guid orderId, UpdateFulfillmentStatusRequest request, CancellationToken ct = default);
}
