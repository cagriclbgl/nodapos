"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, users as usersApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { describeError } from "@/lib/use-store-api";
import { formatDateTime } from "@/lib/format";
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UserDto,
  UserRole,
} from "@/types/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";

const ROLE_LABEL: Record<UserRole, string> = {
  Manager: "Yönetici",
  Cashier: "Kasiyer",
};

const EMPTY_CREATE: CreateUserRequest = {
  username: "",
  fullName: "",
  password: "",
  role: "Cashier",
};

type Mode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; user: UserDto }
  | { kind: "reset"; user: UserDto };

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>({ kind: "closed" });
  const [createDraft, setCreateDraft] =
    useState<CreateUserRequest>(EMPTY_CREATE);
  const [editDraft, setEditDraft] = useState<{
    fullName: string;
    role: UserRole;
    isActive: boolean;
  }>({ fullName: "", role: "Cashier", isActive: true });
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await usersApi.list());
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail || err.message : String(err)
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openCreate = () => {
    setCreateDraft(EMPTY_CREATE);
    setFormError(null);
    setMode({ kind: "create" });
  };

  const openEdit = (u: UserDto) => {
    setEditDraft({
      fullName: u.fullName,
      role: u.role,
      isActive: u.isActive,
    });
    setFormError(null);
    setMode({ kind: "edit", user: u });
  };

  const openReset = (u: UserDto) => {
    setNewPassword("");
    setFormError(null);
    setMode({ kind: "reset", user: u });
  };

  const close = () => {
    if (busy) return;
    setMode({ kind: "closed" });
  };

  const submitCreate = async () => {
    if (
      !createDraft.username.trim() ||
      !createDraft.fullName.trim() ||
      !createDraft.password
    ) {
      setFormError("Tüm alanlar zorunludur.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await usersApi.create(createDraft);
      await refresh();
      setMode({ kind: "closed" });
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const submitEdit = async () => {
    if (mode.kind !== "edit") return;
    if (!editDraft.fullName.trim()) {
      setFormError("Ad Soyad zorunludur.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const payload: UpdateUserRequest = {
        fullName: editDraft.fullName,
        role: editDraft.role,
        isActive: editDraft.isActive,
      };
      await usersApi.update(mode.user.id, payload);
      await refresh();
      setMode({ kind: "closed" });
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async () => {
    if (mode.kind !== "reset") return;
    if (!newPassword || newPassword.length < 4) {
      setFormError("Şifre en az 4 karakter olmalı.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await usersApi.resetPassword(mode.user.id, { newPassword });
      setMode({ kind: "closed" });
    } catch (err) {
      setFormError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (u: UserDto) => {
    if (currentUser && u.id === currentUser.id) {
      alert("Kendi hesabınızı silemezsiniz.");
      return;
    }
    if (
      !confirm(
        `"${u.fullName}" kullanıcısını silmek istediğine emin misin?`
      )
    )
      return;
    try {
      await usersApi.remove(u.id);
      await refresh();
    } catch (err) {
      alert(describeError(err));
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Kullanıcılar</h2>
          <p className="text-zinc-500">
            Mağazanızda yönetici ve kasiyer hesaplarını düzenleyin.
          </p>
        </div>
        <Button onClick={openCreate}>+ Kullanıcı Ekle</Button>
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
              <th className="px-4 py-2.5">Kullanıcı Adı</th>
              <th className="px-4 py-2.5">Rol</th>
              <th className="px-4 py-2.5">Durum</th>
              <th className="px-4 py-2.5">Son Giriş</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  Yükleniyor…
                </td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  Henüz kullanıcı yok.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-t border-zinc-200 dark:border-zinc-800"
              >
                <td className="px-4 py-3 font-medium">
                  {u.fullName}
                  {currentUser?.id === u.id && (
                    <span className="ml-2 text-xs text-zinc-400">(siz)</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                  {u.username}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      u.role === "Manager"
                        ? "rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-950/60 dark:text-orange-300"
                        : "rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    }
                  >
                    {ROLE_LABEL[u.role]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.isActive ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
                      Aktif
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      Pasif
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(u)}>
                    Düzenle
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openReset(u)}
                  >
                    Şifre Sıfırla
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(u)}>
                    Sil
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      <Modal
        open={mode.kind === "create"}
        onClose={close}
        title="Yeni Kullanıcı"
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>
              Vazgeç
            </Button>
            <Button onClick={submitCreate} disabled={busy}>
              {busy ? "Kaydediliyor…" : "Oluştur"}
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
            label="Ad Soyad"
            value={createDraft.fullName}
            onChange={(e) =>
              setCreateDraft({ ...createDraft, fullName: e.target.value })
            }
            required
          />
          <Input
            label="Kullanıcı Adı"
            autoComplete="off"
            value={createDraft.username}
            onChange={(e) =>
              setCreateDraft({ ...createDraft, username: e.target.value })
            }
            required
          />
          <Input
            label="Şifre"
            type="password"
            autoComplete="new-password"
            value={createDraft.password}
            onChange={(e) =>
              setCreateDraft({ ...createDraft, password: e.target.value })
            }
            required
          />
          <Select
            label="Rol"
            value={createDraft.role}
            onChange={(e) =>
              setCreateDraft({
                ...createDraft,
                role: e.target.value as UserRole,
              })
            }
          >
            <option value="Cashier">Kasiyer</option>
            <option value="Manager">Yönetici</option>
          </Select>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={mode.kind === "edit"}
        onClose={close}
        title={
          mode.kind === "edit"
            ? `${mode.user.fullName} — Düzenle`
            : "Kullanıcıyı Düzenle"
        }
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>
              Vazgeç
            </Button>
            <Button onClick={submitEdit} disabled={busy}>
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
            label="Ad Soyad"
            value={editDraft.fullName}
            onChange={(e) =>
              setEditDraft({ ...editDraft, fullName: e.target.value })
            }
            required
          />
          <Select
            label="Rol"
            value={editDraft.role}
            onChange={(e) =>
              setEditDraft({
                ...editDraft,
                role: e.target.value as UserRole,
              })
            }
          >
            <option value="Cashier">Kasiyer</option>
            <option value="Manager">Yönetici</option>
          </Select>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={editDraft.isActive}
              onChange={(e) =>
                setEditDraft({ ...editDraft, isActive: e.target.checked })
              }
              className="h-4 w-4"
            />
            <span className="text-sm">Aktif</span>
          </label>
        </div>
      </Modal>

      {/* Reset password modal */}
      <Modal
        open={mode.kind === "reset"}
        onClose={close}
        title={
          mode.kind === "reset"
            ? `${mode.user.fullName} — Şifre Sıfırla`
            : "Şifre Sıfırla"
        }
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>
              Vazgeç
            </Button>
            <Button onClick={submitReset} disabled={busy}>
              {busy ? "Kaydediliyor…" : "Şifreyi Güncelle"}
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
            label="Yeni Şifre"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <p className="text-xs text-zinc-500">
            Kullanıcı bir sonraki girişte bu şifreyi kullanacak.
          </p>
        </div>
      </Modal>
    </div>
  );
}
