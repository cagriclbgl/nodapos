"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useStoreContext } from "@/lib/store-context";
import { describeError, useStoreApi } from "@/lib/use-store-api";
import {
  CreateTableRequest,
  TableDto,
  TableStatus,
  UpdateTableRequest,
} from "@/types/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";

const EMPTY: CreateTableRequest = { name: "", capacity: 4, displayOrder: 0 };

const STATUS_LABEL: Record<TableStatus, string> = {
  Empty: "Boş",
  Occupied: "Dolu",
  AwaitingPayment: "Ödeme Bekliyor",
};

const STATUS_BADGE: Record<TableStatus, string> = {
  Empty:
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  Occupied:
    "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  AwaitingPayment:
    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

export default function TablesPage() {
  const { storeId } = useStoreContext();
  const { data, loading, error, refresh } =
    useStoreApi<TableDto[]>("/api/tables");

  const [editing, setEditing] = useState<TableDto | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CreateTableRequest>(EMPTY);
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    const nextOrder =
      (data ?? []).reduce((m, t) => Math.max(m, t.displayOrder), -1) + 1;
    setDraft({ ...EMPTY, displayOrder: nextOrder });
    setIsActive(true);
    setFormError(null);
    setOpen(true);
  };

  const openEdit = (t: TableDto) => {
    setEditing(t);
    setDraft({
      name: t.name,
      capacity: t.capacity,
      displayOrder: t.displayOrder,
    });
    setIsActive(t.isActive);
    setFormError(null);
    setOpen(true);
  };

  const submit = async () => {
    if (!draft.name.trim()) {
      setFormError("Masa adı gerekli.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      if (editing) {
        const payload: UpdateTableRequest = { ...draft, isActive };
        await api.put(`/api/tables/${editing.id}`, payload, storeId);
      } else {
        await api.post("/api/tables", draft, storeId);
      }
      await refresh();
      setOpen(false);
      setEditing(null);
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: TableDto) => {
    if (!confirm(`"${t.name}" masasını silmek istediğine emin misin?`))
      return;
    try {
      await api.delete(`/api/tables/${t.id}`, storeId);
      await refresh();
    } catch (err) {
      alert(describeError(err));
    }
  };

  const setStatus = async (t: TableDto, status: TableStatus) => {
    try {
      await api.patch(`/api/tables/${t.id}/status`, { status }, storeId);
      await refresh();
    } catch (err) {
      alert(describeError(err));
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Masalar</h2>
          <p className="text-zinc-500">Masaları, kapasiteleri ve durumlarını yönet.</p>
        </div>
        <Button onClick={openCreate}>+ Yeni Masa</Button>
      </header>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-zinc-500">Yükleniyor…</p>
      ) : data?.length === 0 ? (
        <p className="text-zinc-500">Henüz masa yok.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {data?.map((t) => (
            <div
              key={t.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-semibold">{t.name}</p>
                  <p className="text-xs text-zinc-500">
                    {t.capacity} kişilik
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[t.status]}`}
                >
                  {STATUS_LABEL[t.status]}
                </span>
              </div>

              <div className="mt-3">
                <Select
                  value={t.status}
                  onChange={(e) =>
                    setStatus(t, e.target.value as TableStatus)
                  }
                  className="h-9 text-sm"
                >
                  <option value="Empty">Boş</option>
                  <option value="Occupied">Dolu</option>
                  <option value="AwaitingPayment">Ödeme Bekliyor</option>
                </Select>
              </div>

              <div className="mt-3 flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openEdit(t)}
                >
                  Düzenle
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(t)}
                >
                  Sil
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={editing ? "Masayı Düzenle" : "Yeni Masa"}
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
          <Input
            label="Ad"
            placeholder="Örn. Masa 1"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <Input
            label="Kapasite"
            type="number"
            min={1}
            value={draft.capacity}
            onChange={(e) =>
              setDraft({
                ...draft,
                capacity: Math.max(1, Number(e.target.value) || 1),
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
