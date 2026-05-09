"use client";

import { useEffect, useRef, useState } from "react";
import { customers as customersApi, ApiError } from "@/lib/api";
import { describeError } from "@/lib/use-store-api";
import type {
  CreateCustomerRequest,
  CustomerListItemDto,
} from "@/types/api";

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
 * Phone/name typeahead that hits `GET /api/customers?search=...` after a
 * 250ms debounce. Renders a suggestion list and a "Yeni Müşteri" inline form
 * that creates a record (then auto-selects it) without leaving the dialog.
 *
 * The component aborts in-flight requests on each keystroke so a slow
 * response can never overwrite a fresher query.
 */
export function CustomerSearch({
  value,
  onChange,
  disabled,
  hideCreate,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerListItemDto[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Yeni Müşteri" inline form state.
  const [creating, setCreating] = useState(false);
  const [newDraft, setNewDraft] = useState<CreateCustomerRequest>({
    name: "",
    phone: "",
    notes: null,
  });
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Debounced search.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setSearching(false);
      // Don't fire an API call yet, but keep the dropdown reactive to focus.
      return;
    }
    setSearching(true);
    setError(null);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const handle = window.setTimeout(async () => {
      try {
        const data = await customersApi.list(
          { search: trimmed },
          ctrl.signal
        );
        if (!ctrl.signal.aborted) {
          setResults(data);
          setSearching(false);
        }
      } catch (err) {
        if (ctrl.signal.aborted) return;
        // Aborts surface as DOMException("AbortError") on some runtimes.
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof ApiError ? err.detail || err.message : String(err)
        );
        setSearching(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(handle);
      ctrl.abort();
    };
  }, [query]);

  // Close suggestions on outside-click.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const select = (c: CustomerListItemDto) => {
    onChange({ id: c.id, name: c.name, phone: c.phone });
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setQuery("");
    setResults([]);
  };

  const startCreate = () => {
    setNewDraft({
      // Pre-fill phone if user typed digits.
      name: "",
      phone: /^[0-9 +()-]+$/.test(query.trim()) ? query.trim() : "",
      notes: null,
    });
    setCreateError(null);
    setCreating(true);
  };

  const submitCreate = async () => {
    if (!newDraft.name.trim() || !newDraft.phone.trim()) {
      setCreateError("Ad ve telefon zorunlu.");
      return;
    }
    setCreateBusy(true);
    setCreateError(null);
    try {
      const created = await customersApi.create({
        name: newDraft.name.trim(),
        phone: newDraft.phone.trim(),
        notes: newDraft.notes?.trim() || null,
      });
      onChange({ id: created.id, name: created.name, phone: created.phone });
      setCreating(false);
      setQuery("");
      setResults([]);
      setOpen(false);
    } catch (err) {
      setCreateError(describeError(err));
    } finally {
      setCreateBusy(false);
    }
  };

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-orange-300 bg-orange-50 px-3 py-2 dark:border-orange-700 dark:bg-orange-950/40">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{value.name}</p>
          <p className="truncate text-xs text-zinc-500">{value.phone}</p>
        </div>
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          className="ml-2 rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800"
        >
          Değiştir
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        disabled={disabled}
        placeholder="Telefon veya isim ara…"
        className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-base outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
        autoComplete="off"
      />

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          {error && (
            <p className="p-2 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          {query.trim().length < 3 && !creating && (
            <p className="p-3 text-xs text-zinc-500">
              Aramaya başlamak için en az 3 karakter gir.
            </p>
          )}
          {query.trim().length >= 3 && searching && (
            <p className="p-3 text-xs text-zinc-500">Aranıyor…</p>
          )}
          {query.trim().length >= 3 && !searching && results.length === 0 && (
            <p className="p-3 text-xs text-zinc-500">Eşleşen müşteri yok.</p>
          )}
          {results.length > 0 && (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => select(c)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-orange-50 dark:hover:bg-orange-950/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="truncate text-xs text-zinc-500">
                        {c.phone}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-[10px] uppercase tracking-wide text-zinc-400">
                      {c.orderCount} sipariş
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!hideCreate && !creating && (
            <button
              type="button"
              onClick={startCreate}
              className="block w-full border-t border-zinc-100 px-3 py-2 text-left text-sm font-semibold text-orange-600 hover:bg-orange-50 dark:border-zinc-800 dark:text-orange-400 dark:hover:bg-orange-950/30"
            >
              + Yeni Müşteri
            </button>
          )}
          {creating && (
            <div className="space-y-2 border-t border-zinc-100 p-3 dark:border-zinc-800">
              {createError && (
                <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  {createError}
                </p>
              )}
              <input
                type="text"
                value={newDraft.name}
                onChange={(e) =>
                  setNewDraft({ ...newDraft, name: e.target.value })
                }
                placeholder="Ad Soyad"
                className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-950"
              />
              <input
                type="tel"
                value={newDraft.phone}
                onChange={(e) =>
                  setNewDraft({ ...newDraft, phone: e.target.value })
                }
                placeholder="Telefon"
                className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-950"
              />
              <textarea
                value={newDraft.notes ?? ""}
                onChange={(e) =>
                  setNewDraft({
                    ...newDraft,
                    notes: e.target.value || null,
                  })
                }
                placeholder="Not (opsiyonel)"
                rows={2}
                className="w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-950"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  disabled={createBusy}
                  className="flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={submitCreate}
                  disabled={createBusy}
                  className="flex-1 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:bg-orange-400"
                >
                  {createBusy ? "Kaydediliyor…" : "Müşteri Oluştur"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
