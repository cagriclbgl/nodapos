using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using PizzaPos.Api.Data;

namespace PizzaPos.Api.Controllers;

/// <summary>
/// Applied to any controller whose endpoints are tenant-scoped. Returns 400 when
/// the X-Store-Id header is missing/invalid so callers see a clear error rather
/// than mysteriously empty result sets (the Global Query Filter would otherwise
/// swallow them).
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, Inherited = true)]
public sealed class RequireTenantAttribute : Attribute, IActionFilter
{
    public void OnActionExecuting(ActionExecutingContext context)
    {
        var tenant = context.HttpContext.RequestServices.GetRequiredService<ITenantProvider>();
        if (!tenant.HasTenant)
        {
            context.Result = new BadRequestObjectResult(new
            {
                error = $"Missing tenant. Authenticate (cookie) or provide '{SessionTenantProvider.HeaderName}' header."
            });
        }
    }

    public void OnActionExecuted(ActionExecutedContext context) { }
}

[RequireTenant]
public abstract class TenantControllerBase : ControllerBase
{
}
