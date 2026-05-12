"use client";

import { useMemo, useState } from "react";
import { ComboDto, ProductDto, ProductOptionDto } from "@/types/api";
import { Button } from "@/components/ui-v2/button";
import { Badge } from "@/components/ui-v2/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-v2/dialog";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  combo: ComboDto;
  /** Tüm mağaza ürün listesi — combo item productId ile join için. */
  products: ProductDto[];
  onConfirm: (selections: Record<string, string[]>) => Promise<void> | void;
  onClose: () => void;
}

interface RowOption {
  comboItemId: string;
  productName: string;
  quantity: number;
  /** Aktif opsiyonların grup grup organize hali. */
  groups: Array<{
    groupName: string;
    isRequired: boolean;
    options: ProductOptionDto[];
  }>;
}

function buildRows(combo: ComboDto, products: ProductDto[]): RowOption[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  return combo.items
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map<RowOption | null>((ci) => {
      const product = byId.get(ci.productId);
      if (!product) return null;
      const active = product.options.filter((o) => o.isActive);
      if (active.length === 0) return null;
      const groupMap = new Map<
        string,
        { groupName: string; isRequired: boolean; options: ProductOptionDto[] }
      >();
      for (const opt of active) {
        const key = opt.groupName;
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            groupName: opt.groupName,
            isRequired: opt.isRequired,
            options: [],
          });
        }
        const g = groupMap.get(key)!;
        // Bir gruptaki herhangi bir opsiyon required ise grup zorunlu sayılır.
        if (opt.isRequired) g.isRequired = true;
        g.options.push(opt);
      }
      for (const g of groupMap.values()) {
        g.options.sort((a, b) => a.displayOrder - b.displayOrder);
      }
      return {
        comboItemId: ci.id,
        productName: product.name,
        quantity: ci.quantity,
        groups: Array.from(groupMap.values()),
      };
    })
    .filter((r): r is RowOption => r !== null);
}

/**
 * Kasiyer kampanyaya tıkladığında, kampanyadaki opsiyonu olan ürünler için
 * varyant seçimi alır (örn. "Kutu Kola — Büyük"). Sadece opsiyonu OLAN
 * ürünler için satır gösterir. Combo fiyatı sabittir, opsiyonlar bilgi
 * amaçlı (fiş ve mutfak ekranına yansır).
 */
export function ComboOptionsDialog({
  combo,
  products,
  onConfirm,
  onClose,
}: Props) {
  const rows = useMemo(() => buildRows(combo, products), [combo, products]);

  // selections[comboItemId][groupName] = Set<optionId>
  const [selections, setSelections] = useState<
    Record<string, Record<string, Set<string>>>
  >({});
  const [busy, setBusy] = useState(false);

  const toggleOption = (
    comboItemId: string,
    groupName: string,
    optionId: string,
    isRequired: boolean
  ) => {
    setSelections((prev) => {
      const itemSel = { ...(prev[comboItemId] ?? {}) };
      const groupSel = new Set(itemSel[groupName] ?? []);
      if (isRequired) {
        groupSel.clear();
        groupSel.add(optionId);
      } else if (groupSel.has(optionId)) {
        groupSel.delete(optionId);
      } else {
        groupSel.add(optionId);
      }
      itemSel[groupName] = groupSel;
      return { ...prev, [comboItemId]: itemSel };
    });
  };

  const allRequiredAnswered = rows.every((row) =>
    row.groups
      .filter((g) => g.isRequired)
      .every(
        (g) => (selections[row.comboItemId]?.[g.groupName]?.size ?? 0) > 0
      )
  );

  const submit = async () => {
    setBusy(true);
    try {
      const payload: Record<string, string[]> = {};
      for (const row of rows) {
        const itemSel = selections[row.comboItemId] ?? {};
        const flat = Object.values(itemSel).flatMap((s) => Array.from(s));
        if (flat.length > 0) payload[row.comboItemId] = flat;
      }
      await onConfirm(payload);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => (v ? null : onClose())}>
      <DialogContent
        className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden p-0"
        onInteractOutside={(e) => busy && e.preventDefault()}
      >
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <DialogTitle>{combo.name} — Varyant seç</DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <p className="text-sm text-muted-foreground">
            Kampanya fiyatı{" "}
            <span className="font-semibold">{formatCurrency(combo.price)}</span>{" "}
            — varyantlar sadece fiş/mutfak için kaydedilir, ek ücret yansımaz.
          </p>

          {rows.map((row) => (
            <section
              key={row.comboItemId}
              className="rounded-lg border bg-card p-4"
            >
              <header className="mb-3 flex items-center gap-2">
                <Badge variant="secondary">{row.quantity}x</Badge>
                <h3 className="font-semibold">{row.productName}</h3>
              </header>

              <div className="space-y-3">
                {row.groups.map((g) => {
                  const chosen =
                    selections[row.comboItemId]?.[g.groupName] ?? new Set();
                  return (
                    <div key={g.groupName} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium">{g.groupName}</h4>
                        {g.isRequired ? (
                          <Badge variant="destructive">Zorunlu</Badge>
                        ) : (
                          <Badge variant="outline">Opsiyonel</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        {g.options.map((o) => {
                          const active = chosen.has(o.id);
                          return (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() =>
                                toggleOption(
                                  row.comboItemId,
                                  g.groupName,
                                  o.id,
                                  g.isRequired
                                )
                              }
                              className={cn(
                                "min-h-[48px] rounded-md border bg-background px-3 py-2 text-sm transition-colors",
                                "hover:border-primary/60 hover:bg-accent/50",
                                active &&
                                  "border-primary bg-primary/10 font-semibold"
                              )}
                            >
                              <div className="flex flex-col items-start">
                                <span>{o.name}</span>
                                {o.additionalPrice > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{formatCurrency(o.additionalPrice)}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <DialogFooter className="flex-shrink-0 border-t bg-background px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button
            onClick={submit}
            disabled={busy || !allRequiredAnswered}
            size="lg"
          >
            {busy ? "Ekleniyor…" : "Sepete Ekle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Yardımcı: kampanyanın hiç varyant seçimi gerektirip gerektirmediğini söyler.
 * False ise dialog atlanır, kombo doğrudan eklenir.
 */
export function comboNeedsVariants(
  combo: ComboDto,
  products: ProductDto[]
): boolean {
  return buildRows(combo, products).length > 0;
}
