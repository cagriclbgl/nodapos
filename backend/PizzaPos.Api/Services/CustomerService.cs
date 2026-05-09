using Microsoft.EntityFrameworkCore;
using PizzaPos.Api.Data;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Services;

public class CustomerService : ICustomerService
{
    private const int SearchResultLimit = 100;
    private const int OrderHistoryLimit = 50;

    private readonly AppDbContext _db;
    private readonly ITenantProvider _tenant;
    private readonly IOutboxEmitter _outbox;

    public CustomerService(AppDbContext db, ITenantProvider tenant, IOutboxEmitter outbox)
    {
        _db = db;
        _tenant = tenant;
        _outbox = outbox;
    }

    public async Task<IReadOnlyList<CustomerListItemDto>> SearchAsync(string? search, CancellationToken ct = default)
    {
        var query = _db.Customers.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            // EF.Functions.ILike → Postgres ILIKE (case-insensitive partial match).
            var pattern = $"%{term}%";
            query = query.Where(c =>
                EF.Functions.ILike(c.Name, pattern) ||
                EF.Functions.ILike(c.Phone, pattern));
        }

        // Project + correlated subqueries so OrderCount/LastOrderAt are computed
        // entirely server-side. Match by either CustomerId (preferred) OR legacy
        // CustomerPhone fallback so customers created before Faz B still resolve.
        var rows = await query
            .OrderBy(c => c.Name)
            .Take(SearchResultLimit)
            .Select(c => new CustomerListItemDto(
                c.Id,
                c.Name,
                c.Phone,
                c.IsActive,
                _db.Orders.Count(o => o.CustomerId == c.Id || o.CustomerPhone == c.Phone),
                _db.Orders
                    .Where(o => o.CustomerId == c.Id || o.CustomerPhone == c.Phone)
                    .Max(o => (DateTime?)o.CreatedAt)))
            .ToListAsync(ct);

        return rows;
    }

    public async Task<CustomerDto?> GetAsync(Guid id, CancellationToken ct = default)
    {
        var customer = await _db.Customers
            .Include(c => c.Addresses)
            .FirstOrDefaultAsync(c => c.Id == id, ct);
        return customer is null ? null : Map(customer);
    }

    public async Task<CustomerDto> CreateAsync(CreateCustomerRequest request, CancellationToken ct = default)
    {
        var name = NormalizeRequired(request.Name, "Name");
        var phone = NormalizeRequired(request.Phone, "Phone");
        var notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();

        if (!_tenant.HasTenant)
            throw new DomainException("No active store context.");

        var dup = await _db.Customers.AnyAsync(c => c.Phone == phone, ct);
        if (dup)
            throw DomainException.Conflict($"A customer with phone '{phone}' already exists.");

        var customer = new Customer
        {
            Name = name,
            Phone = phone,
            Notes = notes,
            IsActive = true,
        };
        _db.Customers.Add(customer);
        await _db.SaveChangesAsync(ct);

        await _outbox.EmitAsync("Customer", customer.Id, "CustomerCreated",
            new
            {
                customer.Id,
                customer.StoreId,
                customer.Name,
                customer.Phone,
                customer.Notes,
                customer.IsActive,
                customer.CreatedAt,
                customer.UpdatedAt
            }, ct);
        await _db.SaveChangesAsync(ct);

        return (await GetAsync(customer.Id, ct))!;
    }

    public async Task<CustomerDto> UpdateAsync(Guid id, UpdateCustomerRequest request, CancellationToken ct = default)
    {
        var customer = await _db.Customers
            .Include(c => c.Addresses)
            .FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw DomainException.NotFound("Customer");

        if (request.Name is not null)
            customer.Name = NormalizeRequired(request.Name, "Name");

        if (request.Phone is not null)
        {
            var newPhone = NormalizeRequired(request.Phone, "Phone");
            if (newPhone != customer.Phone)
            {
                var dup = await _db.Customers.AnyAsync(c => c.Id != customer.Id && c.Phone == newPhone, ct);
                if (dup)
                    throw DomainException.Conflict($"A customer with phone '{newPhone}' already exists.");
                customer.Phone = newPhone;
            }
        }

        if (request.Notes is not null)
            customer.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();

        if (request.IsActive.HasValue)
            customer.IsActive = request.IsActive.Value;

        // Stamp UpdatedAt so SyncPullWorker can do last-writer-wins comparison
        // against the cloud copy. EF tracker won't bump it on its own.
        customer.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        await _outbox.EmitAsync("Customer", customer.Id, "CustomerUpdated",
            new
            {
                customer.Id,
                customer.StoreId,
                customer.Name,
                customer.Phone,
                customer.Notes,
                customer.IsActive,
                customer.CreatedAt,
                customer.UpdatedAt
            }, ct);
        await _db.SaveChangesAsync(ct);

        return Map(customer);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw DomainException.NotFound("Customer");

        // Addresses cascade via FK; historical Orders keep their snapshotted
        // CustomerName/CustomerPhone (Order.CustomerId has no FK constraint).
        _db.Customers.Remove(customer);
        await _db.SaveChangesAsync(ct);

        await _outbox.EmitAsync("Customer", customer.Id, "CustomerDeleted",
            new { customer.Id, customer.StoreId }, ct);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<CustomerAddressDto> AddAddressAsync(
        Guid customerId, AddressRequest request, CancellationToken ct = default)
    {
        var label = NormalizeRequired(request.Label, "Label");
        var line = NormalizeRequired(request.AddressLine, "AddressLine");
        var district = string.IsNullOrWhiteSpace(request.District) ? null : request.District.Trim();
        var notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();

        var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == customerId, ct)
            ?? throw DomainException.NotFound("Customer");

        var now = DateTime.UtcNow;
        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        if (request.IsDefault)
        {
            // Single default per customer — clear all others first.
            await _db.CustomerAddresses
                .Where(a => a.CustomerId == customer.Id && a.IsDefault)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(a => a.IsDefault, false)
                    .SetProperty(a => a.UpdatedAt, (DateTime?)now), ct);
        }

        var addr = new CustomerAddress
        {
            CustomerId = customer.Id,
            Label = label,
            AddressLine = line,
            District = district,
            Notes = notes,
            IsDefault = request.IsDefault,
        };
        _db.CustomerAddresses.Add(addr);
        await _db.SaveChangesAsync(ct);

        await _outbox.EmitAsync("CustomerAddress", addr.Id, "CustomerAddressAdded",
            new
            {
                addr.Id,
                addr.StoreId,
                addr.CustomerId,
                addr.Label,
                addr.AddressLine,
                addr.District,
                addr.Notes,
                addr.IsDefault,
                addr.CreatedAt,
                addr.UpdatedAt
            }, ct);
        await _db.SaveChangesAsync(ct);

        await tx.CommitAsync(ct);
        return MapAddress(addr);
    }

    public async Task<CustomerAddressDto> UpdateAddressAsync(
        Guid customerId, Guid addressId, AddressRequest request, CancellationToken ct = default)
    {
        var label = NormalizeRequired(request.Label, "Label");
        var line = NormalizeRequired(request.AddressLine, "AddressLine");
        var district = string.IsNullOrWhiteSpace(request.District) ? null : request.District.Trim();
        var notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();

        var addr = await _db.CustomerAddresses
            .FirstOrDefaultAsync(a => a.Id == addressId && a.CustomerId == customerId, ct)
            ?? throw DomainException.NotFound("CustomerAddress");

        var now = DateTime.UtcNow;
        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        if (request.IsDefault && !addr.IsDefault)
        {
            // Clear default flag on every other address of this customer.
            await _db.CustomerAddresses
                .Where(a => a.CustomerId == customerId && a.Id != addr.Id && a.IsDefault)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(a => a.IsDefault, false)
                    .SetProperty(a => a.UpdatedAt, (DateTime?)now), ct);
        }

        addr.Label = label;
        addr.AddressLine = line;
        addr.District = district;
        addr.Notes = notes;
        addr.IsDefault = request.IsDefault;
        addr.UpdatedAt = now;

        await _db.SaveChangesAsync(ct);

        await _outbox.EmitAsync("CustomerAddress", addr.Id, "CustomerAddressUpdated",
            new
            {
                addr.Id,
                addr.StoreId,
                addr.CustomerId,
                addr.Label,
                addr.AddressLine,
                addr.District,
                addr.Notes,
                addr.IsDefault,
                addr.CreatedAt,
                addr.UpdatedAt
            }, ct);
        await _db.SaveChangesAsync(ct);

        await tx.CommitAsync(ct);
        return MapAddress(addr);
    }

    public async Task DeleteAddressAsync(Guid customerId, Guid addressId, CancellationToken ct = default)
    {
        var addr = await _db.CustomerAddresses
            .FirstOrDefaultAsync(a => a.Id == addressId && a.CustomerId == customerId, ct)
            ?? throw DomainException.NotFound("CustomerAddress");

        _db.CustomerAddresses.Remove(addr);
        await _db.SaveChangesAsync(ct);

        await _outbox.EmitAsync("CustomerAddress", addr.Id, "CustomerAddressDeleted",
            new { addr.Id, addr.StoreId, addr.CustomerId }, ct);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<OrderDto>> GetOrdersAsync(Guid customerId, CancellationToken ct = default)
    {
        var customer = await _db.Customers.FirstOrDefaultAsync(c => c.Id == customerId, ct)
            ?? throw DomainException.NotFound("Customer");

        var rows = await _db.Orders
            .Include(o => o.Table)
            .Include(o => o.Items).ThenInclude(i => i.Options)
            .Include(o => o.Payments)
            .Where(o => o.CustomerId == customer.Id || o.CustomerPhone == customer.Phone)
            .OrderByDescending(o => o.CreatedAt)
            .Take(OrderHistoryLimit)
            .ToListAsync(ct);

        return rows.Select(MapOrder).ToList();
    }

    private static string NormalizeRequired(string raw, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(raw))
            throw new DomainException($"{fieldName} is required.");
        // Collapse whitespace edges; do NOT auto-format the phone number.
        return raw.Trim();
    }

    private static CustomerDto Map(Customer c) =>
        new(
            c.Id,
            c.Name,
            c.Phone,
            c.Notes,
            c.IsActive,
            c.CreatedAt,
            c.Addresses
                .OrderByDescending(a => a.IsDefault)
                .ThenBy(a => a.Label)
                .Select(MapAddress)
                .ToList());

    private static CustomerAddressDto MapAddress(CustomerAddress a) =>
        new(a.Id, a.Label, a.AddressLine, a.District, a.Notes, a.IsDefault);

    private static OrderDto MapOrder(Order o) =>
        new(
            o.Id,
            o.OrderNumber,
            o.TableId,
            o.Table?.Name,
            o.Status,
            o.OrderType,
            o.Subtotal,
            o.DiscountAmount,
            o.Total,
            o.CustomerName,
            o.CustomerPhone,
            o.Notes,
            o.CreatedAt,
            o.CompletedAt,
            o.CancelledAt,
            o.Items.Select(MapItem).ToList(),
            o.Payments.OrderBy(p => p.PaidAt).Select(MapPayment).ToList());

    private static OrderItemDto MapItem(OrderItem i) =>
        new(
            i.Id,
            i.ProductId,
            i.ProductName,
            i.UnitPrice,
            i.Quantity,
            i.LineTotal,
            i.Notes,
            i.Options.Select(MapOption).ToList());

    private static OrderItemOptionDto MapOption(OrderItemOption o) =>
        new(o.Id, o.ProductOptionId, o.GroupName, o.OptionName, o.AdditionalPrice);

    private static PaymentDto MapPayment(Payment p) =>
        new(p.Id, p.Amount, p.Method, p.PaidAt, p.ReferenceNumber, p.Notes);
}
