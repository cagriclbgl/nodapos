using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Services;

public interface ITableService
{
    Task<IReadOnlyList<TableDto>> ListAsync(CancellationToken ct = default);
    Task<TableDto?> GetAsync(Guid id, CancellationToken ct = default);
    Task<TableDto> CreateAsync(CreateTableRequest request, CancellationToken ct = default);
    Task<TableDto> UpdateAsync(Guid id, UpdateTableRequest request, CancellationToken ct = default);
    Task<TableDto> UpdateStatusAsync(Guid id, TableStatus status, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}
