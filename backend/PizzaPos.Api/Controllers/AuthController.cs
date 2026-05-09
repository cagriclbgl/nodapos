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
[Route("api/[controller]")]
[AllowAnonymous]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;
    private readonly IJwtTokenService _jwt;
    private readonly ICurrentUserAccessor _currentUser;
    private readonly IHostEnvironment _env;
    private readonly AppDbContext _db;

    public AuthController(
        IAuthService auth,
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
    public async Task<ActionResult<LoginResponse>> Login(
        [FromBody] LoginRequest request, CancellationToken ct)
    {
        // 423 Locked: store has no Manager yet — frontend should redirect to /setup.
        var hasManager = await _db.Users
            .IgnoreQueryFilters()
            .AnyAsync(u => u.StoreId == request.StoreId && u.Role == UserRole.Manager, ct);
        if (!hasManager)
        {
            // Differentiate "store doesn't exist" (404) from "store has no manager" (423).
            var storeExists = await _db.Stores.AnyAsync(s => s.Id == request.StoreId, ct);
            if (!storeExists) return NotFound();
            return StatusCode(StatusCodes.Status423Locked, new ProblemDetails
            {
                Status = StatusCodes.Status423Locked,
                Title = "Setup required",
                Detail = "This store has no Manager configured yet. Bootstrap the first Manager to continue.",
                Instance = HttpContext.Request.Path
            });
        }

        var (user, _, response) = await _auth.LoginAsync(request, ct);
        IssueCookie(user);
        return Ok(response);
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        AuthCookie.Clear(Response, _env);
        return NoContent();
    }

    [HttpGet("me")]
    public async Task<ActionResult<LoginResponse>> Me(CancellationToken ct)
    {
        if (!_currentUser.IsAuthenticated || _currentUser.UserId is not Guid uid)
            return Unauthorized();

        var session = await _auth.GetSessionAsync(uid, ct);
        if (session is null)
        {
            // Session points at a deleted/inactive user — drop the cookie too.
            AuthCookie.Clear(Response, _env);
            return Unauthorized();
        }

        // Sliding renewal: re-issue cookie on every authenticated /me call so the
        // expiry rolls forward as long as the operator stays active.
        var user = await _db.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == uid, ct);
        if (user is not null) IssueCookie(user);

        return Ok(session);
    }

    [HttpPost("bootstrap")]
    public async Task<ActionResult<LoginResponse>> Bootstrap(
        [FromBody] BootstrapRequest request, CancellationToken ct)
    {
        var (user, _, response) = await _auth.BootstrapAsync(request, ct);
        IssueCookie(user);
        return CreatedAtAction(nameof(Me), null, response);
    }

    private void IssueCookie(User user)
    {
        var (token, expires) = _jwt.Issue(user);
        AuthCookie.Append(Response, token, expires, _env);
    }
}
