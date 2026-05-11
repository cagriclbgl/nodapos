// Mirrors backend/PizzaPos.Api/DTOs/*.cs — keep field names in lockstep.

export type UserRole = "Manager" | "Cashier";

export interface UserDto {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface StoreSummaryDto {
  id: string;
  name: string;
}

export interface LoginRequest {
  // Optional — server resolves the store from the username when there's only
  // one match. Set this only on the disambiguation retry after a 409.
  storeId?: string;
  username: string;
  password: string;
}

export interface LoginResponse {
  user: UserDto;
  store: StoreSummaryDto;
}

export interface BootstrapRequest {
  storeId: string;
  username: string;
  password: string;
  fullName: string;
}

export interface CreateUserRequest {
  username: string;
  fullName: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserRequest {
  fullName?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface ResetPasswordRequest {
  newPassword: string;
}

export type TableStatus = "Empty" | "Occupied" | "AwaitingPayment";
export type OrderStatus = "Active" | "Completed" | "Cancelled";
export type OrderType = "DineIn" | "Takeaway" | "Delivery";
export type PaymentMethod =
  | "Cash"
  | "CreditCard"
  | "DebitCard"
  | "MealCard"
  | "Other";

export interface StoreDto {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  taxNumber?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateStoreRequest {
  name: string;
  address?: string | null;
  phone?: string | null;
  taxNumber?: string | null;
}

export interface UpdateStoreRequest extends CreateStoreRequest {
  isActive: boolean;
}

export interface TableDto {
  id: string;
  name: string;
  capacity: number;
  status: TableStatus;
  displayOrder: number;
  isActive: boolean;
}

export interface CreateTableRequest {
  name: string;
  capacity: number;
  displayOrder: number;
}

export interface UpdateTableRequest extends CreateTableRequest {
  isActive: boolean;
}

export interface CategoryDto {
  id: string;
  name: string;
  description?: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string | null;
  displayOrder: number;
}

export interface UpdateCategoryRequest extends CreateCategoryRequest {
  isActive: boolean;
}

export interface ProductOptionDto {
  id: string;
  groupName: string;
  name: string;
  additionalPrice: number;
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
}

export interface ProductDto {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  isAvailable: boolean;
  displayOrder: number;
  options: ProductOptionDto[];
}

export interface CreateProductRequest {
  categoryId: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  displayOrder: number;
}

export interface UpdateProductRequest extends CreateProductRequest {
  isAvailable: boolean;
}

export interface CreateProductOptionRequest {
  groupName: string;
  name: string;
  additionalPrice: number;
  isRequired: boolean;
  displayOrder: number;
}

export interface OrderItemOptionDto {
  id: string;
  productOptionId?: string | null;
  groupName: string;
  optionName: string;
  additionalPrice: number;
}

export interface OrderItemDto {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  notes?: string | null;
  options: OrderItemOptionDto[];
}

export interface AddOrderItemRequest {
  productId: string;
  quantity: number;
  notes?: string | null;
  productOptionIds: string[];
}

export interface UpdateOrderItemRequest {
  quantity: number;
}

export interface UpdateOrderDetailsRequest {
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
}

export interface PaymentDto {
  id: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  referenceNumber?: string | null;
  notes?: string | null;
}

export interface PaymentLineRequest {
  amount: number;
  method: PaymentMethod;
  referenceNumber?: string | null;
  notes?: string | null;
}

export interface CompleteOrderRequest {
  payments: PaymentLineRequest[];
}

export interface OrderDto {
  id: string;
  orderNumber: string;
  tableId?: string | null;
  tableName?: string | null;
  status: OrderStatus;
  orderType: OrderType;
  subtotal: number;
  discountAmount: number;
  total: number;
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  createdAt: string;
  completedAt?: string | null;
  cancelledAt?: string | null;
  items: OrderItemDto[];
  payments: PaymentDto[];
  // Delivery (Sprint B) — DineIn için tamamı null/Pending kalır.
  deliveryAddressSnapshot?: string | null;
  deliveryDistrict?: string | null;
  fulfillmentStatus?: FulfillmentStatus;
  assignedCourierUserId?: string | null;
  outForDeliveryAt?: string | null;
  deliveredAt?: string | null;
  incomingCallId?: string | null;
}

export interface CreateOrderRequest {
  tableId?: string | null;
  orderType: OrderType;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  discountAmount: number;
  items: AddOrderItemRequest[];
}

export interface ComboItemDto {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  displayOrder: number;
}

export interface ComboDto {
  id: string;
  name: string;
  description: string | null;
  price: number;
  isActive: boolean;
  displayOrder: number;
  items: ComboItemDto[];
}

export interface CreateComboItemRequest {
  productId: string;
  quantity: number;
  displayOrder: number;
}

export interface CreateComboRequest {
  name: string;
  description?: string | null;
  price: number;
  displayOrder: number;
  items: CreateComboItemRequest[];
}

export interface UpdateComboRequest {
  name: string;
  description?: string | null;
  price: number;
  isActive: boolean;
  displayOrder: number;
  items: CreateComboItemRequest[];
}

export interface AddComboToOrderRequest {
  comboId: string;
  quantity: number;
}

export interface CustomerListItemDto {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
  orderCount: number;
  lastOrderAt: string | null;
}

export interface CustomerAddressDto {
  id: string;
  label: string;
  addressLine: string;
  district: string | null;
  notes: string | null;
  isDefault: boolean;
}

export interface CustomerDto {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  addresses: CustomerAddressDto[];
}

export interface CreateCustomerRequest {
  name: string;
  phone: string;
  notes?: string | null;
}

export interface UpdateCustomerRequest {
  name?: string;
  phone?: string;
  notes?: string | null;
  isActive?: boolean;
}

export interface AddressRequest {
  label: string;
  addressLine: string;
  district?: string | null;
  notes?: string | null;
  isDefault: boolean;
}

// --- Supervisor / platform admin -------------------------------------------

export type StoreRegistrationStatus = "Pending" | "Approved" | "Rejected";

export interface SupervisorDto {
  id: string;
  username: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface SupervisorLoginRequest {
  username: string;
  password: string;
}

export interface SupervisorSessionResponse {
  supervisor: SupervisorDto;
}

export interface SupervisorDashboardDto {
  totalStores: number;
  activeStores: number;
  pendingRegistrations: number;
  totalUsers: number;
}

export interface StoreRegistrationRequestDto {
  id: string;
  storeName: string;
  contactName: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: StoreRegistrationStatus;
  createdAt: string;
  processedAt: string | null;
  createdStoreId: string | null;
  rejectionReason: string | null;
}

export interface CreateStoreRegistrationRequest {
  storeName: string;
  contactName: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface ApproveRegistrationRequest {
  storeNameOverride?: string | null;
  address?: string | null;
  phone?: string | null;
  managerUsername: string;
  managerPassword: string;
  managerFullName: string;
}

export interface ApproveRegistrationResponse {
  storeId: string;
  managerUserId: string;
}

export interface RejectRegistrationRequest {
  reason?: string | null;
}

export interface StoreOverviewDto {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  taxNumber: string | null;
  isActive: boolean;
  createdAt: string;
  userCount: number;
  orderCount: number;
}

export interface SupervisorCreateUserRequest {
  username: string;
  fullName: string;
  password: string;
  role: UserRole;
}

// --- Caller ID & Incoming Calls --------------------------------------------

export type IncomingCallStatus = "New" | "Handled" | "Missed" | "Ignored";
export type FulfillmentStatus =
  | "Pending"
  | "InKitchen"
  | "Ready"
  | "OutForDelivery"
  | "Delivered";

export interface CustomerSummaryDto {
  id: string;
  name: string;
  phone: string;
  defaultAddressLine: string | null;
  defaultAddressDistrict: string | null;
}

export interface RecentOrderSummaryDto {
  id: string;
  orderNumber: string;
  createdAt: string;
  total: number;
  status: OrderStatus;
  orderType: OrderType;
}

export interface IncomingCallDto {
  id: string;
  phone: string | null;
  lineNumber: number | null;
  receivedAt: string;
  status: IncomingCallStatus;
  matchedCustomerId: string | null;
  resolvedOrderId: string | null;
  handledAt: string | null;
  note: string | null;
  matchedCustomer: CustomerSummaryDto | null;
  recentOrders: RecentOrderSummaryDto[];
}

export interface ResolveIncomingCallRequest {
  orderId?: string | null;
  status?: IncomingCallStatus | null;
}

export interface UpdateIncomingCallNoteRequest {
  note: string | null;
}

// --- Delivery (Sprint B) ---------------------------------------------------

export interface CreateDeliveryOrderRequest {
  orderType: "Takeaway" | "Delivery";
  customerId: string;
  customerAddressId?: string | null;
  addressLine?: string | null;
  district?: string | null;
  notes?: string | null;
  discountAmount: number;
  items: AddOrderItemRequest[];
  incomingCallId?: string | null;
}
