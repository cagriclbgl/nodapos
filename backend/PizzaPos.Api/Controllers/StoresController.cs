using Microsoft.AspNetCore.Mvc;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Services;

namespace PizzaPos.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StoresController : ControllerBase
{
    private readonly IStoreService _service;

    public StoresController(IStoreService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<StoreDto>>> List(CancellationToken ct)
        => Ok(await _service.ListAsync(ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<StoreDto>> Get(Guid id, CancellationToken ct)
    {
        var dto = await _service.GetAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<StoreDto>> Create([FromBody] CreateStoreRequest request, CancellationToken ct)
    {
        var created = await _service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<StoreDto>> Update(Guid id, [FromBody] UpdateStoreRequest request, CancellationToken ct)
        => Ok(await _service.UpdateAsync(id, request, ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _service.DeleteAsync(id, ct);
        return NoContent();
    }
}
