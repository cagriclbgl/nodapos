"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ApiError, supervisor as supervisorApi } from "@/lib/api";
import type {
  StoreDto,
  SupervisorCreateUserRequest,
  UpdateStoreRequest,
  UpdateUserRequest,
  UserDto,
  UserRole,
} from "@/types/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui-v2/card";
import { Button } from "@/components/ui-v2/button";
import { Badge } from "@/components/ui-v2/badge";
import { Skeleton } from "@/components/ui-v2/skeleton";
import { Input } from "@/components/ui-v2/input";
import { Label } from "@/components/ui-v2/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-v2/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-v2/dialog";
import { formatDateTime } from "@/lib/format";

const ROLE_LABEL: Record<UserRole, string> = {
  Manager: "Yönetici",
  Cashier: "Kasiyer",
};

export function StoreDetail({ storeId }: { storeId: string }) {
  const [store, setStore] = useState<StoreDto | null>(null);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [s, u] = await Promise.all([
        supervisorApi.stores.get(storeId),
        supervisorApi.stores.listUsers(storeId),
      ]);
      setStore(s);
      setUsers(u);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail || err.message : String(err)
      );
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (!store) {
    return (
      <div className="space-y-3">
        <BackLink />
        <p className="text-sm text-destructive">{error ?? "Mağaza bulunamadı."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <BackLink />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{store.name}</h2>
            <p className="text-sm text-muted-foreground">
              {formatDateTime(store.createdAt)} tarihinde oluşturuldu
            </p>
          </div>
          <Badge variant={store.isActive ? "default" : "secondary"}>
            {store.isActive ? "Aktif" : "Pasif"}
          </Badge>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StoreEditCard store={store} onUpdated={refresh} />
        <UsersCard
          storeId={storeId}
          users={users}
          onChanged={refresh}
        />
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/supervisor/stores"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> Mağazalara dön
    </Link>
  );
}

function StoreEditCard({
  store,
  onUpdated,
}: {
  store: StoreDto;
  onUpdated: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<UpdateStoreRequest>({
    name: store.name,
    address: store.address ?? "",
    phone: store.phone ?? "",
    taxNumber: store.taxNumber ?? "",
    isActive: store.isActive,
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!draft.name.trim()) return;
    setSubmitting(true);
    setErr(null);
    try {
      await supervisorApi.stores.update(store.id, {
        ...draft,
        address: draft.address?.toString().trim() || null,
        phone: draft.phone?.toString().trim() || null,
        taxNumber: draft.taxNumber?.toString().trim() || null,
      });
      await onUpdated();
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail || e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mağaza Bilgileri</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="storeName">Ad</Label>
          <Input
            id="storeName"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="storePhone">Telefon</Label>
            <Input
              id="storePhone"
              value={draft.phone ?? ""}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="storeTax">Vergi No</Label>
            <Input
              id="storeTax"
              value={draft.taxNumber ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, taxNumber: e.target.value })
              }
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="storeAddress">Adres</Label>
          <Input
            id="storeAddress"
            value={draft.address ?? ""}
            onChange={(e) => setDraft({ ...draft, address: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(e) =>
              setDraft({ ...draft, isActive: e.target.checked })
            }
            className="h-4 w-4"
          />
          Aktif
        </label>
        {err && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive">
            {err}
          </div>
        )}
        <div>
          <Button onClick={submit} disabled={submitting || !draft.name.trim()}>
            {submitting ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type UserDialogMode =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "reset"; user: UserDto };

function UsersCard({
  storeId,
  users,
  onChanged,
}: {
  storeId: string;
  users: UserDto[];
  onChanged: () => Promise<void>;
}) {
  const [mode, setMode] = useState<UserDialogMode>({ kind: "closed" });

  const toggleActive = async (u: UserDto) => {
    try {
      const payload: UpdateUserRequest = { isActive: !u.isActive };
      await supervisorApi.stores.updateUser(storeId, u.id, payload);
      await onChanged();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail || err.message : String(err));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Kullanıcılar</CardTitle>
        <Button size="sm" onClick={() => setMode({ kind: "create" })}>
          + Yeni Kullanıcı
        </Button>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz kullanıcı yok.</p>
        ) : (
          <ul className="space-y-2">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{u.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.username} · {ROLE_LABEL[u.role]}
                    {u.lastLoginAt
                      ? ` · son giriş ${formatDateTime(u.lastLoginAt)}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={u.isActive ? "default" : "secondary"}>
                    {u.isActive ? "Aktif" : "Pasif"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMode({ kind: "reset", user: u })}
                  >
                    Şifre
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleActive(u)}
                  >
                    {u.isActive ? "Pasifleştir" : "Aktifleştir"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {mode.kind === "create" && (
        <CreateUserDialog
          storeId={storeId}
          onClose={() => setMode({ kind: "closed" })}
          onCreated={async () => {
            setMode({ kind: "closed" });
            await onChanged();
          }}
        />
      )}
      {mode.kind === "reset" && (
        <ResetPasswordDialog
          storeId={storeId}
          user={mode.user}
          onClose={() => setMode({ kind: "closed" })}
        />
      )}
    </Card>
  );
}

function CreateUserDialog({
  storeId,
  onClose,
  onCreated,
}: {
  storeId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<SupervisorCreateUserRequest>({
    username: "",
    fullName: "",
    password: "",
    role: "Cashier",
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!draft.username.trim() || !draft.fullName.trim() || !draft.password) return;
    setSubmitting(true);
    setErr(null);
    try {
      await supervisorApi.stores.createUser(storeId, {
        ...draft,
        username: draft.username.trim(),
        fullName: draft.fullName.trim(),
      });
      await onCreated();
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail || e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni Kullanıcı</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="newFullName">Ad Soyad</Label>
            <Input
              id="newFullName"
              value={draft.fullName}
              onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="newUsername">Kullanıcı Adı</Label>
              <Input
                id="newUsername"
                value={draft.username}
                onChange={(e) => setDraft({ ...draft, username: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">Şifre</Label>
              <Input
                id="newPassword"
                type="text"
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                placeholder="min 6 karakter"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newRole">Rol</Label>
            <Select
              value={draft.role}
              onValueChange={(v) => setDraft({ ...draft, role: v as UserRole })}
            >
              <SelectTrigger id="newRole">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Manager">Yönetici</SelectItem>
                <SelectItem value="Cashier">Kasiyer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {err && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive">
              {err}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Vazgeç
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Oluşturuluyor..." : "Oluştur"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  storeId,
  user,
  onClose,
}: {
  storeId: string;
  user: UserDto;
  onClose: () => void;
}) {
  const [pw, setPw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (pw.length < 6) {
      setErr("Şifre en az 6 karakter olmalı.");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      await supervisorApi.stores.resetUserPassword(storeId, user.id, {
        newPassword: pw,
      });
      setDone(true);
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail || e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Şifre Sıfırla — {user.fullName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="resetPw">Yeni Şifre</Label>
            <Input
              id="resetPw"
              type="text"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="min 6 karakter"
            />
          </div>
          {err && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive">
              {err}
            </div>
          )}
          {done && (
            <div className="rounded-md border border-primary/30 bg-primary/10 p-2.5 text-sm">
              Şifre güncellendi. Bu pencereyi kapatabilirsiniz.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Kapat
          </Button>
          {!done && (
            <Button onClick={submit} disabled={submitting || pw.length < 6}>
              {submitting ? "Güncelleniyor..." : "Şifreyi Sıfırla"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
