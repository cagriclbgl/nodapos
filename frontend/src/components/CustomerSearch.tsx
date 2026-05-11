"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Users, X } from "lucide-react";
import { customers as customersApi, ApiError } from "@/lib/api";
import { describeError } from "@/lib/use-store-api";
import { formatPhoneForDisplay } from "@/lib/phone-normalize";
import { Button } from "@/components/ui-v2/button";
import { Skeleton } from "@/components/ui-v2/skeleton";
import { EmptyState } from "@/components/ui-v2/empty-state";
import type { CustomerListItemDto } from "@/types/api";

export interface SelectedCustomer {
  id: string;
  name: string;
  phone: string;
}

interface Props {
  /** Currently selected customer (controls the input display). */
  value: SelectedCustomer | null;
  onChange: (next: SelectedCustomer | null) => void;
  /** Disable interactions (used during async submission). */
  disabled?: boolean;
  /** Optional: hide the inline "Yeni Müşteri" creation flow. */
  hideCreate?: boolean;
}

/**
 * Customer picker — açılışta backend'den son N müşteri çekilir (recent-first).
 * Üstte filtre input'u (client-side: ad/telefon partial match). Yeni müşteri
 * butonu tam alan dialog'u açar (Ad + Telefon + Adres + Mahalle + Not).
 *
 * Eski "type-3-chars-then-search" yaklaşımının yerine: kasiyer açılışta ne
 * gördüğünü bilir (son müşteriler), aramaya başlarsa daraltır. Bilgisayar
 * deneyimi olmayan kullanıcı için tahmin edilebilir.
 */
export function CustomerSearch({
  value,
  onChange,
  disabled,
  hideCreate,
}: Props) {
  const [allCustomers, setAllCustomers] = useState<CustomerListItemDto[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);

  // İlk yüklemede son N müşteri (backend recent-first dönüyor).
  useEffect(() => {
    if (value) return; // Seçili müşteri varsa liste yüklemeye gerek yok.
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    customersApi
      .list()
      .then((data) => {
        if (!cancelled) setAllCustomers(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(describeError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  // Client-side filter: 100 müşteriye kadar ölçek için yeterli (backend Take=100).
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return allCustomers;
    return allCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.phone.toLowerCase().includes(term)
    );
  }, [allCustomers, query]);

  const handleSelect = (c: CustomerListItemDto) => {
    onChange({ id: c.id, name: c.name, phone: c.phone });
  };

  const handleCreated = (newCustomer: SelectedCustomer) => {
    // Liste'ye baş'a ekle (recent-first sıralama ile uyumlu).
    setAllCustomers((prev) => [
      {
        id: newCustomer.id,
        name: newCustomer.name,
        phone: newCustomer.phone,
        isActive: true,
        orderCount: 0,
        lastOrderAt: null,
      },
      ...prev,
    ]);
    onChange(newCustomer);
    setDialogOpen(false);
  };

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 dark:border-orange-700 dark:bg-orange-950/40">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{value.name}</p>
          <p className="truncate text-sm text-zinc-500 font-mono">
            {formatPhoneForDisplay(value.phone)}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(null)}
          disabled={disabled}
        >
          <X className="mr-1 h-4 w-4" />
          Değiştir
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-stretch gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={disabled}
              placeholder="Telefon veya isim ile süz..."
              className="h-11 w-full rounded-xl border border-zinc-300 bg-white pl-9 pr-3 text-base outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-900"
              autoComplete="off"
            />
          </div>
          {!hideCreate && (
            <Button
              type="button"
              size="lg"
              onClick={() => setDialogOpen(true)}
              disabled={disabled}
              className="h-11 shrink-0"
            >
              <Plus className="mr-1 h-4 w-4" />
              Yeni Müşteri
            </Button>
          )}
        </div>

        {loadError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            Müşteri listesi yüklenemedi: {loadError}
          </div>
        )}

        <div className="max-h-[26rem] overflow-y-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {loading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            query.trim() ? (
              <EmptyState
                icon={Search}
                title="Eşleşen müşteri yok"
                description={`"${query}" için kayıtlı müşteri bulunamadı. Yeni müşteri ekleyebilirsin.`}
              />
            ) : (
              <EmptyState
                icon={Users}
                title="Henüz müşteri yok"
                description='Sağ üstteki "Yeni Müşteri" butonu ile ilk kaydı oluştur.'
              />
            )
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleSelect(c)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-orange-50 disabled:opacity-50 dark:hover:bg-orange-950/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-medium">{c.name}</p>
                      <p className="truncate text-sm text-zinc-500 font-mono">
                        {formatPhoneForDisplay(c.phone)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        {c.orderCount} sipariş
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {dialogOpen && (
        <NewCustomerDialog
          initialPhone={
            /^[0-9 +()-]+$/.test(query.trim()) ? query.trim() : ""
          }
          onClose={() => setDialogOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}

/**
 * Tam alan modal — Ad + Telefon (zorunlu) + Adres + Mahalle + Not (opsiyonel).
 * Müşteri oluşturulduktan sonra opsiyonel adres CustomerAddress'e default=true
 * olarak kaydedilir (zincirleme istek; adres fail olsa bile müşteri yaratıldı).
 */
function NewCustomerDialog({
  initialPhone,
  onClose,
  onCreated,
}: {
  initialPhone: string;
  onClose: () => void;
  onCreated: (c: SelectedCustomer) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(initialPhone);
  const [addressLine, setAddressLine] = useState("");
  const [district, setDistrict] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && phone.trim().length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const created = await customersApi.create({
        name: name.trim(),
        phone: phone.trim(),
        notes: notes.trim() || null,
      });
      // Adres opsiyonel
      const trimmedAddr = addressLine.trim();
      if (trimmedAddr.length > 0) {
        try {
          await customersApi.addAddress(created.id, {
            label: "Ev",
            addressLine: trimmedAddr,
            district: district.trim() || null,
            notes: null,
            isDefault: true,
          });
        } catch (addrErr) {
          // Adres fail → müşteri yine kaydedildi, devam et.
          console.warn("İlk adres yaratılamadı, müşteri kaydı yine başarılı.", addrErr);
        }
      }
      onCreated({ id: created.id, name: created.name, phone: created.phone });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail || err.message);
      } else {
        setError(String(err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Yeni Müşteri</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800"
            aria-label="Kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Ad Soyad *">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ahmet Yılmaz"
              className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-950"
              autoFocus
            />
          </Field>

          <Field label="Telefon *">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0532 123 45 67"
              className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base font-mono outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </Field>

          <Field label="Adres (opsiyonel)">
            <textarea
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              placeholder="Örn: Atatürk Cad. 12, Daire 4"
              rows={2}
              className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-base outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </Field>

          <Field label="Mahalle / Semt (opsiyonel)">
            <input
              type="text"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="Örn: Bahçelievler"
              className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </Field>

          <Field label="Not (opsiyonel)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Müşteri tercihleri, alerji vb."
              rows={2}
              className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-base outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </Field>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={busy}
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={submit}
            disabled={!canSubmit}
          >
            {busy ? "Kaydediliyor..." : "Müşteri Oluştur"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
