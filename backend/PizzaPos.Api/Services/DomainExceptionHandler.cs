using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace PizzaPos.Api.Services;

public class DomainExceptionHandler : IExceptionHandler
{
    private readonly ILogger<DomainExceptionHandler> _logger;
    private readonly IHostEnvironment _env;

    public DomainExceptionHandler(
        ILogger<DomainExceptionHandler> logger,
        IHostEnvironment env)
    {
        _logger = logger;
        _env = env;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is DomainException dx)
        {
            _logger.LogInformation(dx,
                "Domain exception ({StatusCode}) at {Path}: {Message}",
                dx.StatusCode, httpContext.Request.Path, dx.Message);

            await WriteProblemAsync(
                httpContext, dx.StatusCode, TitleFor(dx.StatusCode), dx.Message, cancellationToken);
            return true;
        }

        // Anything else is a bug or infrastructure failure. Log full stack and
        // — in development — surface the type+message so the client toast is
        // useful instead of "An error occurred". Production sanitizes detail.
        _logger.LogError(exception,
            "Unhandled exception at {Path}: {Message}",
            httpContext.Request.Path, exception.Message);

        var detail = _env.IsDevelopment()
            ? $"{exception.GetType().Name}: {exception.Message}"
            : "An unexpected error occurred. Please try again.";

        await WriteProblemAsync(
            httpContext, 500, "Internal Server Error", detail, cancellationToken);
        return true;
    }

    private static string TitleFor(int status) => status switch
    {
        404 => "Not Found",
        409 => "Conflict",
        _ => "Bad Request"
    };

    private static Task WriteProblemAsync(
        HttpContext ctx, int status, string title, string detail, CancellationToken ct)
    {
        var problem = new ProblemDetails
        {
            Status = status,
            Title = title,
            Detail = detail,
            Instance = ctx.Request.Path
        };
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(problem, ct);
    }
}
