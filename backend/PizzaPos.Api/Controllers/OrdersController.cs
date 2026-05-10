using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;
using PizzaPos.Api.Services;

namespace PizzaPos.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class OrdersController : TenantControllerBase
{
    private readonly IOrderService _service;

    public OrdersController(IOrderService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<OrderDto>>> List(
        [FromQuery] OrderStatus? status,
        [FromQuery] Guid? tableId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken ct)
        => Ok(await _service.ListAsync(status, tableId, from, to, ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<OrderDto>> Get(Guid id, CancellationToken ct)
    {
        var dto = await _service.GetAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<OrderDto>> Create(
        [FromBody] CreateOrderRequest request, CancellationToken ct)
    {
        var created = await _service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPost("{id:guid}/items")]
    public async Task<ActionResult<OrderDto>> AddItem(
        Guid id, [FromBody] AddOrderItemRequest request, CancellationToken ct)
        => Ok(await _service.AddItemAsync(id, request, ct));

    [HttpPost("{id:guid}/combos")]
    public async Task<ActionResult<OrderDto>> AddCombo(
        Guid id, [FromBody] AddComboToOrderRequest request, CancellationToken ct)
        => Ok(await _service.AddComboAsync(id, request, ct));

    [HttpPatch("{id:guid}/items/{itemId:guid}")]
    public async Task<ActionResult<OrderDto>> UpdateItem(
        Guid id, Guid itemId, [FromBody] UpdateOrderItemRequest request, CancellationToken ct)
        => Ok(await _service.UpdateItemAsync(id, itemId, request, ct));

    [HttpDelete("{id:guid}/items/{itemId:guid}")]
    public async Task<ActionResult<OrderDto>> RemoveItem(
        Guid id, Guid itemId, CancellationToken ct)
        => Ok(await _service.RemoveItemAsync(id, itemId, ct));

    [HttpPatch("{id:guid}/details")]
    public async Task<ActionResult<OrderDto>> UpdateDetails(
        Guid id, [FromBody] UpdateOrderDetailsRequest request, CancellationToken ct)
        => Ok(await _service.UpdateDetailsAsync(id, request, ct));

    /// <summary>
    /// Atomic completion: writes Payments, marks Order=Completed, frees the Table.
    /// </summary>
    [HttpPost("{id:guid}/complete")]
    public async Task<ActionResult<OrderDto>> Complete(
        Guid id, [FromBody] CompleteOrderRequest request, CancellationToken ct)
        => Ok(await _service.CompleteAsync(id, request, ct));

    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult<OrderDto>> Cancel(Guid id, CancellationToken ct)
        => Ok(await _service.CancelAsync(id, ct));
}
