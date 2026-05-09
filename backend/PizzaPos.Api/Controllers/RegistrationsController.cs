using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Services;

namespace PizzaPos.Api.Controllers;

[ApiController]
[Route("api/registrations")]
[AllowAnonymous]
public class RegistrationsController : ControllerBase
{
    private readonly IStoreRegistrationService _service;

    public RegistrationsController(IStoreRegistrationService service)
    {
        _service = service;
    }

    [HttpPost]
    public async Task<ActionResult<object>> Create(
        [FromBody] CreateStoreRegistrationRequest request, CancellationToken ct)
    {
        var id = await _service.CreateAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, new { id });
    }
}
