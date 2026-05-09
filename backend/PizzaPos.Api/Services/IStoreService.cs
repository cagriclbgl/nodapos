using PizzaPos.Api.DTOs;

namespace PizzaPos.Api.Services;

public interface IStoreService
{
    Task<IReadOnlyList<StoreDto>> ListAsync(CancellationToken ct = default);
    Task<StoreDto?> GetAsync(Guid id, CancellationToken ct = default);
    Task<StoreDto> CreateAsync(CreateStoreRequest request, CancellationToken ct = default);
    Task<StoreDto> UpdateAsync(Guid id, UpdateStoreRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}
