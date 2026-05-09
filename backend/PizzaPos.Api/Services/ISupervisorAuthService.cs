using PizzaPos.Api.DTOs;
using PizzaPos.Api.Entities;

namespace PizzaPos.Api.Services;

public interface ISupervisorAuthService
{
    Task<(Supervisor supervisor, SupervisorSessionResponse response)> LoginAsync(
        SupervisorLoginRequest request, CancellationToken ct = default);

    Task<SupervisorSessionResponse?> GetSessionAsync(Guid supervisorId, CancellationToken ct = default);
}
