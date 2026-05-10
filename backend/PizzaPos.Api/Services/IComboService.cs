using PizzaPos.Api.DTOs;

namespace PizzaPos.Api.Services;

public interface IComboService
{
    Task<IReadOnlyList<ComboDto>> ListAsync(bool? activeOnly, CancellationToken ct = default);
    Task<ComboDto?> GetAsync(Guid id, CancellationToken ct = default);
    Task<ComboDto> CreateAsync(CreateComboRequest request, CancellationToken ct = default);
    Task<ComboDto> UpdateAsync(Guid id, UpdateComboRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}
