"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, customers as customersApi } from "@/lib/api";
import { describeError } from "@/lib/use-store-api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type {
  AddressRequest,
  CreateCustomerRequest,
  CustomerAddressDto,
  CustomerDto,
  CustomerListItemDto,
  OrderDto,
  UpdateCustomerRequest,
} from "@/types/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

const EMPTY_CREATE: CreateCustomerRequest = {
  name: "",
  phone: "",
  notes: null,
};

const EMPTY_ADDRESS: AddressRequest = {
  label: "",
  addressLine: "",
  district: null,
  notes: null,
  isDefault: false,
};

type Mode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit-address"; address: CustomerAddressDto | null };

export default function CustomersPage() {
  const [list, setList] = useState<CustomerListItemDto[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CustomerDto | null>(null);
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>({ kind: "closed" });
  const [createDraft, setCreateDraft] =
    useState<CreateCustomerRequest>(EMPTY_CREATE);
  const [addressDraft, setAddressDraft] =
    useState<AddressRequest>(EMPTY_ADDRESS);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const data = await customersApi.list({ search: q }, ctrl.signal);
      if (!ctrl.signal.aborted) setList(data);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(
        err instanceof ApiError ? err.detail || err.message : String(err)
      );
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);

  // Debounce search input.
  useEffect(() => {
    const handle = window.setTimeout(() => void load(search), 250);
    return () => window.clearTimeout(handle);
  }, [search, load]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const [c, os] = await Promise.all([
        customersApi.get(id),
        customersApi.orders(id),
      ]);
      setDetail(c);
      setOrders(os);
    } catch (err) {
      setDetailError(describeError(err));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setOrders([]);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const refreshAll = async () => {
    await load(search);
    if (selectedId) await loadDetail(selectedId);
  };

  // ─── Create customer ─────────────────────────────────────
  const openCreate = () => {
    setCreateDraft(EMPTY_CREATE);
    setFormError(null);
    setMode({ kind: "create" });
  };

  const submitCreate = async () => {
    if (!createDraft.name.trim() || !createDraft.phone.trim()) {
      setFormError("Ad ve telefon zorunlu.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const created = await customersApi.create({
        name: createDraft.name.trim(),
        phone: createDraft.phone.trim(),
        notes: createDraft.notes?.trim() || null,
      });
      await load(search);
      setSelectedId(created.id);
      setMode({ kind: "closed" });
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  // ─── Update existing customer ────────────────────────────
  const updateCustomer = async (req: UpdateCustomerRequest) => {
    if (!detail) return;
    setBusy(true);
    setDetailError(null);
    try {
      const updated = await customersApi.update(detail.id, req);
      setDetail(updated);
      await load(search);
    } catch (err) {
      setDetailError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const removeCustomer = async () => {
    if (!detail) return;
    if (
      !confirm(
        `"${detail.name}" müşterisini silmek istediğine emin misin? (geçmiş siparişler etkilenmez)`
      )
    )
      return;
    setBusy(true);
    try {
      await customersApi.remove(detail.id);
      setSelectedId(null);
      await load(search);
    } catch (err) {
      alert(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  // ─── Address management ──────────────────────────────────
  const openAddAddress = () => {
    setAddressDraft({ ...EMPTY_ADDRESS });
    setFormError(null);
    setMode({ kind: "edit-address", address: null });
  };

  const openEditAddress = (a: CustomerAddressDto) => {
    setAddressDraft({
      label: a.label,
      addressLine: a.addressLine,
      district: a.district,
      notes: a.notes,
      isDefault: a.isDefault,
    });
    setFormError(null);
    setMode({ kind: "edit-address", address: a });
  };

  const submitAddress = async () => {
    if (!detail) return;
    if (!addressDraft.label.trim() || !addressDraft.addressLine.trim()) {
      setFormError("Etiket ve adres zorunlu.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const payload: AddressRequest = {
        label: addressDraft.label.trim(),
        addressLine: addressDraft.addressLine.trim(),
        district: addressDraft.district?.trim() || null,
        notes: addressDraft.notes?.trim() || null,
        isDefault: addressDraft.isDefault,
      };
      if (mode.kind === "edit-address" && mode.address) {
        await customersApi.updateAddress(detail.id, mode.address.id, payload);
      } else {
        await customersApi.addAddress(detail.id, payload);
      }
      await loadDetail(detail.id);
      setMode({ kind: "closed" });
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const removeAddress = async (a: CustomerAddressDto) => {
    if (!detail) return;
    if (!confirm(`"${a.label}" adresini silmek istediğine emin misin?`)) return;
    setBusy(true);
    try {
      await customersApi.deleteAddress(detail.id, a.id);
      await loadDetail(detail.id);
    } catch (err) {
      alert(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Müşteriler</h2>
          <p className="text-zinc-500">
            Telefon ya da isim üzerinden ara, müşteri kaydı ve adreslerini yönet.
          </p>
        </div>
        <Button onClick={openCreate}>+ Müşteri</Button>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Left — list + search */}
        <section className="flex-1">
          <Input
            label="Ara"
            type="search"
            placeholder="Telefon ya da isim…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950">
                <tr>
                  <th className="px-4 py-2.5">Ad</th>
                  <th className="px-4 py-2.5">Telefon</th>
                  <th className="px-4 py-2.5 text-right">Sipariş</th>
                  <th className="px-4 py-2.5">Son Sipariş</th>
                  <th className="px-4 py-2.5">Durum</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-zinc-500"
                    >
                      Yükleniyor…
                    </td>
                  </tr>
                )}
                {!loading && list.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-zinc-500"
                    >
                      Henüz müşteri yok. + Müşteri ile ekleyebilirsin.
                    </td>
                  </tr>
                )}
                {list.map((c) => {
                  const active = c.id === selectedId;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={
                        "cursor-pointer border-t border-zinc-200 transition-colors dark:border-zinc-800 " +
                        (active
                          ? "bg-orange-50 dark:bg-orange-950/30"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60")
                      }
                    >
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        {c.phone}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {c.orderCount}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {c.lastOrderAt ? formatDateTime(c.lastOrderAt) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {c.isActive ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                            Aktif
                          </span>
                        ) : (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                            Pasif
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right — selected customer detail panel */}
        <aside className="w-full lg:w-[26rem] lg:shrink-0">
          {!selectedId ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
              Detay için listeden bir müşteri seç.
            </div>
          ) : detailLoading && !detail ? (
            <div className="rounded-2xl border border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
              Yükleniyor…
            </div>
          ) : detail ? (
            <CustomerDetailPanel
              customer={detail}
              orders={orders}
              busy={busy}
              error={detailError}
              onUpdate={updateCustomer}
              onDelete={removeCustomer}
              onAddAddress={openAddAddress}
              onEditAddress={openEditAddress}
              onDeleteAddress={removeAddress}
              onRefresh={refreshAll}
            />
          ) : (
            <div className="rounded-2xl border border-zinc-200 p-6 text-center text-sm text-red-600 dark:border-zinc-800">
              {detailError ?? "Müşteri yüklenemedi."}
            </div>
          )}
        </aside>
      </div>

      {/* Create modal */}
      <Modal
        open={mode.kind === "create"}
        onClose={() => !busy && setMode({ kind: "closed" })}
        title="Yeni Müşteri"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setMode({ kind: "closed" })}
              disabled={busy}
            >
              Vazgeç
            </Button>
            <Button onClick={submitCreate} disabled={busy}>
              {busy ? "Kaydediliyor…" : "Oluştur"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
              {formError}
            </p>
          )}
          <Input
            label="Ad Soyad"
            value={createDraft.name}
            onChange={(e) =>
              setCreateDraft({ ...createDraft, name: e.target.value })
            }
            required
          />
          <Input
            label="Telefon"
            type="tel"
            value={createDraft.phone}
            onChange={(e) =>
              setCreateDraft({ ...createDraft, phone: e.target.value })
            }
            required
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Not (opsiyonel)
            </span>
            <textarea
              value={createDraft.notes ?? ""}
              onChange={(e) =>
                setCreateDraft({
                  ...createDraft,
                  notes: e.target.value || null,
                })
              }
              rows={3}
              className="rounded-xl border border-zinc-300 bg-white p-2.5 text-base outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        </div>
      </Modal>

      {/* Address create/edit modal */}
      <Modal
        open={mode.kind === "edit-address"}
        onClose={() => !busy && setMode({ kind: "closed" })}
        title={
          mode.kind === "edit-address" && mode.address
            ? "Adresi Düzenle"
            : "Yeni Adres"
        }
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setMode({ kind: "closed" })}
              disabled={busy}
            >
              Vazgeç
            </Button>
            <Button onClick={submitAddress} disabled={busy}>
              {busy ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
              {formError}
            </p>
          )}
          <Input
            label="Etiket (Ev / İş / vb.)"
            value={addressDraft.label}
            onChange={(e) =>
              setAddressDraft({ ...addressDraft, label: e.target.value })
            }
            required
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Adres
            </span>
            <textarea
              value={addressDraft.addressLine}
              onChange={(e) =>
                setAddressDraft({
                  ...addressDraft,
                  addressLine: e.target.value,
                })
              }
              rows={3}
              className="rounded-xl border border-zinc-300 bg-white p-2.5 text-base outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <Input
            label="İlçe / Mahalle (opsiyonel)"
            value={addressDraft.district ?? ""}
            onChange={(e) =>
              setAddressDraft({
                ...addressDraft,
                district: e.target.value || null,
              })
            }
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Not (opsiyonel)
            </span>
            <textarea
              value={addressDraft.notes ?? ""}
              onChange={(e) =>
                setAddressDraft({
                  ...addressDraft,
                  notes: e.target.value || null,
                })
              }
              rows={2}
              className="rounded-xl border border-zinc-300 bg-white p-2.5 text-base outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={addressDraft.isDefault}
              onChange={(e) =>
                setAddressDraft({
                  ...addressDraft,
                  isDefault: e.target.checked,
                })
              }
              className="h-4 w-4"
            />
            <span className="text-sm">Varsayılan adres yap</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}

interface DetailPanelProps {
  customer: CustomerDto;
  orders: OrderDto[];
  busy: boolean;
  error: string | null;
  onUpdate: (req: UpdateCustomerRequest) => Promise<void>;
  onDelete: () => Promise<void>;
  onAddAddress: () => void;
  onEditAddress: (a: CustomerAddressDto) => void;
  onDeleteAddress: (a: CustomerAddressDto) => Promise<void>;
  onRefresh: () => Promise<void>;
}

function CustomerDetailPanel({
  customer,
  orders,
  busy,
  error,
  onUpdate,
  onDelete,
  onAddAddress,
  onEditAddress,
  onDeleteAddress,
}: DetailPanelProps) {
  // Local edit state — reset when the selected customer changes.
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [isActive, setIsActive] = useState(customer.isActive);

  useEffect(() => {
    setName(customer.name);
    setPhone(customer.phone);
    setNotes(customer.notes ?? "");
    setIsActive(customer.isActive);
  }, [customer]);

  const dirty =
    name.trim() !== customer.name ||
    phone.trim() !== customer.phone ||
    (notes.trim() || null) !== (customer.notes ?? null) ||
    isActive !== customer.isActive;

  const save = () =>
    onUpdate({
      name: name.trim(),
      phone: phone.trim(),
      notes: notes.trim() || null,
      isActive,
    });

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{customer.name}</h3>
          <p className="text-xs text-zinc-500">
            Eklendi {formatDateTime(customer.createdAt)}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onDelete} disabled={busy}>
          Sil
        </Button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="space-y-3">
        <Input
          label="Ad Soyad"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Telefon"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Not
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="rounded-xl border border-zinc-300 bg-white p-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm">Aktif</span>
        </label>
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={busy || !dirty}>
            {busy ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}
          </Button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold">Adresler</h4>
          <Button size="sm" variant="ghost" onClick={onAddAddress}>
            + Adres
          </Button>
        </div>
        {customer.addresses.length === 0 ? (
          <p className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-950">
            Bu müşteri için kayıtlı adres yok.
          </p>
        ) : (
          <ul className="space-y-2">
            {customer.addresses.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{a.label}</p>
                      {a.isDefault && (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">
                          Varsayılan
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 whitespace-pre-line text-xs text-zinc-600 dark:text-zinc-400">
                      {a.addressLine}
                    </p>
                    {a.district && (
                      <p className="text-xs text-zinc-500">{a.district}</p>
                    )}
                    {a.notes && (
                      <p className="mt-0.5 text-xs italic text-zinc-500">
                        {a.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => onEditAddress(a)}
                      disabled={busy}
                      className="rounded-md px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteAddress(a)}
                      disabled={busy}
                      className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold">Son Siparişler</h4>
        {orders.length === 0 ? (
          <p className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-950">
            Bu müşteri için henüz sipariş yok.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {orders.slice(0, 10).map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs">{o.orderNumber}</p>
                  <p className="text-xs text-zinc-500">
                    {formatDateTime(o.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">
                    {formatCurrency(o.total)}
                  </span>
                  <Link
                    href={`/print/receipt/${o.id}`}
                    className="rounded-md px-2 py-1 text-xs font-medium text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950/30"
                    target="_blank"
                  >
                    Fiş
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
