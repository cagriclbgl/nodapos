"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/format";
import {
  CompleteOrderRequest,
  OrderDto,
  PaymentLineRequest,
  PaymentMethod,
} from "@/types/api";

const CASH_PRESETS = [50, 100, 200, 500];

interface Props {
  order: OrderDto;
  onClose: () => void;
  onSubmit: (req: CompleteOrderRequest) => Promise<void>;
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  Cash: "Nakit",
  CreditCard: "Kredi Kartı",
  DebitCard: "Banka Kartı",
  MealCard: "Yemek Kartı",
  Other: "Diğer",
};

const METHOD_ORDER: PaymentMethod[] = [
  "Cash",
  "CreditCard",
  "DebitCard",
  "MealCard",
  "Other",
];

interface DraftLine {
  amount: string; // string for input control; parsed before send
  method: PaymentMethod;
  referenceNumber: string;
}

const blankLine = (amount: number): DraftLine => ({
  amount: amount > 0 ? amount.toFixed(2) : "",
  method: "Cash",
  referenceNumber: "",
});

/**
 * Splits a single order across one or more PaymentLineRequest entries and
 * submits them as the body of POST /orders/{id}/complete. Backend enforces
 * Σ amount >= Order.Total atomically; insufficient input returns 400 and the
 * dialog stays open with the server error.
 */
export function PaymentDialog({ order, onClose, onSubmit }: Props) {
  const [lines, setLines] = useState<DraftLine[]>([blankLine(order.total)]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (idx: number, patch: Partial<DraftLine>) =>
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...patch } : l))
    );

  const remove = (idx: number) =>
    setLines((prev) => prev.filter((_, i) => i !== idx));

  const addLine = () => setLines((prev) => [...prev, blankLine(0)]);

  const total = lines.reduce(
    (s, l) => s + (Number.parseFloat(l.amount) || 0),
    0
  );
  const remaining = order.total - total;
  const change = total - order.total;

  const applyPreset = (idx: number, amount: number) => {
    update(idx, { amount: amount.toFixed(2), method: "Cash" });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!busy) void submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, lines]);

  const submit = async () => {
    const parsed: PaymentLineRequest[] = [];
    for (const l of lines) {
      const amt = Number.parseFloat(l.amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        setError("Her ödeme satırı için pozitif bir tutar gir.");
        return;
      }
      parsed.push({
        amount: amt,
        method: l.method,
        referenceNumber: l.referenceNumber.trim() || null,
        notes: null,
      });
    }
    if (total < order.total - 0.001) {
      setError(
        `Toplam ödeme yetersiz. Eksik: ${formatCurrency(order.total - total)}`
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ payments: parsed });
      // Parent will navigate away; no further state needed.
    } catch (err: unknown) {
      // Parent re-throws so we can keep the dialog open on backend failures
      // (e.g. concurrent modification, validation).
      setError(
        err instanceof Error
          ? err.message
          : typeof err === "object" && err && "detail" in err
            ? String((err as { detail: unknown }).detail)
            : "Ödeme tamamlanamadı."
      );
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title="Ödemeyi Al"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button
            onClick={submit}
            disabled={busy}
            size="lg"
            variant={remaining > 0.001 ? "secondary" : "primary"}
          >
            {busy ? "Tamamlanıyor…" : "Tamamla"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-950">
          <div className="flex justify-between text-sm">
            <span>Sipariş Toplamı</span>
            <span className="font-mono">{formatCurrency(order.total)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Alınan</span>
            <span className="font-mono">{formatCurrency(total)}</span>
          </div>
          <div
            className={`mt-1 flex justify-between border-t border-zinc-200 pt-1 text-base font-semibold dark:border-zinc-800 ${remaining > 0.001 ? "text-amber-700 dark:text-amber-400" : change > 0.001 ? "text-blue-700 dark:text-blue-400" : "text-green-700 dark:text-green-400"}`}
          >
            <span>
              {remaining > 0.001
                ? "Eksik"
                : change > 0.001
                  ? "Para Üstü"
                  : "Yeterli"}
            </span>
            <span className="font-mono">
              {remaining > 0.001
                ? formatCurrency(remaining)
                : change > 0.001
                  ? formatCurrency(change)
                  : formatCurrency(0)}
            </span>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="space-y-3">
          {lines.map((l, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Tutar
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={l.amount}
                    onChange={(e) => update(idx, { amount: e.target.value })}
                    className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-base outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Yöntem
                  </span>
                  <select
                    value={l.method}
                    onChange={(e) =>
                      update(idx, { method: e.target.value as PaymentMethod })
                    }
                    className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-base outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {METHOD_ORDER.map((m) => (
                      <option key={m} value={m}>
                        {METHOD_LABEL[m]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {(l.method === "CreditCard" ||
                l.method === "DebitCard" ||
                l.method === "MealCard") && (
                <label className="mt-2 flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Referans No (opsiyonel)
                  </span>
                  <input
                    type="text"
                    value={l.referenceNumber}
                    onChange={(e) =>
                      update(idx, { referenceNumber: e.target.value })
                    }
                    className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-base outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </label>
              )}

              {lines.length > 1 && (
                <div className="mt-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(idx)}
                  >
                    Bu satırı sil
                  </Button>
                </div>
              )}
            </div>
          ))}

          {lines.length === 1 && lines[0].method === "Cash" && (
            <div className="flex flex-wrap gap-2">
              <span className="self-center text-xs font-medium text-zinc-500">
                Hızlı:
              </span>
              {CASH_PRESETS.filter((p) => p >= order.total).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyPreset(0, p)}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:border-orange-400 hover:bg-orange-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-orange-500 dark:hover:bg-orange-950/30"
                >
                  {p} ₺
                </button>
              ))}
              {remaining > 0.001 && (
                <button
                  type="button"
                  onClick={() => applyPreset(0, order.total)}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:border-orange-400 hover:bg-orange-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-orange-500 dark:hover:bg-orange-950/30"
                >
                  Tam tutar
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={addLine}>
              + Bölünmüş ödeme
            </Button>
            <span className="ml-auto self-center text-xs text-zinc-400">
              ⌘/Ctrl + Enter ile tamamla
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
