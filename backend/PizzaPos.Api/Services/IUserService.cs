using PizzaPos.Api.DTOs;

namespace PizzaPos.Api.Services;

public interface IUserService
{
    Task<IReadOnlyList<UserDto>> ListAsync(CancellationToken ct = default);
    Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken ct = default);
    Task<UserDto> UpdateAsync(Guid id, UpdateUserRequest request, CancellationToken ct = default);
    Task ResetPasswordAsync(Guid id, ResetPasswordRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}
