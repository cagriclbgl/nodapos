using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Services;

namespace PizzaPos.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class ProductsController : TenantControllerBase
{
    private readonly IProductService _service;

    public ProductsController(IProductService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProductDto>>> List(
        [FromQuery] Guid? categoryId, CancellationToken ct)
        => Ok(await _service.ListAsync(categoryId, ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProductDto>> Get(Guid id, CancellationToken ct)
    {
        var dto = await _service.GetAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<ProductDto>> Create(
        [FromBody] CreateProductRequest request, CancellationToken ct)
    {
        var created = await _service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ProductDto>> Update(
        Guid id, [FromBody] UpdateProductRequest request, CancellationToken ct)
        => Ok(await _service.UpdateAsync(id, request, ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _service.DeleteAsync(id, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/options")]
    public async Task<ActionResult<ProductOptionDto>> AddOption(
        Guid id, [FromBody] CreateProductOptionRequest request, CancellationToken ct)
        => Ok(await _service.AddOptionAsync(id, request, ct));

    [HttpPut("options/{optionId:guid}")]
    public async Task<ActionResult<ProductOptionDto>> UpdateOption(
        Guid optionId, [FromBody] UpdateProductOptionRequest request, CancellationToken ct)
        => Ok(await _service.UpdateOptionAsync(optionId, request, ct));

    [HttpDelete("options/{optionId:guid}")]
    public async Task<IActionResult> DeleteOption(Guid optionId, CancellationToken ct)
    {
        await _service.DeleteOptionAsync(optionId, ct);
        return NoContent();
    }
}
