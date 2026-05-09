namespace PizzaPos.Api.Sync;

public class SyncOptions
{
    public bool Enabled { get; set; }
    public string CloudBaseUrl { get; set; } = string.Empty;
    public string HmacSecret { get; set; } = string.Empty;
    /// <summary>Push interval (kasa → cloud outbox drain).</summary>
    public int PollingSeconds { get; set; } = 10;
    /// <summary>Pull interval (cloud → kasa manager-domain refresh).</summary>
    public int PullPollingSeconds { get; set; } = 30;
    public int BatchSize { get; set; } = 50;
}
