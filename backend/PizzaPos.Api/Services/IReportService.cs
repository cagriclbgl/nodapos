using PizzaPos.Api.DTOs;

namespace PizzaPos.Api.Services;

public interface IReportService
{
    /// <summary>
    /// Verilen [from, to) yarı-açık UTC aralığında kapanan siparişlerin
    /// ve bu aralıkta ödenen paymentların toplu özetini döner. Kasiyer
    /// "Gün Sonu" ekranı + yazıcı fişi için kullanılır.
    /// </summary>
    Task<DailySummaryDto> GetDailySummaryAsync(
        string dateLabel, DateTime fromUtc, DateTime toUtc, CancellationToken ct = default);

    /// <summary>
    /// Çok günlük aralık özeti — haftalık / aylık raporlar. `topProductsLimit`
    /// kadar en çok satan ürün (adet bazında) listelenir.
    /// </summary>
    Task<PeriodSummaryDto> GetPeriodSummaryAsync(
        string fromLabel,
        string toLabel,
        DateTime fromUtc,
        DateTime toUtc,
        int topProductsLimit,
        CancellationToken ct = default);
}
