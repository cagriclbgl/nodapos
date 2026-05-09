using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Services;

public interface IStoreRegistrationService
{
    Task<Guid> CreateAsync(CreateStoreRegistrationRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<StoreRegistrationRequestDto>> ListAsync(StoreRegistrationStatus? status, CancellationToken ct = default);
    Task<StoreRegistrationRequestDto?> GetAsync(Guid id, CancellationToken ct = default);
    Task<ApproveRegistrationResponse> ApproveAsync(Guid id, ApproveRegistrationRequest request, Guid supervisorId, CancellationToken ct = default);
    Task<StoreRegistrationRequestDto> RejectAsync(Guid id, RejectRegistrationRequest request, Guid supervisorId, CancellationToken ct = default);
}
