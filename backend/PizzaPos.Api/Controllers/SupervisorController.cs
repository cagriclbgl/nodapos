using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PizzaPos.Api.Auth;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;
using PizzaPos.Api.Services;

namespace PizzaPos.Api.Controllers;

[ApiController]
[Route("api/supervisor")]
[Authorize(Policy = JwtOptions.SupervisorRole)]
public class SupervisorController : ControllerBase
{
    private readonly ISupervisorAdminService _admin;
    private readonly IStoreRegistrationService _registrations;
    private readonly ICurrentUserAccessor _currentUser;

    public SupervisorController(
        ISupervisorAdminService admin,
        IStoreRegistrationService registrations,
        ICurrentUserAccessor currentUser)
    {
        _admin = admin;
        _registrations = registrations;
        _currentUser = currentUser;
    }

    // -- Dashboard ----------------------------------------------------------

    [HttpGet("dashboard")]
    public async Task<ActionResult<SupervisorDashboardDto>> Dashboard(CancellationToken ct)
        => Ok(await _admin.GetDashboardAsync(ct));

    // -- Registrations ------------------------------------------------------

    [HttpGet("registrations")]
    public async Task<ActionResult<IReadOnlyList<StoreRegistrationRequestDto>>> ListRegistrations(
        [FromQuery] StoreRegistrationStatus? status, CancellationToken ct)
        => Ok(await _registrations.ListAsync(status, ct));

    [HttpGet("registrations/{id:guid}")]
    public async Task<ActionResult<StoreRegistrationRequestDto>> GetRegistration(Guid id, CancellationToken ct)
    {
        var dto = await _registrations.GetAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("registrations/{id:guid}/approve")]
    public async Task<ActionResult<ApproveRegistrationResponse>> Approve(
        Guid id, [FromBody] ApproveRegistrationRequest request, CancellationToken ct)
    {
        var supervisorId = _currentUser.UserId
            ?? throw new DomainException("Authenticated supervisor id missing.", 401);
        var res = await _registrations.ApproveAsync(id, request, supervisorId, ct);
        return Ok(res);
    }

    [HttpPost("registrations/{id:guid}/reject")]
    public async Task<ActionResult<StoreRegistrationRequestDto>> Reject(
        Guid id, [FromBody] RejectRegistrationRequest request, CancellationToken ct)
    {
        var supervisorId = _currentUser.UserId
            ?? throw new DomainException("Authenticated supervisor id missing.", 401);
        var res = await _registrations.RejectAsync(id, request, supervisorId, ct);
        return Ok(res);
    }

    // -- Stores --------------------------------------------------------------

    [HttpGet("stores")]
    public async Task<ActionResult<IReadOnlyList<StoreOverviewDto>>> ListStores(CancellationToken ct)
        => Ok(await _admin.ListStoresAsync(ct));

    [HttpGet("stores/{id:guid}")]
    public async Task<ActionResult<StoreDto>> GetStore(Guid id, CancellationToken ct)
    {
        var dto = await _admin.GetStoreAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPut("stores/{id:guid}")]
    public async Task<ActionResult<StoreDto>> UpdateStore(
        Guid id, [FromBody] UpdateStoreRequest request, CancellationToken ct)
        => Ok(await _admin.UpdateStoreAsync(id, request, ct));

    // -- Store Users --------------------------------------------------------

    [HttpGet("stores/{id:guid}/users")]
    public async Task<ActionResult<IReadOnlyList<UserDto>>> ListStoreUsers(Guid id, CancellationToken ct)
        => Ok(await _admin.ListStoreUsersAsync(id, ct));

    [HttpPost("stores/{id:guid}/users")]
    public async Task<ActionResult<UserDto>> CreateStoreUser(
        Guid id, [FromBody] SupervisorCreateUserRequest request, CancellationToken ct)
        => Ok(await _admin.CreateStoreUserAsync(id, request, ct));

    [HttpPatch("stores/{id:guid}/users/{userId:guid}")]
    public async Task<ActionResult<UserDto>> UpdateStoreUser(
        Guid id, Guid userId, [FromBody] UpdateUserRequest request, CancellationToken ct)
        => Ok(await _admin.UpdateStoreUserAsync(id, userId, request, ct));

    [HttpPost("stores/{id:guid}/users/{userId:guid}/reset-password")]
    public async Task<IActionResult> ResetStoreUserPassword(
        Guid id, Guid userId, [FromBody] ResetPasswordRequest request, CancellationToken ct)
    {
        await _admin.ResetStoreUserPasswordAsync(id, userId, request, ct);
        return NoContent();
    }
}
