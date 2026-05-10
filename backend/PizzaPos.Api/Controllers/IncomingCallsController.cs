using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;
using PizzaPos.Api.Services;

namespace PizzaPos.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/incoming-calls")]
public class IncomingCallsController : TenantControllerBase
{
    private readonly IIncomingCallService _service;

    public IncomingCallsController(IIncomingCallService service) => _service = service;

    /// <summary>
    /// Caller ID kutusundan gelen çağrıyı kaydeder. Kasa Electron main process
    /// `node-hid` parser'ını çağırdıktan sonra burayı POST eder. Authenticated:
    /// kasa Electron çocuk process'inde aktif Cashier oturumunun cookie'si geçer.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<IncomingCallDto>> Record(
        [FromBody] RecordIncomingCallRequest request, CancellationToken ct)
    {
        var dto = await _service.RecordAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = dto.Id }, dto);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<IncomingCallDto>>> List(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] IncomingCallStatus? status,
        [FromQuery] int? limit,
        CancellationToken ct)
        => Ok(await _service.ListAsync(from, to, status, limit, ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<IncomingCallDto>> Get(Guid id, CancellationToken ct)
    {
        var dto = await _service.GetAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPatch("{id:guid}/resolve")]
    public async Task<ActionResult<IncomingCallDto>> Resolve(
        Guid id, [FromBody] ResolveIncomingCallRequest request, CancellationToken ct)
        => Ok(await _service.ResolveAsync(id, request, ct));

    [HttpPatch("{id:guid}/note")]
    public async Task<ActionResult<IncomingCallDto>> UpdateNote(
        Guid id, [FromBody] UpdateIncomingCallNoteRequest request, CancellationToken ct)
        => Ok(await _service.UpdateNoteAsync(id, request, ct));
}
