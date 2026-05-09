using Microsoft.AspNetCore.Mvc;

namespace PizzaPos.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    /// <summary>
    /// Lightweight liveness endpoint. A scheduled job pings this every 14 minutes
    /// to keep Render's free-tier instance from sleeping (CLAUDE.md / Keep-Alive).
    /// </summary>
    [HttpGet]
    public IActionResult Get() => Ok(new
    {
        status = "ok",
        timestamp = DateTime.UtcNow,
        version = typeof(HealthController).Assembly.GetName().Version?.ToString()
    });
}
