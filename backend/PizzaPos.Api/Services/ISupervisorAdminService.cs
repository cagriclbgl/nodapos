using PizzaPos.Api.DTOs;

namespace PizzaPos.Api.Services;

public interface ISupervisorAdminService
{
    Task<SupervisorDashboardDto> GetDashboardAsync(CancellationToken ct = default);
    Task<IReadOnlyList<StoreOverviewDto>> ListStoresAsync(CancellationToken ct = default);
    Task<StoreDto?> GetStoreAsync(Guid storeId, CancellationToken ct = default);
    Task<StoreDto> UpdateStoreAsync(Guid storeId, UpdateStoreRequest request, CancellationToken ct = default);

    Task<IReadOnlyList<UserDto>> ListStoreUsersAsync(Guid storeId, CancellationToken ct = default);
    Task<UserDto> CreateStoreUserAsync(Guid storeId, SupervisorCreateUserRequest request, CancellationToken ct = default);
    Task<UserDto> UpdateStoreUserAsync(Guid storeId, Guid userId, UpdateUserRequest request, CancellationToken ct = default);
    Task ResetStoreUserPasswordAsync(Guid storeId, Guid userId, ResetPasswordRequest request, CancellationToken ct = default);
}
