namespace PizzaPos.Api.Services;

/// <summary>
/// Thrown by services when a business rule is violated. Controllers translate
/// these into 400/404/409 responses; the global exception handler logs them.
/// </summary>
public class DomainException : Exception
{
    public int StatusCode { get; }

    public DomainException(string message, int statusCode = 400) : base(message)
    {
        StatusCode = statusCode;
    }

    public static DomainException NotFound(string what) => new($"{what} not found.", 404);
    public static DomainException Conflict(string message) => new(message, 409);
}
