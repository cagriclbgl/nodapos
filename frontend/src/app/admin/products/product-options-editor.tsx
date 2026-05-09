"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useStoreContext } from "@/lib/store-context";
import { describeError } from "@/lib/use-store-api";
import { formatCurrency } from "@/lib/format";
import {
  CreateProductOptionRequest,
  ProductDto,
  ProductOptionDto,
} from "@/types/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

const EMPTY: CreateProductOptionRequest = {
  groupName: "",
  name: "",
  additionalPrice: 0,
  isRequired: false,
  displayOrder: 0,
};

interface Props {
  product: ProductDto;
  onClose: () => void;
  onChanged: () => void;
}

/**
 * Inline manager for a product's option list (Boyut, Kenar, Ekstra, …).
 * Each mutation calls the backend immediately and asks the parent to refetch
 * the product list so option counts stay in sync.
 */
export function ProductOptionsEditor({ product, onClose, onChanged }: Props) {
  const { storeId } = useStoreContext();

  // Local optimistic copy of the option list — refreshed after each mutation
  // by re-fetching the parent product. Could be replaced with SWR/React Query
  // later for finer cache control.
  const [options, setOptions] = useState<ProductOptionDto[]>(product.options);
  const [draft, setDraft] = useState<CreateProductOptionRequest>({
    ...EMPTY,
    displayOrder: nextDisplayOrder(product.options),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    try {
      const fresh = await api.get<ProductDto>(
        `/api/products/${product.id}`,
        storeId
      );
      setOptions(fresh.options);
      // Bump the next displayOrder default so the user can keep adding without
      // re-typing it every time.
      setDraft((d) => ({ ...d, displayOrder: nextDisplayOrder(fresh.options) }));
      onChanged();
    } catch (err) {
      setError(describeError(err));
    }
  };

  const add = async () => {
    if (!draft.groupName.trim() || !draft.name.trim()) {
      setError("Grup ve seçenek adı gerekli.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post(
        `/api/products/${product.id}/options`,
        draft,
        storeId
      );
      // Preserve groupName so adding e.g. multiple "Boyut" options is fast;
      // only reset name/price/required. The reload below will set the next
      // displayOrder.
      setDraft((d) => ({
        ...EMPTY,
        groupName: d.groupName,
      }));
      await reload();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (opt: ProductOptionDto) => {
    if (!confirm(`"${opt.name}" seçeneğini silmek istediğine emin misin?`))
      return;
    try {
      await api.delete(`/api/products/options/${opt.id}`, storeId);
      await reload();
    } catch (err) {
      alert(describeError(err));
    }
  };

  // Group options by GroupName for display.
  const grouped = options.reduce<Record<string, ProductOptionDto[]>>(
    (acc, o) => {
      (acc[o.groupName] ??= []).push(o);
      return acc;
    },
    {}
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={`${product.name} — Seçenekler`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Kapat
        </Button>
      }
    >
      <div className="space-y-5">
        {error && (
          <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        )}

        {Object.keys(grouped).length === 0 ? (
          <p className="text-sm text-zinc-500">Henüz seçenek yok.</p>
        ) : (
          Object.entries(grouped).map(([group, opts]) => (
            <div key={group}>
              <h3 className="mb-1.5 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                {group}
              </h3>
              <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {opts.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{o.name}</p>
                      <p className="text-xs text-zinc-500">
                        +{formatCurrency(o.additionalPrice)}
                        {o.isRequired ? " · zorunlu" : ""}
                        {!o.isActive ? " · pasif" : ""}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => remove(o)}>
                      Sil
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}

        <div className="rounded-xl border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
          <h3 className="mb-3 text-sm font-semibold">Yeni Seçenek</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Grup"
              placeholder="Boyut / Kenar / Ekstra"
              value={draft.groupName}
              onChange={(e) =>
                setDraft({ ...draft, groupName: e.target.value })
              }
            />
            <Input
              label="Seçenek Adı"
              placeholder="Büyük / Mozzarella…"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <Input
              label="Ek Fiyat"
              type="number"
              step="0.01"
              value={draft.additionalPrice}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  additionalPrice: Number(e.target.value) || 0,
                })
              }
            />
            <Input
              label="Sıra"
              type="number"
              value={draft.displayOrder}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  displayOrder: Number(e.target.value) || 0,
                })
              }
            />
          </div>
          <label className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.isRequired}
              onChange={(e) =>
                setDraft({ ...draft, isRequired: e.target.checked })
              }
              className="h-4 w-4"
            />
            <span className="text-sm">Zorunlu seçim</span>
          </label>
          <div className="mt-3 flex justify-end">
            <Button onClick={add} disabled={busy}>
              {busy ? "Ekleniyor…" : "Seçenek Ekle"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function nextDisplayOrder(opts: ProductOptionDto[]): number {
  return opts.reduce((m, o) => Math.max(m, o.displayOrder), -1) + 1;
}
