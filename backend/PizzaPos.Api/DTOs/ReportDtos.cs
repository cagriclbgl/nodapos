using PizzaPos.Api.Entities;

namespace PizzaPos.Api.DTOs;

/// <summary>
/// Gün sonu (Z-Rapor light) — belirli bir gün için kapanan siparişlerin
/// toplu özeti. CashierSession entity'si henüz yok, basit tarih-bazlı.
/// Saat dilimi: backend UTC saklar, frontend kasanın yerel saatine göre
/// gün başlangıç/bitiş aralığını gönderir.
/// </summary>
public record DailySummaryDto(
    /// <summary>İstenen yerel gün — "YYYY-MM-DD" (sadece bilgi amaçlı echo).</summary>
    string Date,
    DateTime RangeStartUtc,
    DateTime RangeEndUtc,
    /// <summary>Bu aralıkta CompletedAt'i düşen tüm sipariş sayısı.</summary>
    int CompletedOrderCount,
    /// <summary>Bu aralıkta CancelledAt'i düşen sipariş sayısı (bilgi amaçlı).</summary>
    int CancelledOrderCount,
    /// <summary>Tamamlanan siparişlerin toplam tutarı (Total alanı toplamı).</summary>
    decimal TotalRevenue,
    /// <summary>Tamamlanan siparişlerden uygulanan toplam indirim tutarı.</summary>
    decimal TotalDiscount,
    /// <summary>Tamamlanan siparişlerdeki toplam ürün adedi (line.Quantity toplamı).</summary>
    int TotalItemQuantity,
    /// <summary>Ödeme yöntemi kırılımı — Payment.PaidAt'e göre filtrelenir.</summary>
    IReadOnlyList<PaymentMethodBreakdown> PaymentBreakdown,
    /// <summary>Sipariş tipi kırılımı — masa / paket-gel-al / kurye.</summary>
    IReadOnlyList<OrderTypeBreakdown> OrderTypeBreakdown);

public record PaymentMethodBreakdown(
    PaymentMethod Method,
    int Count,
    decimal Total);

public record OrderTypeBreakdown(
    OrderType OrderType,
    int Count,
    decimal Total);
