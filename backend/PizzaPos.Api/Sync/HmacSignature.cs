using System.Security.Cryptography;
using System.Text;

namespace PizzaPos.Api.Sync;

public static class HmacSignature
{
    public const string HeaderName = "X-Sync-Signature";

    public static string Compute(string secret, byte[] body)
    {
        using var h = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = h.ComputeHash(body);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    public static bool Verify(string secret, byte[] body, string? providedHex)
    {
        if (string.IsNullOrEmpty(providedHex)) return false;
        var expected = Compute(secret, body);
        var a = Encoding.UTF8.GetBytes(expected);
        var b = Encoding.UTF8.GetBytes(providedHex.Trim().ToLowerInvariant());
        return a.Length == b.Length && CryptographicOperations.FixedTimeEquals(a, b);
    }
}
