using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using PizzaPos.Api.Auth;
using PizzaPos.Api.Data;
using PizzaPos.Api.Services;
using PizzaPos.Api.Sync;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// --- Database ---------------------------------------------------------------
// Provider switch: "Sqlite" (offline kasa) vs "Postgres" (cloud / dev). Default Postgres.
var dbProvider = builder.Configuration.GetValue<string>("Database:Provider") ?? "Postgres";

builder.Services.AddDbContext<AppDbContext>(opt =>
{
    if (string.Equals(dbProvider, "Sqlite", StringComparison.OrdinalIgnoreCase))
    {
        var sqlitePath =
            builder.Configuration.GetValue<string>("Database:SqlitePath")
            ?? Environment.GetEnvironmentVariable("PIZZAPOS_SQLITE_PATH")
            ?? "pos.db";
        opt.UseSqlite($"Data Source={sqlitePath}",
            x => x.MigrationsAssembly("PizzaPos.Api"));
    }
    else
    {
        var connectionString =
            builder.Configuration.GetConnectionString("Default")
            ?? Environment.GetEnvironmentVariable("DATABASE_URL")
            ?? throw new InvalidOperationException(
                "Database connection string not configured. Set ConnectionStrings:Default or DATABASE_URL.");
        opt.UseNpgsql(connectionString);
    }
});

// --- Tenancy ----------------------------------------------------------------
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ITenantProvider, SessionTenantProvider>();
builder.Services.AddScoped<ICurrentUserAccessor, HttpContextCurrentUserAccessor>();

// --- Auth -------------------------------------------------------------------
var jwtSection = builder.Configuration.GetSection("Auth:Jwt");
builder.Services.Configure<JwtOptions>(jwtSection);

var jwtOptions = jwtSection.Get<JwtOptions>() ?? new JwtOptions();
var jwtSecret = jwtOptions.Secret;
if (string.IsNullOrWhiteSpace(jwtSecret) || jwtSecret.Length < 32)
{
    if (builder.Environment.IsDevelopment())
    {
        jwtSecret = JwtOptions.DevSecretFallback;
        // Mutate the bound options so JwtTokenService picks up the fallback secret.
        builder.Services.PostConfigure<JwtOptions>(o => o.Secret = jwtSecret);
    }
    else
    {
        throw new InvalidOperationException(
            "Auth:Jwt:Secret must be configured (>= 32 chars) outside Development.");
    }
}

builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IPasswordHasher, BCryptPasswordHasher>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<ISupervisorAuthService, SupervisorAuthService>();
builder.Services.AddScoped<IStoreRegistrationService, StoreRegistrationService>();
builder.Services.AddScoped<ISupervisorAdminService, SupervisorAdminService>();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
        options.SaveToken = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtOptions.Audience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret!)),
            ClockSkew = TimeSpan.FromSeconds(30),
            // Map our short claim names ("role", "name", "store_id") through unchanged
            // so [Authorize(Roles="Manager")] resolves against the token's `role` claim.
            RoleClaimType = "role",
            NameClaimType = "name",
        };

        // Read the bearer token from the auth cookie instead of the Authorization header.
        // /api/supervisor/* uses the supervisor cookie; everything else uses the store cookie.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var path = ctx.Request.Path.Value ?? string.Empty;
                var cookieName = path.StartsWith("/api/supervisor", StringComparison.OrdinalIgnoreCase)
                    ? JwtOptions.SupervisorCookieName
                    : JwtOptions.CookieName;
                if (ctx.Request.Cookies.TryGetValue(cookieName, out var token)
                    && !string.IsNullOrEmpty(token))
                {
                    ctx.Token = token;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    // The Supervisor role lives in a separate cookie/identity from regular
    // users. The role claim alone is brittle under default JWT mapping, so we
    // additionally require the `sub_type=supervisor` claim we mint at login.
    options.AddPolicy(JwtOptions.SupervisorRole, policy =>
        policy
            .RequireAuthenticatedUser()
            .RequireClaim(JwtOptions.SubjectTypeClaim, JwtOptions.SubjectTypeSupervisor));
});

// --- Domain services --------------------------------------------------------
builder.Services.AddScoped<IStoreService, StoreService>();
builder.Services.AddScoped<ITableService, TableService>();
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<IProductService, ProductService>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<ICustomerService, CustomerService>();
builder.Services.AddScoped<IOutboxEmitter, OutboxEmitter>();

// --- Sync (offline-first kasa → cloud mirror) -------------------------------
builder.Services.AddHttpClient();
builder.Services.Configure<SyncOptions>(builder.Configuration.GetSection("Sync"));
if (builder.Configuration.GetValue<bool>("Sync:Enabled"))
{
    // Push: outbox drain (kasa → cloud). Runs on both SQLite and Postgres
    // because in cloud Postgres mode the outbox table sits empty — harmless.
    builder.Services.AddHostedService<SyncWorker>();

    // Pull: cloud changes → kasa. Only meaningful on SQLite (kasa). On the
    // cloud Postgres deployment the worker would polled itself — disabled.
    if (string.Equals(dbProvider, "Sqlite", StringComparison.OrdinalIgnoreCase))
    {
        builder.Services.AddHostedService<SyncPullWorker>();
    }
}

// --- Cross-cutting ----------------------------------------------------------
builder.Services.AddExceptionHandler<DomainExceptionHandler>();
builder.Services.AddProblemDetails();

builder.Services.AddControllers().AddJsonOptions(opt =>
{
    opt.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    opt.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "PizzaPos API", Version = "v1" });
    c.AddSecurityDefinition("StoreId", new OpenApiSecurityScheme
    {
        In = ParameterLocation.Header,
        Name = SessionTenantProvider.HeaderName,
        Type = SecuritySchemeType.ApiKey,
        Description = "Tenant identifier (Store.Id) — only required for the anonymous bootstrap/login flow."
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "StoreId"
                }
            },
            Array.Empty<string>()
        }
    });
});

// --- CORS (Vercel frontend) -------------------------------------------------
var allowedOrigins =
    (builder.Configuration["Cors:AllowedOrigins"] ?? string.Empty)
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (allowedOrigins.Length == 0)
        {
            // In Development, reflect any localhost-ish origin so cookies still work
            // (AllowAnyOrigin is incompatible with AllowCredentials per spec).
            policy.SetIsOriginAllowed(_ => builder.Environment.IsDevelopment());
        }
        else
        {
            policy.WithOrigins(allowedOrigins);
        }

        policy
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

// --- SQLite schema bootstrap ------------------------------------------------
// Offline kasa (SQLite) için migration paketi henüz yok; ilk açılışta model'den
// schema üret. Postgres tarafında migration'lar Supabase'e elle uygulanıyor.
if (string.Equals(dbProvider, "Sqlite", StringComparison.OrdinalIgnoreCase))
{
    using var schemaScope = app.Services.CreateScope();
    var schemaDb = schemaScope.ServiceProvider.GetRequiredService<AppDbContext>();
    await schemaDb.Database.EnsureCreatedAsync();
}

// --- Bootstrap Supervisor ---------------------------------------------------
// On first run, seed a platform Supervisor from Supervisor:* config so the
// /supervisor/login page has a usable account. Skipped if any Supervisor exists.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (await db.Database.CanConnectAsync())
    {
        var hasAny = await db.Supervisors.AnyAsync();
        if (!hasAny)
        {
            var cfg = scope.ServiceProvider.GetRequiredService<IConfiguration>();
            var u = cfg["Supervisor:BootstrapUsername"];
            var p = cfg["Supervisor:BootstrapPassword"];
            var n = cfg["Supervisor:BootstrapFullName"] ?? "Platform Supervisor";
            if (!string.IsNullOrWhiteSpace(u) && !string.IsNullOrWhiteSpace(p))
            {
                var hasher = scope.ServiceProvider.GetRequiredService<PizzaPos.Api.Services.IPasswordHasher>();
                db.Supervisors.Add(new PizzaPos.Api.Entities.Supervisor
                {
                    Username = u.Trim(),
                    FullName = n.Trim(),
                    PasswordHash = hasher.Hash(p),
                    IsActive = true,
                });
                await db.SaveChangesAsync();
                app.Logger.LogInformation("Bootstrapped Supervisor user '{Username}'.", u);
            }
        }
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseExceptionHandler();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
