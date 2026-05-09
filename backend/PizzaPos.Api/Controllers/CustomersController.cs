using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Services;

namespace PizzaPos.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class CustomersController : TenantControllerBase
{
    private readonly ICustomerService _service;

    public CustomersController(ICustomerService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CustomerListItemDto>>> List(
        [FromQuery] string? search,
        CancellationToken ct)
        => Ok(await _service.SearchAsync(search, ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CustomerDto>> Get(Guid id, CancellationToken ct)
    {
        var dto = await _service.GetAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<CustomerDto>> Create(
        [FromBody] CreateCustomerRequest request, CancellationToken ct)
    {
        var created = await _service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<CustomerDto>> Update(
        Guid id, [FromBody] UpdateCustomerRequest request, CancellationToken ct)
        => Ok(await _service.UpdateAsync(id, request, ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _service.DeleteAsync(id, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/addresses")]
    public async Task<ActionResult<CustomerAddressDto>> AddAddress(
        Guid id, [FromBody] AddressRequest request, CancellationToken ct)
    {
        var created = await _service.AddAddressAsync(id, request, ct);
        return CreatedAtAction(nameof(Get), new { id }, created);
    }

    [HttpPatch("{id:guid}/addresses/{addressId:guid}")]
    public async Task<ActionResult<CustomerAddressDto>> UpdateAddress(
        Guid id, Guid addressId, [FromBody] AddressRequest request, CancellationToken ct)
        => Ok(await _service.UpdateAddressAsync(id, addressId, request, ct));

    [HttpDelete("{id:guid}/addresses/{addressId:guid}")]
    public async Task<IActionResult> DeleteAddress(Guid id, Guid addressId, CancellationToken ct)
    {
        await _service.DeleteAddressAsync(id, addressId, ct);
        return NoContent();
    }

    [HttpGet("{id:guid}/orders")]
    public async Task<ActionResult<IReadOnlyList<OrderDto>>> GetOrders(Guid id, CancellationToken ct)
        => Ok(await _service.GetOrdersAsync(id, ct));
}
