"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useStoreContext } from "@/lib/store-context";
import { describeError, useStoreApi } from "@/lib/use-store-api";
import { formatCurrency } from "@/lib/format";
import {
  CategoryDto,
  CreateProductRequest,
  ProductDto,
  UpdateProductRequest,
} from "@/types/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { ProductOptionsEditor } from "./product-options-editor";

const EMPTY: CreateProductRequest = {
  categoryId: "",
  name: "",
  description: "",
  price: 0,
  imageUrl: "",
  displayOrder: 0,
};

export default function ProductsPage() {
  const { storeId } = useStoreContext();

  const products = useStoreApi<ProductDto[]>("/api/products");
  const categories = useStoreApi<CategoryDto[]>("/api/categories");

  const [filterCat, setFilterCat] = useState<string>("");

  const [editing, setEditing] = useState<ProductDto | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CreateProductRequest>(EMPTY);
  const [isAvailable, setIsAvailable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [optionsFor, setOptionsFor] = useState<ProductDto | null>(null);

  const openCreate = () => {
    setEditing(null);
    // Default to whatever category the user is currently filtering by; only
    // fall back to the first category when the filter is "Tümü". This avoids
    // the surprise of opening "Yeni Ürün" while filtered to "İçecek" and
    // finding the dialog pre-selected on "Yiyecek".
    const defaultCat = filterCat || categories.data?.[0]?.id || "";
    const scope = (products.data ?? []).filter(
      (p) => !defaultCat || p.categoryId === defaultCat
    );
    const nextOrder =
      scope.reduce((m, p) => Math.max(m, p.displayOrder), -1) + 1;
    setDraft({
      ...EMPTY,
      categoryId: defaultCat,
      displayOrder: nextOrder,
    });
    setIsAvailable(true);
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (p: ProductDto) => {
    setEditing(p);
    setDraft({
      categoryId: p.categoryId,
      name: p.name,
      description: p.description ?? "",
      price: p.price,
      imageUrl: p.imageUrl ?? "",
      displayOrder: p.displayOrder,
    });
    setIsAvailable(p.isAvailable);
    setFormError(null);
    setOpen(true);
  };

  const submit = async () => {
    if (!draft.name.trim()) return setFormError("Ürün adı gerekli.");
    if (!draft.categoryId) return setFormError("Kategori seç.");
    if (draft.price < 0) return setFormError("Fiyat negatif olamaz.");

    setBusy(true);
    setFormError(null);
    try {
      if (editing) {
        const payload: UpdateProductRequest = { ...draft, isAvailable };
        await api.put(`/api/products/${editing.id}`, payload, storeId);
      } else {
        await api.post("/api/products", draft, storeId);
      }
      await products.refresh();
      setOpen(false);
      setEditing(null);
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: ProductDto) => {
    if (!confirm(`"${p.name}" ürününü silmek istediğine emin misin?`)) return;
    try {
      await api.delete(`/api/products/${p.id}`, storeId);
      await products.refresh();
    } catch (err) {
      alert(describeError(err));
    }
  };

  const visible = (products.data ?? []).filter(
    (p) => !filterCat || p.categoryId === filterCat
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Ürünler</h2>
          <p className="text-zinc-500">
            Menü ürünlerini, fiyatlarını ve seçenekleri yönet.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <Select
            label="Kategori"
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="min-w-44"
          >
            <option value="">Tümü</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button
            onClick={openCreate}
            disabled={(categories.data ?? []).length === 0}
          >
            + Yeni Ürün
          </Button>
        </div>
      </header>

      {(categories.data ?? []).length === 0 && !categories.loading && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          Önce en az bir kategori eklemen gerekiyor.
        </p>
      )}

      {(products.error || categories.error) && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {products.error || categories.error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950">
            <tr>
              <th className="px-4 py-2.5">Ürün</th>
              <th className="px-4 py-2.5">Kategori</th>
              <th className="px-4 py-2.5">Fiyat</th>
              <th className="px-4 py-2.5">Seçenek</th>
              <th className="px-4 py-2.5">Durum</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {products.loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  Yükleniyor…
                </td>
              </tr>
            )}
            {!products.loading && visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  Ürün yok.
                </td>
              </tr>
            )}
            {visible.map((p) => (
              <tr
                key={p.id}
                className="border-t border-zinc-200 dark:border-zinc-800"
              >
                <td className="px-4 py-3">
                  <p className="font-medium">{p.name}</p>
                  {p.description && (
                    <p className="text-xs text-zinc-500">{p.description}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-500">{p.categoryName}</td>
                <td className="px-4 py-3 font-mono">
                  {formatCurrency(p.price)}
                </td>
                <td className="px-4 py-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setOptionsFor(p)}
                  >
                    {p.options.length} seçenek
                  </Button>
                </td>
                <td className="px-4 py-3">
                  {p.isAvailable ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                      Satışta
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      Pasif
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                    Düzenle
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p)}>
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
        onClose={() => !busy && setOpen(false)}
        title={editing ? "Ürünü Düzenle" : "Yeni Ürün"}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
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
          <Select
            label="Kategori"
            value={draft.categoryId}
            onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
          >
            <option value="">Seç…</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input
            label="Ad"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <Input
            label="Açıklama"
            value={draft.description ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
          />
          <Input
            label="Fiyat (TL)"
            type="number"
            step="0.01"
            min={0}
            value={draft.price}
            onChange={(e) =>
              setDraft({ ...draft, price: Number(e.target.value) || 0 })
            }
          />
          <Input
            label="Görsel URL"
            value={draft.imageUrl ?? ""}
            onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
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
          {editing && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm">Satışta</span>
            </label>
          )}
        </div>
      </Modal>

      {optionsFor && (
        <ProductOptionsEditor
          product={optionsFor}
          onClose={() => setOptionsFor(null)}
          onChanged={() => products.refresh()}
        />
      )}
    </div>
  );
}
