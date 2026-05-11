import { API_BASE_URL } from "./env";
import type {
  AddComboToOrderRequest,
  AddressRequest,
  ApproveRegistrationRequest,
  ApproveRegistrationResponse,
  BootstrapRequest,
  ComboDto,
  CreateComboRequest,
  CreateCustomerRequest,
  CreateDeliveryOrderRequest,
  CreateStoreRegistrationRequest,
  CreateUserRequest,
  CustomerAddressDto,
  CustomerDto,
  CustomerListItemDto,
  IncomingCallDto,
  IncomingCallStatus,
  LoginRequest,
  LoginResponse,
  OrderDto,
  RejectRegistrationRequest,
  ResetPasswordRequest,
  ResolveIncomingCallRequest,
  StoreDto,
  StoreOverviewDto,
  StoreRegistrationRequestDto,
  StoreRegistrationStatus,
  SupervisorCreateUserRequest,
  SupervisorDashboardDto,
  SupervisorLoginRequest,
  SupervisorSessionResponse,
  UpdateComboRequest,
  UpdateCustomerRequest,
  UpdateIncomingCallNoteRequest,
  UpdateStoreRequest,
  UpdateUserRequest,
  UserDto,
} from "@/types/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiOptions extends Omit<RequestInit, "body"> {
  storeId?: string | null;
  body?: unknown;
  /** Set when the endpoint must hit cloud regardless of host (e.g. public
   *  restaurant registration submitted from a kasa that's still unprovisioned). */
  cloudOnly?: boolean;
}

/**
 * Cloud-only endpoints (restaurant registration, supervisor flows reachable
 * from anonymous kasa screens) must reach Hetzner directly even when the
 * kasa's lib/env runtime resolves API_BASE_URL to localhost. Same value on
 * Vercel cloud admin where it's a no-op.
 */
const CLOUD_API_BASE_URL =
  process.env.NEXT_PUBLIC_CLOUD_API_BASE_URL ?? "https://api.nodapos.com";

/**
 * Thin fetch wrapper around the .NET backend. Adds X-Store-Id when provided,
 * normalizes JSON bodies, and converts ProblemDetails responses into ApiError.
 *
 * Always sends `credentials: "include"` so the auth cookie travels with every
 * request (login flow lives in `auth.*`).
 */
export async function apiFetch<T>(
  path: string,
  { storeId, body, headers, cloudOnly, ...rest }: ApiOptions = {}
): Promise<T> {
  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...((headers as Record<string, string>) ?? {}),
  };
  if (body !== undefined) finalHeaders["Content-Type"] = "application/json";
  if (storeId) finalHeaders["X-Store-Id"] = storeId;

  const baseUrl = cloudOnly ? CLOUD_API_BASE_URL : API_BASE_URL;
  const res = await fetch(`${baseUrl}${path}`, {
    ...rest,
    credentials: "include",
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = "";
    try {
      const data = await res.json();
      detail = data.detail ?? data.error ?? data.title ?? JSON.stringify(data);
    } catch {
      // ignore non-JSON error bodies
    }
    // Notify the AuthProvider so it can clear session state and bounce the
    // user to /login. Suppressed for the *.me() probes themselves, which
    // legitimately return 401 for anonymous visitors.
    if (res.status === 401) {
      const isSupervisorPath = path.startsWith("/api/supervisor");
      const meProbe = isSupervisorPath
        ? path === "/api/supervisor/auth/me"
        : path === "/api/auth/me";
      if (!meProbe && typeof window !== "undefined") {
        const evt = isSupervisorPath
          ? "pizzapos:supervisor-unauthorized"
          : "pizzapos:unauthorized";
        window.dispatchEvent(new CustomEvent(evt));
      }
    }
    throw new ApiError(
      res.status,
      `${res.status} ${res.statusText}`.trim(),
      detail || undefined
    );
  }

  if (res.status === 204) return undefined as T;
  // Some endpoints (DELETE) may return empty bodies with 200; guard for that.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string, storeId?: string | null) =>
    apiFetch<T>(path, { storeId }),
  post: <T>(path: string, body?: unknown, storeId?: string | null) =>
    apiFetch<T>(path, { method: "POST", body, storeId }),
  put: <T>(path: string, body?: unknown, storeId?: string | null) =>
    apiFetch<T>(path, { method: "PUT", body, storeId }),
  patch: <T>(path: string, body?: unknown, storeId?: string | null) =>
    apiFetch<T>(path, { method: "PATCH", body, storeId }),
  delete: <T = void>(path: string, storeId?: string | null) =>
    apiFetch<T>(path, { method: "DELETE", storeId }),
};

/**
 * Auth flow. Cookie-backed; the backend issues a JWT cookie on login that
 * `credentials: "include"` carries on every subsequent call.
 */
export const auth = {
  login: (req: LoginRequest) => api.post<LoginResponse>("/api/auth/login", req),
  logout: () => api.post<void>("/api/auth/logout"),
  me: () => api.get<LoginResponse>("/api/auth/me"),
  bootstrap: (req: BootstrapRequest) =>
    api.post<LoginResponse>("/api/auth/bootstrap", req),
};

/**
 * User management (Manager-only on the backend). All calls are tenant-scoped
 * via the cookie session, so no explicit storeId is needed.
 */
export const users = {
  list: () => api.get<UserDto[]>("/api/users"),
  create: (req: CreateUserRequest) => api.post<UserDto>("/api/users", req),
  update: (id: string, req: UpdateUserRequest) =>
    api.patch<UserDto>(`/api/users/${id}`, req),
  resetPassword: (id: string, req: ResetPasswordRequest) =>
    api.post<void>(`/api/users/${id}/reset-password`, req),
  remove: (id: string) => api.delete(`/api/users/${id}`),
};

/**
 * Customer database — phone-first lookups for delivery/takeaway flows and a
 * full admin CRUD with per-customer address book. Tenant comes from cookie.
 */
export const customers = {
  list: (params?: { search?: string }, signal?: AbortSignal) => {
    const qs = params?.search?.trim()
      ? `?search=${encodeURIComponent(params.search.trim())}`
      : "";
    return apiFetch<CustomerListItemDto[]>(`/api/customers${qs}`, { signal });
  },
  get: (id: string) => api.get<CustomerDto>(`/api/customers/${id}`),
  create: (req: CreateCustomerRequest) =>
    api.post<CustomerDto>("/api/customers", req),
  update: (id: string, req: UpdateCustomerRequest) =>
    api.patch<CustomerDto>(`/api/customers/${id}`, req),
  remove: (id: string) => api.delete(`/api/customers/${id}`),
  addAddress: (id: string, req: AddressRequest) =>
    api.post<CustomerAddressDto>(`/api/customers/${id}/addresses`, req),
  updateAddress: (id: string, addressId: string, req: AddressRequest) =>
    api.patch<CustomerAddressDto>(
      `/api/customers/${id}/addresses/${addressId}`,
      req
    ),
  deleteAddress: (id: string, addressId: string) =>
    api.delete(`/api/customers/${id}/addresses/${addressId}`),
  orders: (id: string) =>
    api.get<OrderDto[]>(`/api/customers/${id}/orders`),
};

/**
 * Kampanya / Combo menüleri. List ve Get tüm authed user'lara açık (kasiyer
 * sipariş eklerken kullanır); Create/Update/Delete sadece Manager.
 */
export const combos = {
  list: (activeOnly?: boolean) =>
    api.get<ComboDto[]>(
      `/api/combos${activeOnly ? "?activeOnly=true" : ""}`
    ),
  get: (id: string) => api.get<ComboDto>(`/api/combos/${id}`),
  create: (req: CreateComboRequest) => api.post<ComboDto>("/api/combos", req),
  update: (id: string, req: UpdateComboRequest) =>
    api.put<ComboDto>(`/api/combos/${id}`, req),
  remove: (id: string) => api.delete(`/api/combos/${id}`),
};

/**
 * Order'a combo (snapshot) eklemek — sipariş ekranındaki "Kampanyalar" tab'ı
 * kullanır. Yeni model: kasiyer tek tıkla combo ID'sini gönderir; backend
 * combo.Items'i resolve eder, tek snapshot OrderItem yaratır (ProductName
 * combo.Name, Notes "2x Klasik Pizza, 1x Cola").
 */
export const orders = {
  list: (params?: {
    status?: string;
    tableId?: string;
    orderType?: string;
    from?: string;
    to?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.tableId) qs.set("tableId", params.tableId);
    if (params?.orderType) qs.set("orderType", params.orderType);
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return api.get<OrderDto[]>(`/api/orders${suffix}`);
  },
  get: (id: string) => api.get<OrderDto>(`/api/orders/${id}`),
  addCombo: (orderId: string, req: AddComboToOrderRequest) =>
    api.post<OrderDto>(`/api/orders/${orderId}/combos`, req),
  /** Masasız (paket / kurye) sipariş yaratır. Caller ID akışı ve "Paket" sekmesi kullanır. */
  createDelivery: (req: CreateDeliveryOrderRequest) =>
    api.post<OrderDto>("/api/orders/delivery", req),
  /** Delivery fulfillment transition (Hazırlanıyor → Yolda → Teslim Edildi). */
  updateFulfillment: (
    orderId: string,
    req: { status: string; courierUserId?: string | null }
  ) => api.patch<OrderDto>(`/api/orders/${orderId}/fulfillment`, req),
};

/**
 * Caller ID kaynaklı çağrı kayıtları. POST endpoint'i normalde Electron main
 * process tarafından doldurulur (HID listener); UI sadece okur ve resolve eder.
 */
export const incomingCalls = {
  list: (params?: {
    from?: string;
    to?: string;
    status?: IncomingCallStatus;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    if (params?.status) qs.set("status", params.status);
    if (params?.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return api.get<IncomingCallDto[]>(`/api/incoming-calls${suffix}`);
  },
  get: (id: string) => api.get<IncomingCallDto>(`/api/incoming-calls/${id}`),
  resolve: (id: string, req: ResolveIncomingCallRequest) =>
    api.patch<IncomingCallDto>(`/api/incoming-calls/${id}/resolve`, req),
  updateNote: (id: string, req: UpdateIncomingCallNoteRequest) =>
    api.patch<IncomingCallDto>(`/api/incoming-calls/${id}/note`, req),
};

/**
 * Public restaurant-registration form. Anonymous; landing page submits this
 * to start the supervisor approval flow.
 */
export const registrations = {
  // Always hits cloud. A fresh kasa has no Store/User yet — submitting the
  // registration locally would write to its (empty) SQLite and never reach
  // the supervisor. Pull worker brings the approved Manager user down
  // automatically once the supervisor accepts.
  create: (req: CreateStoreRegistrationRequest) =>
    apiFetch<{ id: string }>("/api/registrations", {
      method: "POST",
      body: req,
      cloudOnly: true,
    }),
};

/**
 * Platform supervisor (cross-tenant admin) — separate cookie/route from
 * regular store auth. Issues `pizza_supervisor` cookie on login.
 */
export const supervisorAuth = {
  login: (req: SupervisorLoginRequest) =>
    api.post<SupervisorSessionResponse>("/api/supervisor/auth/login", req),
  logout: () => api.post<void>("/api/supervisor/auth/logout"),
  me: () => api.get<SupervisorSessionResponse>("/api/supervisor/auth/me"),
};

export const supervisor = {
  dashboard: () =>
    api.get<SupervisorDashboardDto>("/api/supervisor/dashboard"),
  registrations: {
    list: (status?: StoreRegistrationStatus) => {
      const qs = status ? `?status=${status}` : "";
      return api.get<StoreRegistrationRequestDto[]>(
        `/api/supervisor/registrations${qs}`
      );
    },
    get: (id: string) =>
      api.get<StoreRegistrationRequestDto>(
        `/api/supervisor/registrations/${id}`
      ),
    approve: (id: string, req: ApproveRegistrationRequest) =>
      api.post<ApproveRegistrationResponse>(
        `/api/supervisor/registrations/${id}/approve`,
        req
      ),
    reject: (id: string, req: RejectRegistrationRequest) =>
      api.post<StoreRegistrationRequestDto>(
        `/api/supervisor/registrations/${id}/reject`,
        req
      ),
  },
  stores: {
    list: () => api.get<StoreOverviewDto[]>("/api/supervisor/stores"),
    get: (id: string) => api.get<StoreDto>(`/api/supervisor/stores/${id}`),
    update: (id: string, req: UpdateStoreRequest) =>
      api.put<StoreDto>(`/api/supervisor/stores/${id}`, req),
    listUsers: (id: string) =>
      api.get<UserDto[]>(`/api/supervisor/stores/${id}/users`),
    createUser: (id: string, req: SupervisorCreateUserRequest) =>
      api.post<UserDto>(`/api/supervisor/stores/${id}/users`, req),
    updateUser: (id: string, userId: string, req: UpdateUserRequest) =>
      api.patch<UserDto>(
        `/api/supervisor/stores/${id}/users/${userId}`,
        req
      ),
    resetUserPassword: (
      id: string,
      userId: string,
      req: ResetPasswordRequest
    ) =>
      api.post<void>(
        `/api/supervisor/stores/${id}/users/${userId}/reset-password`,
        req
      ),
  },
};
