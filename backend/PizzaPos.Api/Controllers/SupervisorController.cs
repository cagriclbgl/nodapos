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
    private readonly ISupervisorAnalyticsService _analytics;
    private readonly IStoreRegistrationService _registrations;
    private readonly ICurrentUserAccessor _currentUser;

    public SupervisorController(
        ISupervisorAdminService admin,
        ISupervisorAnalyticsService analytics,
        IStoreRegistrationService registrations,
        ICurrentUserAccessor currentUser)
    {
        _admin = admin;
        _analytics = analytics;
        _registrations = registrations;
        _currentUser = currentUser;
    }

    // -- Dashboard ----------------------------------------------------------

    [HttpGet("dashboard")]
    public async Task<ActionResult<SupervisorDashboardDto>> Dashboard(CancellationToken ct)
        => Ok(await _admin.GetDashboardAsync(ct));

    // -- Analytics ----------------------------------------------------------

    [HttpGet("analytics/today")]
    public async Task<ActionResult<SupervisorTodaySummaryDto>> AnalyticsToday(
        [FromQuery] int tzOffsetMinutes = 180,
        CancellationToken ct = default)
        => Ok(await _analytics.GetTodayAsync(tzOffsetMinutes, ct));

    [HttpGet("analytics/revenue-trend")]
    public async Task<ActionResult<SupervisorRevenueTrendDto>> AnalyticsRevenueTrend(
        [FromQuery] int days = 7,
        [FromQuery] int tzOffsetMinutes = 180,
        CancellationToken ct = default)
        => Ok(await _analytics.GetRevenueTrendAsync(days, tzOffsetMinutes, ct));

    [HttpGet("stores/{id:guid}/analytics")]
    public async Task<ActionResult<StoreAnalyticsDto>> StoreAnalytics(
        Guid id,
        [FromQuery] string period = "today",
        [FromQuery] int tzOffsetMinutes = 180,
        CancellationToken ct = default)
    {
        var dto = await _analytics.GetStoreAnalyticsAsync(id, period, tzOffsetMinutes, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

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
