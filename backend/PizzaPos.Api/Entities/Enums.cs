namespace PizzaPos.Api.Entities;

public enum TableStatus
{
    Empty = 0,
    Occupied = 1,
    AwaitingPayment = 2
}

public enum OrderStatus
{
    Active = 0,
    Completed = 1,
    Cancelled = 2
}

public enum OrderType
{
    DineIn = 0,
    Takeaway = 1,
    Delivery = 2
}

public enum PaymentMethod
{
    Cash = 0,
    CreditCard = 1,
    DebitCard = 2,
    MealCard = 3,
    Other = 99
}

public enum UserRole
{
    Manager = 1,
    Cashier = 2
}

public enum StoreRegistrationStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2
}

public enum IncomingCallStatus
{
    /// <summary>Çağrı geldi, kasiyer henüz cevaplamadı / bir aksiyon almadı.</summary>
    New = 0,

    /// <summary>Kasiyer çağrıyı bir Order'a bağladı (ResolvedOrderId set).</summary>
    Handled = 1,

    /// <summary>Belli bir süre cevaplanmadı (kasa otomatik) veya kasiyer "Cevapsız" işaretledi.</summary>
    Missed = 2,

    /// <summary>Kasiyer çağrıyı bilinçli olarak görmezden geldi (yeni sipariş istemiyor vb.).</summary>
    Ignored = 3,
}

public enum FulfillmentStatus
{
    Pending = 0,
    InKitchen = 1,
    Ready = 2,
    OutForDelivery = 3,
    Delivered = 4,
}
