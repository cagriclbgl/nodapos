using PizzaPos.Api.DTOs;

namespace PizzaPos.Api.Services;

public interface ICustomerService
{
    Task<IReadOnlyList<CustomerListItemDto>> SearchAsync(string? search, CancellationToken ct = default);
    Task<CustomerDto?> GetAsync(Guid id, CancellationToken ct = default);
    Task<CustomerDto> CreateAsync(CreateCustomerRequest request, CancellationToken ct = default);
    Task<CustomerDto> UpdateAsync(Guid id, UpdateCustomerRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);

    Task<CustomerAddressDto> AddAddressAsync(Guid customerId, AddressRequest request, CancellationToken ct = default);
    Task<CustomerAddressDto> UpdateAddressAsync(Guid customerId, Guid addressId, AddressRequest request, CancellationToken ct = default);
    Task DeleteAddressAsync(Guid customerId, Guid addressId, CancellationToken ct = default);

    Task<IReadOnlyList<OrderDto>> GetOrdersAsync(Guid customerId, CancellationToken ct = default);
}
