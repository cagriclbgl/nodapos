"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, supervisor as supervisorApi } from "@/lib/api";
import type {
  StoreRegistrationRequestDto,
  StoreRegistrationStatus,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-v2/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui-v2/tabs";
import { formatShortDate } from "@/lib/format";

export default function RegistrationsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<StoreRegistrationStatus>("Pending");
  const [items, setItems] = useState<StoreRegistrationRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [approveTarget, setApproveTarget] =
    useState<StoreRegistrationRequestDto | null>(null);
  const [rejectTarget, setRejectTarget] =
    useState<StoreRegistrationRequestDto | null>(null);

  const load = async (status: StoreRegistrationStatus) => {
    setLoading(true);
    setError(null);
    try {
      const list = await supervisorApi.registrations.list(status);
      setItems(list);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail || err.message : String(err)
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(tab);
  }, [tab]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Başvurular</h2>
        <p className="text-sm text-muted-foreground">
          Restoran sahiplerinin gönderdiği kayıt talepleri.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as StoreRegistrationStatus)}>
        <TabsList>
          <TabsTrigger value="Pending">Bekleyen</TabsTrigger>
          <TabsTrigger value="Approved">Onaylanmış</TabsTrigger>
          <TabsTrigger value="Rejected">Reddedilmiş</TabsTrigger>
        </TabsList>
      </Tabs>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Bu kategoride başvuru yok.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {items.map((r) => (
            <Card key={r.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="text-lg">{r.storeName}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {r.contactName} · {r.phone}
                    {r.email ? ` · ${r.email}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={r.status} />
                  <span className="text-xs text-muted-foreground">
                    {formatShortDate(r.createdAt)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {r.address && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Adres: </span>
                    {r.address}
                  </div>
                )}
                {r.notes && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Not: </span>
                    {r.notes}
                  </div>
                )}
                {r.rejectionReason && (
                  <div className="text-sm text-destructive">
                    Red sebebi: {r.rejectionReason}
                  </div>
                )}
                {r.createdStoreId && (
                  <div className="text-sm">
                    <a
                      href={`/supervisor/stores/${r.createdStoreId}`}
                      className="text-primary hover:underline"
                    >
                      Oluşturulan mağazayı aç →
                    </a>
                  </div>
                )}
                {r.status === "Pending" && (
                  <div className="flex gap-2 pt-2">
                    <Button onClick={() => setApproveTarget(r)}>Onayla</Button>
                    <Button
                      variant="outline"
                      onClick={() => setRejectTarget(r)}
                    >
                      Reddet
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {approveTarget && (
        <ApproveDialog
          target={approveTarget}
          onClose={() => setApproveTarget(null)}
          onApproved={() => {
            void load(tab);
          }}
          onDismiss={(storeId) => {
            setApproveTarget(null);
            if (storeId) router.push(`/supervisor/stores/${storeId}`);
          }}
        />
      )}

      {rejectTarget && (
        <RejectDialog
          target={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onRejected={() => {
            setRejectTarget(null);
            void load(tab);
          }}
        />
      )}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: StoreRegistrationStatus;
}) {
  if (status === "Pending") return <Badge variant="secondary">Bekliyor</Badge>;
  if (status === "Approved") return <Badge>Onaylandı</Badge>;
  return <Badge variant="destructive">Reddedildi</Badge>;
}

function generatePassword(length = 10): string {
  // Karışık ama okunaklı (0/O/1/l hariç) — operatör elle yazsa da yanlış okumasın.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  if (typeof window === "undefined" || !window.crypto?.getRandomValues) {
    let out = "";
    for (let i = 0; i < length; i++)
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
  }
  const buf = new Uint32Array(length);
  window.crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}

function suggestUsername(storeName: string): string {
  const slug = storeName
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 12);
  return slug ? `${slug}_mgr` : "manager";
}

function ApproveDialog({
  target,
  onClose,
  onApproved,
  onDismiss,
}: {
  target: StoreRegistrationRequestDto;
  onClose: () => void;
  onApproved: () => void;
  onDismiss: (storeId: string | null) => void;
}) {
  const [storeNameOverride, setStoreNameOverride] = useState(target.storeName);
  const [address, setAddress] = useState(target.address ?? "");
  const [phone, setPhone] = useState(target.phone);
  const [managerUsername, setManagerUsername] = useState(
    suggestUsername(target.storeName)
  );
  const [managerPassword, setManagerPassword] = useState(() =>
    generatePassword()
  );
  const [managerFullName, setManagerFullName] = useState(target.contactName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Onay sonrası özet — credential'ları kapatmadan önce supervisor'a göster.
  const [created, setCreated] = useState<{
    storeId: string;
    storeName: string;
    username: string;
    password: string;
  } | null>(null);

  const submit = async () => {
    if (!managerUsername || !managerPassword || !managerFullName) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await supervisorApi.registrations.approve(target.id, {
        storeNameOverride: storeNameOverride.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        managerUsername: managerUsername.trim(),
        managerPassword,
        managerFullName: managerFullName.trim(),
      });
      setCreated({
        storeId: res.storeId,
        storeName: storeNameOverride.trim() || target.storeName,
        username: managerUsername.trim(),
        password: managerPassword,
      });
      onApproved();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail || err.message : String(err)
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (created) {
    return (
      <Dialog open onOpenChange={(o) => !o && onDismiss(created.storeId)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Hesap Oluşturuldu</DialogTitle>
            <DialogDescription>
              Aşağıdaki bilgileri restoran sahibine iletin. Şifre bir daha
              gösterilmez.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="text-muted-foreground">Mağaza</div>
              <div className="font-medium">{created.storeName}</div>
            </div>
            <CredentialRow label="Kullanıcı Adı" value={created.username} />
            <CredentialRow label="Şifre" value={created.password} mono />
            <CredentialRow
              label="Giriş URL'si"
              value="https://nodapos.com/login"
            />
            <Button
              variant="outline"
              type="button"
              className="w-full"
              onClick={() => {
                const text =
                  `Mağaza: ${created.storeName}\n` +
                  `Kullanıcı Adı: ${created.username}\n` +
                  `Şifre: ${created.password}\n` +
                  `Giriş: https://nodapos.com/login`;
                void navigator.clipboard?.writeText(text);
              }}
            >
              Tümünü Panoya Kopyala
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => onDismiss(created.storeId)}>
              Mağaza Sayfasına Git
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Başvuruyu Onayla</DialogTitle>
          <DialogDescription>
            Mağaza ve ilk yönetici hesabı oluşturulacak.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="storeNameOverride">Mağaza Adı</Label>
            <Input
              id="storeNameOverride"
              value={storeNameOverride}
              onChange={(e) => setStoreNameOverride(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Adres</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </div>
          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-medium">İlk Yönetici Hesabı</p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="mgrFullName">Ad Soyad *</Label>
                <Input
                  id="mgrFullName"
                  value={managerFullName}
                  onChange={(e) => setManagerFullName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="mgrUsername">Kullanıcı Adı *</Label>
                  <Input
                    id="mgrUsername"
                    value={managerUsername}
                    onChange={(e) => setManagerUsername(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mgrPassword">Şifre *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="mgrPassword"
                      type="text"
                      value={managerPassword}
                      onChange={(e) => setManagerPassword(e.target.value)}
                      placeholder="min 6 karakter"
                      autoComplete="off"
                      className="font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setManagerPassword(generatePassword())}
                      title="Yeni şifre üret"
                    >
                      ↻
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Onayladıktan sonra kullanıcı adı + şifre tekrar gösterilecek;
                kopyalayıp restoran sahibine iletebilirsin.
              </p>
            </div>
          </div>
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Vazgeç
          </Button>
          <Button
            onClick={submit}
            disabled={
              submitting ||
              !managerUsername ||
              !managerPassword ||
              !managerFullName
            }
          >
            {submitting ? "Oluşturuluyor..." : "Onayla & Oluştur"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CredentialRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border bg-muted/40 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-muted-foreground">{label}</div>
          <div
            className={`font-medium break-all ${mono ? "font-mono" : ""}`}
          >
            {value}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void navigator.clipboard?.writeText(value)}
        >
          Kopyala
        </Button>
      </div>
    </div>
  );
}

function RejectDialog({
  target,
  onClose,
  onRejected,
}: {
  target: StoreRegistrationRequestDto;
  onClose: () => void;
  onRejected: () => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await supervisorApi.registrations.reject(target.id, {
        reason: reason.trim() || null,
      });
      onRejected();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail || err.message : String(err)
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Başvuruyu Reddet</DialogTitle>
          <DialogDescription>{target.storeName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="reason">Sebep (opsiyonel)</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Vazgeç
          </Button>
          <Button variant="destructive" onClick={submit} disabled={submitting}>
            {submitting ? "Gönderiliyor..." : "Reddet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
