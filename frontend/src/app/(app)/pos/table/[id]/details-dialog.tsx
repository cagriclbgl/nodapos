"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { CustomerSearch, SelectedCustomer } from "@/components/CustomerSearch";
import { customers as customersApi } from "@/lib/api";
import { describeError } from "@/lib/use-store-api";
import {
  CustomerAddressDto,
  OrderDto,
  UpdateOrderDetailsRequest,
} from "@/types/api";

interface Props {
  order: OrderDto;
  onClose: () => void;
  onSubmit: (req: UpdateOrderDetailsRequest) => Promise<void>;
}

/**
 * Customer + per-order note editor. Now wired to the customer database via
 * <CustomerSearch>: picking a record auto-fills the name/phone fields, and
 * its addresses are listed read-only so the cashier can confirm a delivery
 * target. Existing free-text values are preserved (and editable) when no
 * record is selected — useful for legacy orders or one-off walk-ins.
 *
 * NOTE: today the backend's `UpdateOrderDetailsRequest` only accepts the
 * customer name + phone snapshots. Linking an existing order to a
 * `customerId` happens at order-creation time (see `CreateOrderRequest` in
 * `order-screen.tsx`).
 */
export function DetailsDialog({ order, onClose, onSubmit }: Props) {
  const [selected, setSelected] = useState<SelectedCustomer | null>(null);
  const [customerName, setCustomerName] = useState(order.customerName ?? "");
  const [customerPhone, setCustomerPhone] = useState(order.customerPhone ?? "");
  const [addresses, setAddresses] = useState<CustomerAddressDto[]>([]);
  const [notes, setNotes] = useState(order.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Whenever a customer is selected, mirror name/phone and pull addresses.
  useEffect(() => {
    if (!selected) {
      setAddresses([]);
      return;
    }
    setCustomerName(selected.name);
    setCustomerPhone(selected.phone);
    let cancelled = false;
    (async () => {
      try {
        const c = await customersApi.get(selected.id);
        if (!cancelled) setAddresses(c.addresses);
      } catch {
        if (!cancelled) setAddresses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        customerName: customerName.trim() || null,
        customerPhone: customerPhone.trim() || null,
        notes: notes.trim() || null,
      });
    } catch (err) {
      setError(describeError(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title="Müşteri & Not"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}

        <Field label="Müşteri Ara">
          <CustomerSearch
            value={selected}
            onChange={setSelected}
            disabled={busy}
          />
        </Field>

        {addresses.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Kayıtlı Adresler
            </span>
            <ul className="space-y-1.5">
              {addresses.map((a) => (
                <li
                  key={a.id}
                  className="rounded-xl border border-zinc-200 bg-white p-2.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{a.label}</span>
                    {a.isDefault && (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">
                        Varsayılan
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 whitespace-pre-line text-zinc-600 dark:text-zinc-400">
                    {a.addressLine}
                    {a.district ? ` · ${a.district}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Field label="Müşteri Adı">
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            maxLength={200}
            placeholder="Opsiyonel"
            className={INPUT_CLS}
          />
        </Field>

        <Field label="Telefon">
          <input
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            maxLength={50}
            placeholder="0 5xx xxx xx xx"
            className={INPUT_CLS}
          />
        </Field>

        <Field label="Sipariş Notu">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Mutfağa iletilecek özel notlar"
            className={`${INPUT_CLS} h-auto py-2 leading-snug`}
          />
        </Field>
      </div>
    </Modal>
  );
}

const INPUT_CLS =
  "h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-base outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-900";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}
