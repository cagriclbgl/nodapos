using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace PizzaPos.Api.Data;

/// <summary>
/// Used by `dotnet ef migrations add` / `database update`. Honors the
/// Database:Provider config flag (Postgres | Sqlite) so a single source of
/// truth governs both the runtime and the EF tooling. Defaults to Postgres
/// to keep existing flows untouched.
/// </summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        // Default to Development so the gitignored appsettings.Development.json
        // (which holds the real Supabase password) is preferred over the public
        // appsettings.json placeholder.
        var environment =
            Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";

        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile($"appsettings.{environment}.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var provider = configuration.GetValue<string>("Database:Provider") ?? "Postgres";
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();

        if (string.Equals(provider, "Sqlite", StringComparison.OrdinalIgnoreCase))
        {
            var sqlitePath =
                configuration.GetValue<string>("Database:SqlitePath")
                ?? Environment.GetEnvironmentVariable("PIZZAPOS_SQLITE_PATH")
                ?? "pos.db";
            optionsBuilder.UseSqlite($"Data Source={sqlitePath}");
        }
        else
        {
            var connectionString =
                configuration.GetConnectionString("Default")
                ?? Environment.GetEnvironmentVariable("DATABASE_URL")
                ?? Environment.GetEnvironmentVariable("PIZZAPOS_DESIGN_CONNECTION")
                ?? throw new InvalidOperationException(
                    "Design-time connection string not found. Populate ConnectionStrings:Default in " +
                    "appsettings.Development.json, or set DATABASE_URL.");
            optionsBuilder.UseNpgsql(connectionString);
        }

        return new AppDbContext(optionsBuilder.Options, new NoOpTenantProvider());
    }

    private sealed class NoOpTenantProvider : ITenantProvider
    {
        public Guid CurrentStoreId => Guid.Empty;
        public bool HasTenant => false;
    }
}
