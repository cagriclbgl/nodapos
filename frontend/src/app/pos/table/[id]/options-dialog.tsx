"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/format";
import { AddOrderItemRequest, ProductDto, ProductOptionDto } from "@/types/api";

interface Props {
  product: ProductDto;
  onClose: () => void;
  onConfirm: (line: AddOrderItemRequest) => Promise<void>;
}

/**
 * Common cashier shortcuts for kitchen-facing notes. Tap toggles the chip
 * on/off in the per-line note. Order is intentionally short so the chip row
 * stays single-line on a tablet portrait.
 */
const NOTE_PRESETS = [
  "Az pişsin",
  "Çıtır",
  "Acılı",
  "Soğansız",
  "Bol peynir",
  "Mantarsız",
];

/** Append `preset` if missing, or remove the existing occurrence. */
function toggleNotePreset(current: string, preset: string): string {
  const trimmed = current.trim();
  // Match "preset" surrounded by start/end or comma boundaries (case-sensitive).
  const escaped = preset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|,\\s*)${escaped}(?=,|$)`, "i");
  if (re.test(trimmed)) {
    const next = trimmed
      .replace(re, "")
      .replace(/^\s*,\s*/, "")
      .replace(/,\s*,/g, ", ")
      .trim();
    return next;
  }
  return trimmed.length === 0 ? preset : `${trimmed}, ${preset}`;
}

function noteHasPreset(current: string, preset: string): boolean {
  const escaped = preset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|,\\s*)${escaped}(?=,|$)`, "i").test(current.trim());
}

/**
 * Required option groups behave as radio buttons (exactly one must be picked).
 * Optional groups behave as checkboxes (zero-or-many). The aggregate selection
 * + quantity + per-line note is sent to the parent which forwards it to the
 * backend (which snapshots option name/price into OrderItemOption).
 */
export function OptionsDialog({ product, onClose, onConfirm }: Props) {
  const groups = useMemo(() => groupOptions(product.options), [product]);

  // Pre-select the first option of each required group so the user can
  // confirm in one tap when the defaults are fine.
  const initialSelected = useMemo(() => {
    const sel: Record<string, string[]> = {};
    for (const g of groups) {
      if (g.isRequired && g.options.length > 0) sel[g.name] = [g.options[0].id];
      else sel[g.name] = [];
    }
    return sel;
  }, [groups]);

  const [selected, setSelected] = useState<Record<string, string[]>>(initialSelected);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (group: string, optionId: string, single: boolean) => {
    setSelected((prev) => {
      const cur = prev[group] ?? [];
      if (single) return { ...prev, [group]: [optionId] };
      return cur.includes(optionId)
        ? { ...prev, [group]: cur.filter((id) => id !== optionId) }
        : { ...prev, [group]: [...cur, optionId] };
    });
  };

  const allOptionIds = Object.values(selected).flat();
  const optionExtra = product.options
    .filter((o) => allOptionIds.includes(o.id))
    .reduce((s, o) => s + o.additionalPrice, 0);
  const lineTotal = (product.price + optionExtra) * quantity;

  const submit = async () => {
    // Validate: every required group must have a selection.
    const missing = groups.find(
      (g) => g.isRequired && (selected[g.name]?.length ?? 0) === 0
    );
    if (missing) {
      setError(`"${missing.name}" grubundan bir seçim yapmalısın.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm({
        productId: product.id,
        quantity,
        notes: notes.trim() || null,
        productOptionIds: allOptionIds,
      });
    } catch {
      // Parent shows toast/error; keep dialog open on failure.
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={product.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button onClick={submit} disabled={busy} size="lg">
            {busy ? "Ekleniyor…" : `Ekle · ${formatCurrency(lineTotal)}`}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && (
          <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}

        {groups.length === 0 ? (
          <p className="text-sm text-zinc-500">Seçenek yok.</p>
        ) : (
          groups.map((g) => (
            <div key={g.name}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                {g.name}
                {g.isRequired ? (
                  <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                    zorunlu
                  </span>
                ) : null}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {g.options.map((o) => {
                  const isSelected = selected[g.name]?.includes(o.id) ?? false;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggle(g.name, o.id, g.isRequired)}
                      className={
                        isSelected
                          ? "rounded-xl border-2 border-orange-500 bg-orange-50 p-3 text-left dark:bg-orange-950/30"
                          : "rounded-xl border-2 border-zinc-200 bg-white p-3 text-left hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                      }
                    >
                      <p className="font-medium">{o.name}</p>
                      {o.additionalPrice > 0 && (
                        <p className="mt-0.5 text-xs text-zinc-500">
                          +{formatCurrency(o.additionalPrice)}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}

        <div>
          <h3 className="mb-2 text-sm font-semibold">Adet</h3>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
            >
              −
            </Button>
            <span className="min-w-10 text-center text-2xl font-semibold tabular-nums">
              {quantity}
            </span>
            <Button
              variant="secondary"
              onClick={() => setQuantity((q) => q + 1)}
            >
              +
            </Button>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Not (opsiyonel)</h3>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {NOTE_PRESETS.map((p) => {
              const active = noteHasPreset(notes, p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setNotes((cur) => toggleNotePreset(cur, p))}
                  className={
                    active
                      ? "rounded-full bg-orange-600 px-3 py-1 text-xs font-semibold text-white"
                      : "rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:border-orange-400 hover:bg-orange-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-orange-500 dark:hover:bg-orange-950/30"
                  }
                >
                  {p}
                </button>
              );
            })}
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Örn. acılı olsun, sucuksuz vs."
            rows={2}
            className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>
    </Modal>
  );
}

interface Group {
  name: string;
  isRequired: boolean;
  options: ProductOptionDto[];
}

function groupOptions(opts: ProductOptionDto[]): Group[] {
  const map = new Map<string, Group>();
  for (const o of opts) {
    if (!o.isActive) continue;
    const existing = map.get(o.groupName);
    if (existing) {
      existing.options.push(o);
      // A group is "required" if any option in it is marked required.
      existing.isRequired = existing.isRequired || o.isRequired;
    } else {
      map.set(o.groupName, {
        name: o.groupName,
        isRequired: o.isRequired,
        options: [o],
      });
    }
  }
  for (const g of map.values()) {
    g.options.sort((a, b) => a.displayOrder - b.displayOrder);
  }
  return Array.from(map.values());
}
