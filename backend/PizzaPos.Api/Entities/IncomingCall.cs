namespace PizzaPos.Api.Entities;

/// <summary>
/// Çağrı geldiğinde Caller ID kutusu (USB HID, VID 0x1A86 PID 0xE008) Electron
/// main process'e ham raporu yayar; main process burayı POST /api/incoming-calls
/// ile doldurur. Müşteri eşleşmesi (telefonla) hemen aynı isteğin response'unda
/// dönülür ve renderer'a IPC ile iletilir.
/// </summary>
public class IncomingCall : TenantEntity
{
    /// <summary>Normalize edilmiş telefon numarası (boş olabilir — bilinmeyen numara).</summary>
    public string? Phone { get; set; }

    /// <summary>Caller ID kutusunun hangi hattından geldi (1..N). Tek hatlı kutuda null.</summary>
    public int? LineNumber { get; set; }

    public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;

    /// <summary>Telefon numarası mevcut bir Customer ile eşleşirse o Id. FK yok — silinme dayanıklılığı.</summary>
    public Guid? MatchedCustomerId { get; set; }

    /// <summary>Çağrı bir Order'a bağlandıysa (sipariş oluşturulduğunda) o Id. FK yok.</summary>
    public Guid? ResolvedOrderId { get; set; }

    public IncomingCallStatus Status { get; set; } = IncomingCallStatus.New;

    /// <summary>"İlgilenildi", "Cevapsız işaretlendi" gibi aksiyonu yapan kullanıcı. FK yok.</summary>
    public Guid? HandledByUserId { get; set; }

    public DateTime? HandledAt { get; set; }

    public string? Note { get; set; }

    /// <summary>HID parser'ından gelen ham hex (debug + cevapsız çağrı sebep analizi için).</summary>
    public string? RawPayloadHex { get; set; }
}
