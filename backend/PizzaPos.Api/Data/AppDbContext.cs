using Microsoft.EntityFrameworkCore;
using PizzaPos.Api.Entities;
using System.Linq.Expressions;

namespace PizzaPos.Api.Data;

public class AppDbContext : DbContext
{
    private readonly ITenantProvider _tenantProvider;

    public AppDbContext(DbContextOptions<AppDbContext> options, ITenantProvider tenantProvider)
        : base(options)
    {
        _tenantProvider = tenantProvider;
    }

    public DbSet<Store> Stores => Set<Store>();
    public DbSet<Table> Tables => Set<Table>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductOption> ProductOptions => Set<ProductOption>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderItemOption> OrderItemOptions => Set<OrderItemOption>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<CustomerAddress> CustomerAddresses => Set<CustomerAddress>();
    public DbSet<OutboxEvent> OutboxEvents => Set<OutboxEvent>();
    public DbSet<Supervisor> Supervisors => Set<Supervisor>();
    public DbSet<StoreRegistrationRequest> StoreRegistrationRequests => Set<StoreRegistrationRequest>();
    public DbSet<SyncState> SyncStates => Set<SyncState>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        ConfigureStore(modelBuilder);
        ConfigureTable(modelBuilder);
        ConfigureCategory(modelBuilder);
        ConfigureProduct(modelBuilder);
        ConfigureProductOption(modelBuilder);
        ConfigureOrder(modelBuilder);
        ConfigureOrderItem(modelBuilder);
        ConfigureOrderItemOption(modelBuilder);
        ConfigurePayment(modelBuilder);
        ConfigureUser(modelBuilder);
        ConfigureCustomer(modelBuilder);
        ConfigureCustomerAddress(modelBuilder);
        ConfigureOutboxEvent(modelBuilder);
        ConfigureSupervisor(modelBuilder);
        ConfigureStoreRegistrationRequest(modelBuilder);
        ConfigureSyncState(modelBuilder);

        ApplyTenantQueryFilters(modelBuilder);
    }

    private static void ConfigureOutboxEvent(ModelBuilder mb)
    {
        mb.Entity<OutboxEvent>(b =>
        {
            b.ToTable("outbox_events");
            b.HasKey(x => x.Id);
            b.Property(x => x.AggregateType).IsRequired().HasMaxLength(50);
            b.Property(x => x.EventType).IsRequired().HasMaxLength(60);
            b.Property(x => x.PayloadJson).IsRequired();
            b.Property(x => x.LastError).HasMaxLength(500);

            // SyncWorker queue scan: unsent rows ordered by CreatedAt.
            b.HasIndex(x => new { x.SentAt, x.CreatedAt });
        });
    }

    private static void ConfigureSyncState(ModelBuilder mb)
    {
        mb.Entity<SyncState>(b =>
        {
            b.ToTable("sync_states");
            b.HasKey(x => x.Id);
            b.Property(x => x.AggregateType).IsRequired().HasMaxLength(50);
            // One row per aggregate type — kasa upserts on this key.
            b.HasIndex(x => x.AggregateType).IsUnique();
        });
    }

    private static void ConfigureStore(ModelBuilder mb)
    {
        mb.Entity<Store>(b =>
        {
            b.ToTable("stores");
            b.HasKey(x => x.Id);
            b.Property(x => x.Name).IsRequired().HasMaxLength(200);
            b.Property(x => x.Address).HasMaxLength(500);
            b.Property(x => x.Phone).HasMaxLength(50);
            b.Property(x => x.TaxNumber).HasMaxLength(50);
            b.HasIndex(x => x.IsActive);
        });
    }

    private static void ConfigureTable(ModelBuilder mb)
    {
        mb.Entity<Table>(b =>
        {
            b.ToTable("tables");
            b.HasKey(x => x.Id);
            b.Property(x => x.Name).IsRequired().HasMaxLength(100);
            b.Property(x => x.Status).HasConversion<int>();

            b.HasOne(x => x.Store)
                .WithMany(s => s.Tables)
                .HasForeignKey(x => x.StoreId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.StoreId, x.Status });
            b.HasIndex(x => new { x.StoreId, x.Name }).IsUnique();
        });
    }

    private static void ConfigureCategory(ModelBuilder mb)
    {
        mb.Entity<Category>(b =>
        {
            b.ToTable("categories");
            b.HasKey(x => x.Id);
            b.Property(x => x.Name).IsRequired().HasMaxLength(150);
            b.Property(x => x.Description).HasMaxLength(500);

            b.HasOne<Store>()
                .WithMany(s => s.Categories)
                .HasForeignKey(x => x.StoreId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.StoreId, x.DisplayOrder });
        });
    }

    private static void ConfigureProduct(ModelBuilder mb)
    {
        mb.Entity<Product>(b =>
        {
            b.ToTable("products");
            b.HasKey(x => x.Id);
            b.Property(x => x.Name).IsRequired().HasMaxLength(200);
            b.Property(x => x.Description).HasMaxLength(1000);
            b.Property(x => x.Price).HasColumnType("numeric(18,2)");
            b.Property(x => x.ImageUrl).HasMaxLength(1000);

            b.HasOne(x => x.Category)
                .WithMany(c => c.Products)
                .HasForeignKey(x => x.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne<Store>()
                .WithMany(s => s.Products)
                .HasForeignKey(x => x.StoreId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.StoreId, x.CategoryId });
            b.HasIndex(x => new { x.StoreId, x.IsAvailable });
        });
    }

    private static void ConfigureProductOption(ModelBuilder mb)
    {
        mb.Entity<ProductOption>(b =>
        {
            b.ToTable("product_options");
            b.HasKey(x => x.Id);
            b.Property(x => x.GroupName).IsRequired().HasMaxLength(100);
            b.Property(x => x.Name).IsRequired().HasMaxLength(150);
            b.Property(x => x.AdditionalPrice).HasColumnType("numeric(18,2)");

            b.HasOne(x => x.Product)
                .WithMany(p => p.Options)
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(x => new { x.StoreId, x.ProductId, x.GroupName });
        });
    }

    private static void ConfigureOrder(ModelBuilder mb)
    {
        mb.Entity<Order>(b =>
        {
            b.ToTable("orders");
            b.HasKey(x => x.Id);
            b.Property(x => x.OrderNumber).IsRequired().HasMaxLength(50);
            b.Property(x => x.Status).HasConversion<int>();
            b.Property(x => x.OrderType).HasConversion<int>();
            b.Property(x => x.Subtotal).HasColumnType("numeric(18,2)");
            b.Property(x => x.DiscountAmount).HasColumnType("numeric(18,2)");
            b.Property(x => x.Total).HasColumnType("numeric(18,2)");
            b.Property(x => x.CustomerName).HasMaxLength(200);
            b.Property(x => x.CustomerPhone).HasMaxLength(50);
            b.Property(x => x.Notes).HasMaxLength(1000);

            b.HasOne(x => x.Table)
                .WithMany(t => t.Orders)
                .HasForeignKey(x => x.TableId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasOne<Store>()
                .WithMany(s => s.Orders)
                .HasForeignKey(x => x.StoreId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.StoreId, x.Status });
            b.HasIndex(x => new { x.StoreId, x.CreatedAt });
            b.HasIndex(x => new { x.StoreId, x.OrderNumber }).IsUnique();
            // Used by /api/customers/{id}/orders to fetch a customer's order history.
            b.HasIndex(x => new { x.StoreId, x.CustomerId });
        });
    }

    private static void ConfigureOrderItem(ModelBuilder mb)
    {
        mb.Entity<OrderItem>(b =>
        {
            b.ToTable("order_items");
            b.HasKey(x => x.Id);

            // Snapshot fields — preserved even if the source Product is renamed/repriced.
            b.Property(x => x.ProductName).IsRequired().HasMaxLength(200);
            b.Property(x => x.UnitPrice).HasColumnType("numeric(18,2)");
            b.Property(x => x.LineTotal).HasColumnType("numeric(18,2)");
            b.Property(x => x.Notes).HasMaxLength(500);

            b.HasOne(x => x.Order)
                .WithMany(o => o.Items)
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(x => x.Product)
                .WithMany(p => p.OrderItems)
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.StoreId, x.OrderId });
        });
    }

    private static void ConfigureOrderItemOption(ModelBuilder mb)
    {
        mb.Entity<OrderItemOption>(b =>
        {
            b.ToTable("order_item_options");
            b.HasKey(x => x.Id);

            // Snapshot fields — preserved even if the source ProductOption is removed.
            b.Property(x => x.GroupName).IsRequired().HasMaxLength(100);
            b.Property(x => x.OptionName).IsRequired().HasMaxLength(150);
            b.Property(x => x.AdditionalPrice).HasColumnType("numeric(18,2)");

            b.HasOne(x => x.OrderItem)
                .WithMany(i => i.Options)
                .HasForeignKey(x => x.OrderItemId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(x => x.ProductOption)
                .WithMany()
                .HasForeignKey(x => x.ProductOptionId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(x => new { x.StoreId, x.OrderItemId });
        });
    }

    private static void ConfigurePayment(ModelBuilder mb)
    {
        mb.Entity<Payment>(b =>
        {
            b.ToTable("payments");
            b.HasKey(x => x.Id);
            b.Property(x => x.Amount).HasColumnType("numeric(18,2)");
            b.Property(x => x.Method).HasConversion<int>();
            b.Property(x => x.ReferenceNumber).HasMaxLength(100);
            b.Property(x => x.Notes).HasMaxLength(500);
            // CreatedByUserId is intentionally not modelled as a navigation/FK so
            // an audit trail stays on the row even if the User record is removed.

            b.HasOne(x => x.Order)
                .WithMany(o => o.Payments)
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.StoreId, x.OrderId });
            b.HasIndex(x => new { x.StoreId, x.PaidAt });
        });
    }

    private static void ConfigureUser(ModelBuilder mb)
    {
        mb.Entity<User>(b =>
        {
            b.ToTable("users");
            b.HasKey(x => x.Id);
            b.Property(x => x.Username).IsRequired().HasMaxLength(100);
            b.Property(x => x.PasswordHash).IsRequired().HasMaxLength(200);
            b.Property(x => x.FullName).IsRequired().HasMaxLength(200);
            b.Property(x => x.Role).HasConversion<int>();

            b.HasOne<Store>()
                .WithMany()
                .HasForeignKey(x => x.StoreId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.StoreId, x.Username }).IsUnique();
            b.HasIndex(x => new { x.StoreId, x.IsActive });
        });
    }

    private static void ConfigureCustomer(ModelBuilder mb)
    {
        mb.Entity<Customer>(b =>
        {
            b.ToTable("customers");
            b.HasKey(x => x.Id);
            b.Property(x => x.Name).IsRequired().HasMaxLength(200);
            b.Property(x => x.Phone).IsRequired().HasMaxLength(50);
            b.Property(x => x.Notes).HasMaxLength(1000);

            b.HasOne<Store>()
                .WithMany()
                .HasForeignKey(x => x.StoreId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.StoreId, x.Phone }).IsUnique();
            b.HasIndex(x => new { x.StoreId, x.IsActive });
            b.HasIndex(x => new { x.StoreId, x.Name });
        });
    }

    private static void ConfigureCustomerAddress(ModelBuilder mb)
    {
        mb.Entity<CustomerAddress>(b =>
        {
            b.ToTable("customer_addresses");
            b.HasKey(x => x.Id);
            b.Property(x => x.Label).IsRequired().HasMaxLength(50);
            b.Property(x => x.AddressLine).IsRequired().HasMaxLength(500);
            b.Property(x => x.District).HasMaxLength(100);
            b.Property(x => x.Notes).HasMaxLength(500);

            b.HasOne(x => x.Customer)
                .WithMany(c => c.Addresses)
                .HasForeignKey(x => x.CustomerId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne<Store>()
                .WithMany()
                .HasForeignKey(x => x.StoreId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(x => new { x.StoreId, x.CustomerId });
        });
    }

    private static void ConfigureSupervisor(ModelBuilder mb)
    {
        mb.Entity<Supervisor>(b =>
        {
            b.ToTable("supervisors");
            b.HasKey(x => x.Id);
            b.Property(x => x.Username).IsRequired().HasMaxLength(100);
            b.Property(x => x.PasswordHash).IsRequired().HasMaxLength(200);
            b.Property(x => x.FullName).IsRequired().HasMaxLength(200);
            b.HasIndex(x => x.Username).IsUnique();
        });
    }

    private static void ConfigureStoreRegistrationRequest(ModelBuilder mb)
    {
        mb.Entity<StoreRegistrationRequest>(b =>
        {
            b.ToTable("store_registration_requests");
            b.HasKey(x => x.Id);
            b.Property(x => x.StoreName).IsRequired().HasMaxLength(200);
            b.Property(x => x.ContactName).IsRequired().HasMaxLength(200);
            b.Property(x => x.Phone).IsRequired().HasMaxLength(50);
            b.Property(x => x.Email).HasMaxLength(200);
            b.Property(x => x.Address).HasMaxLength(500);
            b.Property(x => x.Notes).HasMaxLength(1000);
            b.Property(x => x.RejectionReason).HasMaxLength(500);
            b.Property(x => x.Status).HasConversion<int>();
            b.HasIndex(x => new { x.Status, x.CreatedAt });
        });
    }

    /// <summary>
    /// Applies a Global Query Filter on every TenantEntity-derived type so that
    /// queries are automatically scoped to the current tenant. Use IgnoreQueryFilters()
    /// only for cross-tenant admin operations (and document the reason).
    /// </summary>
    private void ApplyTenantQueryFilters(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            var clrType = entityType.ClrType;
            if (!typeof(TenantEntity).IsAssignableFrom(clrType)) continue;

            var parameter = Expression.Parameter(clrType, "e");
            var storeIdProperty = Expression.Property(parameter, nameof(TenantEntity.StoreId));
            var currentStoreId = Expression.Property(
                Expression.Constant(this),
                nameof(CurrentStoreIdInternal));
            var equality = Expression.Equal(storeIdProperty, currentStoreId);
            var lambda = Expression.Lambda(equality, parameter);

            modelBuilder.Entity(clrType).HasQueryFilter(lambda);
        }
    }

    // Exposed for the query filter expression (cannot reference _tenantProvider directly
    // because the expression is captured at model-build time).
    private Guid CurrentStoreIdInternal => _tenantProvider.CurrentStoreId;

    public override int SaveChanges()
    {
        ApplyAuditAndTenantStamps();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyAuditAndTenantStamps();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void ApplyAuditAndTenantStamps()
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Entity.Id == Guid.Empty)
                    entry.Entity.Id = Guid.NewGuid();
                entry.Entity.CreatedAt = now;

                // Auto-stamp StoreId on tenant entities when not set explicitly.
                if (entry.Entity is TenantEntity tenant
                    && tenant.StoreId == Guid.Empty
                    && _tenantProvider.HasTenant)
                {
                    tenant.StoreId = _tenantProvider.CurrentStoreId;
                }
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
                entry.Property(nameof(BaseEntity.CreatedAt)).IsModified = false;
            }
        }
    }
}
