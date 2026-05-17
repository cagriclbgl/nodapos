using PizzaPos.Api.DTOs;

namespace PizzaPos.Api.Services;

/// <summary>
/// Cross-tenant operasyonel analitik. Tüm metotlar
/// <c>IgnoreQueryFilters()</c> ile global tenant filter'ı bypass eder.
/// Saat dilimi: client browser'ının dakika cinsinden offset'ini
/// (UTC +180 = TR) gönderir; servis o offset'i kullanarak yerel günün
/// UTC aralığını hesaplar.
/// </summary>
public interface ISupervisorAnalyticsService
{
    /// <summary>
    /// Bugünkü cross-tenant özet + mağaza-bazında satır. "Bugün" =
    /// client tz offset'ine göre yerel gün başlangıcı (00:00) ile
    /// ertesi gün başlangıcı arası UTC aralık. Revenue = Payment.Amount.
    /// </summary>
    Task<SupervisorTodaySummaryDto> GetTodayAsync(int tzOffsetMinutes, CancellationToken ct = default);

    /// <summary>
    /// Son N günün (dahil bugün) günlük ciro/sipariş sayısı serisi.
    /// Days 1..90 ile sınırlandırılır.
    /// </summary>
    Task<SupervisorRevenueTrendDto> GetRevenueTrendAsync(int days, int tzOffsetMinutes, CancellationToken ct = default);

    /// <summary>
    /// Tek mağaza performans paneli. period = "today" | "7d" | "30d".
    /// today: saatlik dağılım + açık siparişler dolu, günlük seri boş.
    /// 7d/30d: günlük seri dolu, saatlik/açık siparişler boş.
    /// Top products: aralıkta tamamlanan siparişlerden — en çok satan 10.
    /// </summary>
    Task<StoreAnalyticsDto?> GetStoreAnalyticsAsync(Guid storeId, string period, int tzOffsetMinutes, CancellationToken ct = default);
}
