using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
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

    // Snapshot drift'i (eski model snapshot vs güncel ModelBuilder çıktısı) artık
    // Migrate() sırasında crash sebebi (.NET 9+ default). DB şeması manuel DDL
    // (AddCustomersAndOutbox + idempotent ALTER) ile zaten doğru — bu uyarıyı
    // production'da log + devam, dev'de yine fail-fast bırakıyoruz.
    if (!builder.Environment.IsDevelopment())
        opt.ConfigureWarnings(w =>
            w.Ignore(RelationalEventId.PendingModelChangesWarning));
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
builder.Services.AddScoped<ISupervisorAnalyticsService, SupervisorAnalyticsService>();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
        options.SaveToken = false;
        // Token mint sırasında zaten kısa claim adlari ("role","name","sub")
        // kullanildigi icin inbound mapping'i kapatiyoruz. Aksi halde token'daki
        // "role" short claim'i ClaimTypes.Role'a (uzun URL) otomatik
        // mapleniyor; ama RoleClaimType="role" identity'de short formu
        // ariyor ve IsInRole("Manager") match edemeyip [Authorize(Roles=
        // "Manager")] 403 firlatti.
        options.MapInboundClaims = false;
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
builder.Services.AddScoped<IComboService, ComboService>();
builder.Services.AddScoped<IIncomingCallService, IncomingCallService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<IOutboxEmitter, OutboxEmitter>();
builder.Services.AddScoped<IIngestApplyService, IngestApplyService>();

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
    // EF navigation back-reference'lari (ornegin ComboItem.Combo, ki Include
    // sonrasi EF tracker tarafindan doluyor) JSON serialize sirasinda
    // sonsuz dongu yaratip 500 atiyordu. IgnoreCycles cycle'i goren yerde
    // null yazar — kasa pull veya admin GET endpoint'leri bundan etkilenmez.
    opt.JsonSerializerOptions.ReferenceHandler =
        System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
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
        // Origin allow-list:
        //  - localhost / 127.0.0.1 (her port) HER ZAMAN allow — kasa Electron'da
        //    iki child process iki free port'ta calisir, sabit liste tutulamaz.
        //  - Diger origin'ler Cors:AllowedOrigins config'inden cikarilan listeye
        //    karsi check edilir (cloud Vercel: https://nodapos.com).
        //  - Allow-list bos ve Development ise: tum origin'ler kabul (eski davranis).
        policy.SetIsOriginAllowed(origin =>
        {
            if (string.IsNullOrEmpty(origin)) return false;
            if (Uri.TryCreate(origin, UriKind.Absolute, out var uri))
            {
                if (uri.Host == "localhost" || uri.Host == "127.0.0.1")
                    return true;
            }
            if (allowedOrigins.Length == 0)
                return builder.Environment.IsDevelopment();
            return allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase);
        });

        policy
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

// --- Schema bootstrap -------------------------------------------------------
// SQLite (kasa) has no migration package — generate the schema from the model
// on first launch. Postgres (cloud) applies the migration history idempotently
// so a clean Hetzner DB gets every table on first boot, and subsequent schema
// changes flow through the migration pipeline without manual `ef database update`.
{
    using var schemaScope = app.Services.CreateScope();
    var schemaDb = schemaScope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (string.Equals(dbProvider, "Sqlite", StringComparison.OrdinalIgnoreCase))
    {
        // Sira KRITIK: EnsureCreated once. EF "model tablosundan biri var" diye
        // semayi atlar; eger combo_items'i once kendimiz yaratsak tum diger
        // tablolar (stores/users/supervisors/...) yaratilmaz, ilk supervisor
        // seed sorgusunda "no such table: supervisors" ile API coker.
        await schemaDb.Database.EnsureCreatedAsync();

        // Combo schema breaking change (slot→product, v0.1.7): pre-v0.1.7
        // kurulumda combo_items eski slot-based (Label/CategoryId) kolonlarla
        // durur, EnsureCreated zaten var sandigi icin guncellemez. DROP+CREATE
        // gerekli. v0.1.7 sonrasi schema dogru (ProductId kolonu var) — DROP
        // yapsak kullanicinin lokal olusturdugu combo_items kayitlari her
        // restartta SILINIR. Bu yuzden SADECE eski sema tespit edildiginde
        // recreate yap; modern sema varsa veya tablo henuz yoksa skip.
        var hasProductIdColumn = false;
        try
        {
            var conn = schemaDb.Database.GetDbConnection();
            if (conn.State != System.Data.ConnectionState.Open)
                await conn.OpenAsync();
            using var cmd = conn.CreateCommand();
            cmd.CommandText =
                "SELECT COUNT(*) FROM pragma_table_info('combo_items') WHERE name = 'ProductId';";
            var result = await cmd.ExecuteScalarAsync();
            hasProductIdColumn = Convert.ToInt32(result) > 0;
        }
        catch
        {
            // tablo yok veya pragma çalışmadı — recreate güvenli yol.
        }

        if (!hasProductIdColumn)
        {
            await schemaDb.Database.ExecuteSqlRawAsync("""
                DROP TABLE IF EXISTS combo_items;
                CREATE TABLE combo_items (
                    Id TEXT NOT NULL PRIMARY KEY,
                    StoreId TEXT NOT NULL,
                    ComboId TEXT NOT NULL,
                    ProductId TEXT NOT NULL,
                    Quantity INTEGER NOT NULL,
                    DisplayOrder INTEGER NOT NULL,
                    CreatedAt TEXT NOT NULL,
                    UpdatedAt TEXT NULL,
                    FOREIGN KEY (StoreId) REFERENCES stores(Id) ON DELETE RESTRICT,
                    FOREIGN KEY (ComboId) REFERENCES combos(Id) ON DELETE CASCADE,
                    FOREIGN KEY (ProductId) REFERENCES products(Id) ON DELETE RESTRICT
                );
                CREATE INDEX IF NOT EXISTS IX_combo_items_StoreId_ComboId
                    ON combo_items (StoreId, ComboId);
                CREATE INDEX IF NOT EXISTS IX_combo_items_StoreId_ProductId
                    ON combo_items (StoreId, ProductId);
                """);
        }

        // Idempotent ADD COLUMN — EnsureCreated mevcut tablolara yeni kolon
        // EKLEMEZ. Upgrade akışında bu satırlar olmadan v0.1.9'a güncellenen
        // kasalar yeni alanları görmez. Duplicate column hatası bekliyoruz
        // (zaten varsa); onu yutuyoruz.
        async Task TryAddColumn(string sql)
        {
            try { await schemaDb.Database.ExecuteSqlRawAsync(sql); }
            catch (Microsoft.Data.Sqlite.SqliteException ex)
                when (ex.Message.Contains("duplicate column", StringComparison.OrdinalIgnoreCase))
            {
                // already added
            }
        }
        await TryAddColumn("ALTER TABLE products ADD COLUMN DeliveryPrice TEXT NULL;");
        await TryAddColumn("ALTER TABLE combos ADD COLUMN DeliveryPrice TEXT NULL;");
    }
    else
    {
        await schemaDb.Database.MigrateAsync();
    }
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
