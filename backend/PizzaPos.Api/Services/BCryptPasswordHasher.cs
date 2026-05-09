namespace PizzaPos.Api.Services;

public class BCryptPasswordHasher : IPasswordHasher
{
    private const int WorkFactor = 11;

    public string Hash(string plainText)
    {
        if (string.IsNullOrEmpty(plainText))
            throw new ArgumentException("Password cannot be empty.", nameof(plainText));
        return BCrypt.Net.BCrypt.HashPassword(plainText, WorkFactor);
    }

    public bool Verify(string plainText, string hash)
    {
        if (string.IsNullOrEmpty(plainText) || string.IsNullOrEmpty(hash))
            return false;
        try
        {
            return BCrypt.Net.BCrypt.Verify(plainText, hash);
        }
        catch
        {
            // Malformed hash — treat as failed verification rather than crashing.
            return false;
        }
    }
}
