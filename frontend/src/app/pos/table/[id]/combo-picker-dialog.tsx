"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui-v2/button";
import { Badge } from "@/components/ui-v2/badge";
import {
  ComboDto,
  ComboSlotSelection,
  ProductDto,
} from "@/types/api";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  combo: ComboDto;
  products: ProductDto[];
  onClose: () => void;
  onConfirm: (selections: ComboSlotSelection[]) => Promise<void>;
}

/**
 * Slot bazlı seçim diyaloğu. Her slot için kategori filtresinden gerekli adet
 * kadar ürün seçilir; aynı ürün birden fazla kez seçilebilir (toplama bağlı —
 * 2 orta pizza için aynı pizza iki kez işaretlenebilir).
 */
export function ComboPickerDialog({
  combo,
  products,
  onClose,
  onConfirm,
}: Props) {
  const [selections, setSelections] = useState<Record<string, string[]>>(
    () => Object.fromEntries(combo.items.map((s) => [s.id, []]))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productsByCategory = useMemo(() => {
    const map: Record<string, ProductDto[]> = {};
    for (const p of products) {
      if (!p.isAvailable) continue;
      (map[p.categoryId] ??= []).push(p);
    }
    return map;
  }, [products]);

  const allFilled = combo.items.every(
    (s) => (selections[s.id]?.length ?? 0) === s.quantity
  );

  const togglePick = (slotId: string, slot: ComboDto["items"][number], productId: string) => {
    setSelections((prev) => {
      const current = prev[slotId] ?? [];
      const targetCount = slot.quantity;
      // Tek ürünlü slot: tek-seçim radio davranışı.
      if (targetCount === 1) {
        return { ...prev, [slotId]: current[0] === productId ? [] : [productId] };
      }
      // Çok ürünlü slot: tıklandıkça ekle, doluysa en eski seçimi kaldır.
      const next = [...current, productId];
      while (next.length > targetCount) next.shift();
      return { ...prev, [slotId]: next };
    });
  };

  const submit = async () => {
    if (!allFilled) {
      setError("Tüm slot'lar için seçim yapmalısın.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload: ComboSlotSelection[] = combo.items.map((s) => ({
        comboItemId: s.id,
        productIds: selections[s.id] ?? [],
      }));
      await onConfirm(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={`${combo.name} · ${formatCurrency(combo.price)}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button onClick={submit} disabled={busy || !allFilled}>
            {busy ? "Ekleniyor…" : "Sepete Ekle"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {combo.description && (
          <p className="text-sm text-muted-foreground">{combo.description}</p>
        )}
        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive">
            {error}
          </p>
        )}

        {combo.items
          .slice()
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((slot) => {
            const slotProducts = productsByCategory[slot.categoryId] ?? [];
            const picks = selections[slot.id] ?? [];
            const remaining = slot.quantity - picks.length;
            return (
              <section key={slot.id} className="space-y-2">
                <header className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">
                      {slot.label}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({slot.categoryName})
                      </span>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {slot.quantity} adet seç
                    </p>
                  </div>
                  <Badge variant={remaining === 0 ? "default" : "secondary"}>
                    {picks.length} / {slot.quantity}
                  </Badge>
                </header>
                {slotProducts.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                    Bu kategoride satışta ürün yok.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {slotProducts.map((p) => {
                      const count = picks.filter((id) => id === p.id).length;
                      const active = count > 0;
                      return (
                        <button
                          key={p.id}
                          onClick={() => togglePick(slot.id, slot, p.id)}
                          className={cn(
                            "rounded-lg border p-2 text-left transition-colors",
                            active
                              ? "border-primary bg-primary/10"
                              : "hover:border-primary/40 hover:bg-accent"
                          )}
                        >
                          <p className="text-sm font-medium leading-tight">
                            {p.name}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {formatCurrency(p.price)}
                          </p>
                          {count > 1 && (
                            <span className="mt-1 inline-block rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                              ×{count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
      </div>
    </Modal>
  );
}
