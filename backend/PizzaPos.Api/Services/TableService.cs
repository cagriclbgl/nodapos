using Microsoft.EntityFrameworkCore;
using PizzaPos.Api.Data;
using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Services;

public class TableService : ITableService
{
    private readonly AppDbContext _db;
    private readonly IOutboxEmitter _outbox;

    public TableService(AppDbContext db, IOutboxEmitter outbox)
    {
        _db = db;
        _outbox = outbox;
    }

    public async Task<IReadOnlyList<TableDto>> ListAsync(CancellationToken ct = default)
    {
        return await _db.Tables
            .OrderBy(t => t.DisplayOrder).ThenBy(t => t.Name)
            .Select(t => Map(t))
            .ToListAsync(ct);
    }

    public async Task<TableDto?> GetAsync(Guid id, CancellationToken ct = default)
    {
        var t = await _db.Tables.FindAsync([id], ct);
        return t is null ? null : Map(t);
    }

    public async Task<TableDto> CreateAsync(CreateTableRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new DomainException("Table name is required.");

        var table = new Table
        {
            Name = request.Name.Trim(),
            Capacity = request.Capacity > 0 ? request.Capacity : 4,
            DisplayOrder = request.DisplayOrder,
            Status = TableStatus.Empty,
            IsActive = true
        };
        _db.Tables.Add(table);
        await _db.SaveChangesAsync(ct);
        return Map(table);
    }

    public async Task<TableDto> UpdateAsync(Guid id, UpdateTableRequest request, CancellationToken ct = default)
    {
        var table = await _db.Tables.FindAsync([id], ct)
            ?? throw DomainException.NotFound("Table");

        table.Name = request.Name.Trim();
        table.Capacity = request.Capacity;
        table.DisplayOrder = request.DisplayOrder;
        table.IsActive = request.IsActive;

        await _db.SaveChangesAsync(ct);
        return Map(table);
    }

    public async Task<TableDto> UpdateStatusAsync(Guid id, TableStatus status, CancellationToken ct = default)
    {
        var table = await _db.Tables.FindAsync([id], ct)
            ?? throw DomainException.NotFound("Table");

        if (table.Status == status)
            return Map(table); // no-op — outbox spam'i onle

        table.Status = status;
        await _outbox.EmitAsync("Table", table.Id, "TableStatusChanged",
            new
            {
                tableId = table.Id,
                status,
                updatedAt = DateTime.UtcNow
            }, ct);
        await _db.SaveChangesAsync(ct);
        return Map(table);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var table = await _db.Tables.FindAsync([id], ct)
            ?? throw DomainException.NotFound("Table");

        var hasActiveOrder = await _db.Orders.AnyAsync(
            o => o.TableId == id && o.Status == OrderStatus.Active, ct);
        if (hasActiveOrder)
            throw DomainException.Conflict("Table has an active order and cannot be deleted.");

        _db.Tables.Remove(table);
        await _db.SaveChangesAsync(ct);
    }

    private static TableDto Map(Table t) =>
        new(t.Id, t.Name, t.Capacity, t.Status, t.DisplayOrder, t.IsActive);
}
