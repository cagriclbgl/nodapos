"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useStoreContext } from "@/lib/store-context";
import { describeError, useStoreApi } from "@/lib/use-store-api";
import {
  CategoryDto,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from "@/types/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

const EMPTY: CreateCategoryRequest = { name: "", description: "", displayOrder: 0 };

export default function CategoriesPage() {
  const { storeId } = useStoreContext();
  const { data, loading, error, refresh } = useStoreApi<CategoryDto[]>(
    "/api/categories"
  );

  const [editing, setEditing] = useState<CategoryDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<CreateCategoryRequest>(EMPTY);
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    const nextOrder =
      (data ?? []).reduce((m, c) => Math.max(m, c.displayOrder), -1) + 1;
    setDraft({ ...EMPTY, displayOrder: nextOrder });
    setIsActive(true);
    setFormError(null);
    setCreating(true);
  };

  const openEdit = (c: CategoryDto) => {
    setEditing(c);
    setDraft({
      name: c.name,
      description: c.description ?? "",
      displayOrder: c.displayOrder,
    });
    setIsActive(c.isActive);
    setFormError(null);
    setCreating(true);
  };

  const closeModal = () => {
    if (busy) return;
    setCreating(false);
    setEditing(null);
  };

  const submit = async () => {
    if (!draft.name.trim()) {
      setFormError("Ad gerekli.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      if (editing) {
        const payload: UpdateCategoryRequest = { ...draft, isActive };
        await api.put(`/api/categories/${editing.id}`, payload, storeId);
      } else {
        await api.post("/api/categories", draft, storeId);
      }
      await refresh();
      closeModal();
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: CategoryDto) => {
    if (!confirm(`"${c.name}" kategorisini silmek istediğine emin misin?`))
      return;
    try {
      await api.delete(`/api/categories/${c.id}`, storeId);
      await refresh();
    } catch (err) {
      alert(describeError(err));
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Kategoriler</h2>
          <p className="text-zinc-500">Menü kategorilerini yönet.</p>
        </div>
        <Button onClick={openCreate}>+ Yeni Kategori</Button>
      </header>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950">
            <tr>
              <th className="px-4 py-2.5">Ad</th>
              <th className="px-4 py-2.5">Açıklama</th>
              <th className="px-4 py-2.5">Sıra</th>
              <th className="px-4 py-2.5">Durum</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  Yükleniyor…
                </td>
              </tr>
            )}
            {!loading && data?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  Henüz kategori yok.
                </td>
              </tr>
            )}
            {data?.map((c) => (
              <tr
                key={c.id}
                className="border-t border-zinc-200 dark:border-zinc-800"
              >
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-zinc-500">
                  {c.description || "—"}
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
        open={creating}
        onClose={closeModal}
        title={editing ? "Kategoriyi Düzenle" : "Yeni Kategori"}
        footer={
          <>
            <Button variant="ghost" onClick={closeModal} disabled={busy}>
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
            value={draft.description ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
          />
          <Input
            label="Sıra"
            type="number"
            value={draft.displayOrder}
            onChange={(e) =>
              setDraft({ ...draft, displayOrder: Number(e.target.value) || 0 })
            }
          />
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
