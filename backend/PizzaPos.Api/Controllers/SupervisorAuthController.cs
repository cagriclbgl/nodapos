using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PizzaPos.Api.Auth;
using PizzaPos.Api.Data;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;
using PizzaPos.Api.Services;

namespace PizzaPos.Api.Controllers;

[ApiController]
[Route("api/supervisor/auth")]
public class SupervisorAuthController : ControllerBase
{
    private readonly ISupervisorAuthService _auth;
    private readonly IJwtTokenService _jwt;
    private readonly ICurrentUserAccessor _currentUser;
    private readonly IHostEnvironment _env;
    private readonly AppDbContext _db;

    public SupervisorAuthController(
        ISupervisorAuthService auth,
        IJwtTokenService jwt,
        ICurrentUserAccessor currentUser,
        IHostEnvironment env,
        AppDbContext db)
    {
        _auth = auth;
        _jwt = jwt;
        _currentUser = currentUser;
        _env = env;
        _db = db;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<SupervisorSessionResponse>> Login(
        [FromBody] SupervisorLoginRequest request, CancellationToken ct)
    {
        var (sup, response) = await _auth.LoginAsync(request, ct);
        IssueCookie(sup);
        return Ok(response);
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public IActionResult Logout()
    {
        AuthCookie.ClearSupervisor(Response, _env);
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize(Policy = JwtOptions.SupervisorRole)]
    public async Task<ActionResult<SupervisorSessionResponse>> Me(CancellationToken ct)
    {
        if (!_currentUser.IsAuthenticated || _currentUser.UserId is not Guid sid)
            return Unauthorized();

        var session = await _auth.GetSessionAsync(sid, ct);
        if (session is null)
        {
            AuthCookie.ClearSupervisor(Response, _env);
            return Unauthorized();
        }

        var sup = await _db.Supervisors.FirstOrDefaultAsync(s => s.Id == sid, ct);
        if (sup is not null) IssueCookie(sup);

        return Ok(session);
    }

    private void IssueCookie(Supervisor sup)
    {
        var (token, expires) = _jwt.IssueForSupervisor(sup);
        AuthCookie.AppendSupervisor(Response, token, expires, _env);
    }
}
