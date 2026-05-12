"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Cloud, CloudOff, RefreshCw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui-v2/badge";
import { Button } from "@/components/ui-v2/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-v2/card";
import { Separator } from "@/components/ui-v2/separator";
import { Skeleton } from "@/components/ui-v2/skeleton";
import { useStoreApi } from "@/lib/use-store-api";
import { formatDateTime } from "@/lib/format";

interface SyncStatusDto {
  config: {
    enabled: boolean;
    cloudBaseUrl: string | null;
    hasHmacSecret: boolean;
    pollingSeconds: number;
    batchSize: number;
  };
  outbox: {
    pendingCount: number;
    failingCount: number;
    giveUpCount: number;
    sentLast24h: number;
    oldestPendingAt: string | null;
    lastSentAt: string | null;
    lastFailure: {
      eventType: string;
      lastError: string;
      lastAttemptAt: string;
      retryCount: number;
    } | null;
  };
}

/**
 * Kasa → cloud sync teşhis paneli. 10sn'de bir GET /api/sync/status sorgulayıp
 * SyncWorker'ın config + outbox state'ini gösterir. Senkronizasyon başarısızsa
 * (config eksik, HMAC mismatch, network) kasanın main.log'unu açmadan görelim.
 */
export default function SyncSettingsPage() {
  const status = useStoreApi<SyncStatusDto>("/api/sync/status");
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!autoRefresh) return;
    const iv = window.setInterval(() => void status.refresh(), 10_000);
    return () => window.clearInterval(iv);
  }, [autoRefresh, status]);

  const d = status.data;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Senkronizasyon</h2>
          <p className="text-sm text-muted-foreground">
            Kasanın bulutla buluşma durumu. Sipariş/müşteri kayıtları{" "}
            <code>outbox_events</code> tablosuna düşer; SyncWorker 10 saniyede bir
            bulut API'sine gönderir.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            10sn'de bir yenile
          </label>
          <Button variant="outline" size="sm" onClick={() => void status.refresh()}>
            <RefreshCw /> Yenile
          </Button>
        </div>
      </header>

      {status.error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Durum alınamadı: {status.error}
        </p>
      )}

      {status.loading && !d ? (
        <Skeleton className="h-48 rounded-2xl" />
      ) : d ? (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Yapılandırma</CardTitle>
              {d.config.enabled && d.config.cloudBaseUrl && d.config.hasHmacSecret ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600">
                  <Cloud className="h-3.5 w-3.5" /> Aktif
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <CloudOff className="h-3.5 w-3.5" /> Pasif
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row
                label="Sync etkin"
                value={d.config.enabled ? "Evet" : "Hayır"}
                ok={d.config.enabled}
              />
              <Row
                label="Cloud URL"
                value={d.config.cloudBaseUrl ?? "(boş)"}
                ok={!!d.config.cloudBaseUrl}
                mono
              />
              <Row
                label="HMAC secret"
                value={d.config.hasHmacSecret ? "kuruldu" : "yok"}
                ok={d.config.hasHmacSecret}
              />
              <Separator />
              <Row label="Push aralığı" value={`${d.config.pollingSeconds} sn`} />
              <Row label="Toplu boyut" value={`${d.config.batchSize} kayıt`} />
              {(!d.config.enabled || !d.config.cloudBaseUrl || !d.config.hasHmacSecret) && (
                <p className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-900 dark:border-yellow-700/40 dark:bg-yellow-900/20 dark:text-yellow-200">
                  Sync devre dışı. Bu kasa eski installer'la kurulmuş olabilir —
                  v0.1.12+ installer'ı yükleyin (config.ts gömülü). Halen
                  düzelmezse Hetzner taraf <code>Sync__HmacSecret</code> env
                  var'ını kontrol edin.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <KpiCard
              icon={d.outbox.pendingCount === 0 ? CheckCircle2 : AlertTriangle}
              tone={d.outbox.pendingCount === 0 ? "ok" : "warn"}
              label="Bekleyen olay"
              value={String(d.outbox.pendingCount)}
              sub={
                d.outbox.oldestPendingAt
                  ? `En eski: ${formatDateTime(d.outbox.oldestPendingAt)}`
                  : "kuyruk boş"
              }
            />
            <KpiCard
              icon={d.outbox.failingCount === 0 ? CheckCircle2 : XCircle}
              tone={d.outbox.failingCount === 0 ? "ok" : "error"}
              label="Hatalı olay"
              value={String(d.outbox.failingCount)}
              sub={
                d.outbox.giveUpCount > 0
                  ? `${d.outbox.giveUpCount} adet 10 retry sonrası bırakıldı`
                  : "retry'da"
              }
            />
            <KpiCard
              icon={Cloud}
              tone="info"
              label="Son 24 saatte iletildi"
              value={String(d.outbox.sentLast24h)}
              sub={
                d.outbox.lastSentAt
                  ? `Son iletim: ${formatDateTime(d.outbox.lastSentAt)}`
                  : "henüz iletim yok"
              }
            />
          </div>

          {d.outbox.lastFailure && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-destructive">
                  Son Hata
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Event" value={d.outbox.lastFailure.eventType} mono />
                <Row
                  label="Deneme"
                  value={`${d.outbox.lastFailure.retryCount}/10`}
                />
                <Row
                  label="Tarih"
                  value={formatDateTime(d.outbox.lastFailure.lastAttemptAt)}
                />
                <Separator />
                <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                  {d.outbox.lastFailure.lastError}
                </pre>
                <p className="text-xs text-muted-foreground">
                  HTTP 401: HMAC secret kasa ↔ bulut farklı. HTTP 503: bulutta{" "}
                  <code>Sync__HmacSecret</code> set edilmemiş. Connection timeout:
                  network erişimi yok veya <code>api.nodapos.com</code> DNS
                  çözülmüyor.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  ok,
  mono,
}: {
  label: string;
  value: string;
  ok?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          (mono ? "font-mono " : "") +
          (ok === false ? "text-destructive font-semibold" : "")
        }
      >
        {value}
      </span>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "ok" | "warn" | "error" | "info";
  label: string;
  value: string;
  sub?: string;
}) {
  const toneClass = {
    ok: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30",
    warn: "border-yellow-300 bg-yellow-50 dark:border-yellow-700/40 dark:bg-yellow-900/20",
    error: "border-destructive/40 bg-destructive/5",
    info: "",
  }[tone];

  const iconClass = {
    ok: "text-emerald-600",
    warn: "text-yellow-600",
    error: "text-destructive",
    info: "text-muted-foreground",
  }[tone];

  return (
    <div className={`rounded-2xl border bg-card p-5 ${toneClass}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <Icon className={`h-4 w-4 ${iconClass}`} />
      </div>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
