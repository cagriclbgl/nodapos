using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Services;

namespace PizzaPos.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class TablesController : TenantControllerBase
{
    private readonly ITableService _service;

    public TablesController(ITableService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TableDto>>> List(CancellationToken ct)
        => Ok(await _service.ListAsync(ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TableDto>> Get(Guid id, CancellationToken ct)
    {
        var dto = await _service.GetAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<TableDto>> Create([FromBody] CreateTableRequest request, CancellationToken ct)
    {
        var created = await _service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<TableDto>> Update(Guid id, [FromBody] UpdateTableRequest request, CancellationToken ct)
        => Ok(await _service.UpdateAsync(id, request, ct));

    [HttpPatch("{id:guid}/status")]
    public async Task<ActionResult<TableDto>> UpdateStatus(
        Guid id, [FromBody] UpdateTableStatusRequest request, CancellationToken ct)
        => Ok(await _service.UpdateStatusAsync(id, request.Status, ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _service.DeleteAsync(id, ct);
        return NoContent();
    }
}
