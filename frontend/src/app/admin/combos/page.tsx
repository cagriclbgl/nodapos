"use client";

import { useState } from "react";
import { combos as combosApi } from "@/lib/api";
import { describeError, useStoreApi } from "@/lib/use-store-api";
import {
  CategoryDto,
  ComboDto,
  CreateComboItemRequest,
  CreateComboRequest,
  UpdateComboRequest,
} from "@/types/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/format";

interface DraftItem {
  label: string;
  categoryId: string;
  quantity: number;
  displayOrder: number;
}

const EMPTY_ITEM: DraftItem = {
  label: "",
  categoryId: "",
  quantity: 1,
  displayOrder: 0,
};

interface Draft {
  name: string;
  description: string;
  price: number;
  displayOrder: number;
  items: DraftItem[];
}

const EMPTY: Draft = {
  name: "",
  description: "",
  price: 0,
  displayOrder: 0,
  items: [],
};

export default function CombosPage() {
  const combos = useStoreApi<ComboDto[]>("/api/combos");
  const cats = useStoreApi<CategoryDto[]>("/api/categories");

  const [editing, setEditing] = useState<ComboDto | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    const nextOrder =
      (combos.data ?? []).reduce((m, c) => Math.max(m, c.displayOrder), -1) + 1;
    setDraft({ ...EMPTY, displayOrder: nextOrder });
    setIsActive(true);
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (c: ComboDto) => {
    setEditing(c);
    setDraft({
      name: c.name,
      description: c.description ?? "",
      price: c.price,
      displayOrder: c.displayOrder,
      items: c.items.map((i) => ({
        label: i.label,
        categoryId: i.categoryId,
        quantity: i.quantity,
        displayOrder: i.displayOrder,
      })),
    });
    setIsActive(c.isActive);
    setFormError(null);
    setOpen(true);
  };

  const close = () => {
    if (busy) return;
    setOpen(false);
    setEditing(null);
  };

  const submit = async () => {
    if (!draft.name.trim()) {
      setFormError("Ad gerekli.");
      return;
    }
    if (draft.price < 0) {
      setFormError("Fiyat negatif olamaz.");
      return;
    }
    if (draft.items.length === 0) {
      setFormError("En az bir slot ekle.");
      return;
    }
    if (draft.items.some((i) => !i.label.trim() || !i.categoryId)) {
      setFormError("Tüm slot'lar için etiket ve kategori seçili olmalı.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const itemsPayload: CreateComboItemRequest[] = draft.items.map((i) => ({
        label: i.label.trim(),
        categoryId: i.categoryId,
        quantity: Math.max(1, i.quantity),
        displayOrder: i.displayOrder,
      }));
      if (editing) {
        const payload: UpdateComboRequest = {
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          price: draft.price,
          isActive,
          displayOrder: draft.displayOrder,
          items: itemsPayload,
        };
        await combosApi.update(editing.id, payload);
      } else {
        const payload: CreateComboRequest = {
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          price: draft.price,
          displayOrder: draft.displayOrder,
          items: itemsPayload,
        };
        await combosApi.create(payload);
      }
      await combos.refresh();
      close();
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: ComboDto) => {
    if (!confirm(`"${c.name}" kombosunu silmek istiyor musun?`)) return;
    try {
      await combosApi.remove(c.id);
      await combos.refresh();
    } catch (err) {
      alert(describeError(err));
    }
  };

  const addSlot = () => {
    const nextOrder =
      draft.items.reduce((m, i) => Math.max(m, i.displayOrder), -1) + 1;
    setDraft({
      ...draft,
      items: [
        ...draft.items,
        { ...EMPTY_ITEM, displayOrder: nextOrder },
      ],
    });
  };

  const updateSlot = (idx: number, patch: Partial<DraftItem>) => {
    setDraft({
      ...draft,
      items: draft.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    });
  };

  const removeSlot = (idx: number) => {
    setDraft({
      ...draft,
      items: draft.items.filter((_, i) => i !== idx),
    });
  };

  const categoryOptions = (cats.data ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }));

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Kampanyalar</h2>
          <p className="text-zinc-500">
            Sabit fiyatlı paket menüler — ör. &quot;2 orta pizza + 1 büyük
            içecek&quot;.
          </p>
        </div>
        <Button onClick={openCreate}>+ Yeni Kampanya</Button>
      </header>

      {(combos.error || cats.error) && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {combos.error || cats.error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950">
            <tr>
              <th className="px-4 py-2.5">Ad</th>
              <th className="px-4 py-2.5">Slot Sayısı</th>
              <th className="px-4 py-2.5">Fiyat</th>
              <th className="px-4 py-2.5">Sıra</th>
              <th className="px-4 py-2.5">Durum</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {combos.loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  Yükleniyor…
                </td>
              </tr>
            )}
            {!combos.loading && combos.data?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  Henüz kampanya yok.
                </td>
              </tr>
            )}
            {combos.data?.map((c) => (
              <tr
                key={c.id}
                className="border-t border-zinc-200 dark:border-zinc-800"
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{c.name}</div>
                  {c.description && (
                    <div className="text-xs text-zinc-500">{c.description}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-500">{c.items.length}</td>
                <td className="px-4 py-3 font-mono">
                  {formatCurrency(c.price)}
                </td>
                <td className="px-4 py-3 text-zinc-500">{c.displayOrder}</td>
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
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                    Düzenle
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(c)}>
                    Sil
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={close}
        title={editing ? "Kampanyayı Düzenle" : "Yeni Kampanya"}
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>
              Vazgeç
            </Button>
            <Button onClick={submit} disabled={busy}>
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
            label="Ad"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            required
          />
          <Input
            label="Açıklama"
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Fiyat (₺)"
              type="number"
              step="0.01"
              min="0"
              value={draft.price}
              onChange={(e) =>
                setDraft({ ...draft, price: Number(e.target.value) || 0 })
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

          <div className="border-t pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Slot'lar</h3>
              <Button size="sm" variant="ghost" onClick={addSlot}>
                + Slot ekle
              </Button>
            </div>
            <p className="mb-3 text-xs text-zinc-500">
              Her slot için kasiyerin seçim yapacağı kategori ve adet.
            </p>
            {draft.items.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-sm text-zinc-500">
                Henüz slot yok.
              </p>
            ) : (
              <div className="space-y-2">
                {draft.items.map((it, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 rounded-lg border p-2"
                  >
                    <div className="col-span-4">
                      <Input
                        placeholder="Etiket (örn. 1. Pizza)"
                        value={it.label}
                        onChange={(e) =>
                          updateSlot(idx, { label: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-span-4">
                      <Select
                        value={it.categoryId}
                        onChange={(e) =>
                          updateSlot(idx, { categoryId: e.target.value })
                        }
                      >
                        <option value="">Kategori seç…</option>
                        {categoryOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="1"
                        value={it.quantity}
                        title="Adet"
                        onChange={(e) =>
                          updateSlot(idx, {
                            quantity: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                      />
                    </div>
                    <div className="col-span-2 flex items-center justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeSlot(idx)}
                      >
                        Sil
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {editing && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm">Aktif</span>
            </label>
          )}
        </div>
      </Modal>
    </div>
  );
}
