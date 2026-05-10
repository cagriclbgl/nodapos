using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Services;

namespace PizzaPos.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class CombosController : TenantControllerBase
{
    private readonly IComboService _service;

    public CombosController(IComboService service) => _service = service;

    /// <summary>
    /// Combo listesi. activeOnly=true vermek kasiyer ekranı için yalnız aktif
    /// olanları döndürür; admin liste sayfasında parametresiz çağrılır.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ComboDto>>> List(
        [FromQuery] bool? activeOnly, CancellationToken ct)
        => Ok(await _service.ListAsync(activeOnly, ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ComboDto>> Get(Guid id, CancellationToken ct)
    {
        var dto = await _service.GetAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    [Authorize(Roles = "Manager")]
    public async Task<ActionResult<ComboDto>> Create(
        [FromBody] CreateComboRequest request, CancellationToken ct)
    {
        var created = await _service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Manager")]
    public async Task<ActionResult<ComboDto>> Update(
        Guid id, [FromBody] UpdateComboRequest request, CancellationToken ct)
        => Ok(await _service.UpdateAsync(id, request, ct));

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Manager")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _service.DeleteAsync(id, ct);
        return NoContent();
    }
}
