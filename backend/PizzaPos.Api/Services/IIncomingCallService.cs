using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Services;

public interface IIncomingCallService
{
    /// <summary>
    /// Caller ID (HID) main process'inden gelir. Telefon numarası varsa Customer
    /// match edilir, response'da kayıtlı müşteri kartı + son siparişler döner;
    /// renderer modal'i bunu doğrudan gösterebilir.
    /// </summary>
    Task<IncomingCallDto> RecordAsync(RecordIncomingCallRequest request, CancellationToken ct = default);

    /// <summary>
    /// /pos/calls ve /admin/calls listeleri için. Status null = hepsi.
    /// </summary>
    Task<IReadOnlyList<IncomingCallDto>> ListAsync(
        DateTime? from,
        DateTime? to,
        IncomingCallStatus? status,
        int? limit,
        CancellationToken ct = default);

    Task<IncomingCallDto?> GetAsync(Guid id, CancellationToken ct = default);

    /// <summary>
    /// Kasiyer çağrıyı bir Order'a bağlar (OrderId set) veya manuel olarak Status değiştirir
    /// (örn. "Cevapsız işaretle" → Missed). HandledByUserId / HandledAt otomatik stamp.
    /// </summary>
    Task<IncomingCallDto> ResolveAsync(Guid id, ResolveIncomingCallRequest request, CancellationToken ct = default);

    Task<IncomingCallDto> UpdateNoteAsync(Guid id, UpdateIncomingCallNoteRequest request, CancellationToken ct = default);
}
