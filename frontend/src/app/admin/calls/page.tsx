"use client";

import { useEffect, useMemo, useState } from "react";
import { Phone, PhoneIncoming, PhoneMissed, TrendingUp } from "lucide-react";
import { incomingCalls } from "@/lib/api";
import { describeError } from "@/lib/use-store-api";
import { useStoreContext } from "@/lib/store-context";
import {
  formatDateTime,
  startOfDayDaysAgoIso,
  endOfDayIso,
} from "@/lib/format";
import { formatPhoneForDisplay } from "@/lib/phone-normalize";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-v2/card";
import { Badge } from "@/components/ui-v2/badge";
import { Button } from "@/components/ui-v2/button";
import { Skeleton } from "@/components/ui-v2/skeleton";
import { EmptyState } from "@/components/ui-v2/empty-state";
import type { IncomingCallDto, IncomingCallStatus } from "@/types/api";

const STATUS_LABEL: Record<IncomingCallStatus, string> = {
  New: "Yeni",
  Handled: "İlgilenildi",
  Missed: "Cevapsız",
  Ignored: "Yoksayıldı",
};

const RANGE_OPTIONS = [
  { key: "today", label: "Bugün", daysAgo: 0 },
  { key: "7d", label: "Son 7 gün", daysAgo: 6 },
  { key: "30d", label: "Son 30 gün", daysAgo: 29 },
] as const;

/**
 * Yönetici panelinde çağrı analitiği. Kasa outbox üzerinden cloud'a senkron
 * olur, gecikme 10-30sn (kullanıcı tercihi). Filtreler:
 *   - Tarih aralığı (bugün / 7gün / 30gün)
 *   - Status
 * KPI kartları: toplam, ilgilenilen, cevapsız, çözüm oranı, en sık arayan top 5.
 */
export default function AdminCallsPage() {
  const { storeId } = useStoreContext();
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]["key"]>("today");
  const [calls, setCalls] = useState<IncomingCallDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useMemo(
    () => async () => {
      if (!storeId) return;
      const opt = RANGE_OPTIONS.find((r) => r.key === range)!;
      setLoading(true);
      setError(null);
      try {
        const data = await incomingCalls.list({
          from: startOfDayDaysAgoIso(opt.daysAgo),
          to: endOfDayIso(),
          limit: 500,
        });
        setCalls(data);
      } catch (err) {
        setError(describeError(err));
      } finally {
        setLoading(false);
      }
    },
    [storeId, range]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    const total = calls.length;
    const handled = calls.filter((c) => c.status === "Handled").length;
    const missed = calls.filter((c) => c.status === "Missed").length;
    const newOnes = calls.filter((c) => c.status === "New").length;
    const resolutionRate = total === 0 ? 0 : Math.round((handled / total) * 100);

    // En sık arayan top 5 (telefonla group).
    const byPhone = new Map<string, { name: string; count: number }>();
    for (const c of calls) {
      const key = c.phone ?? "(bilinmeyen)";
      const cur = byPhone.get(key) ?? {
        name: c.matchedCustomer?.name ?? "Bilinmeyen",
        count: 0,
      };
      cur.count++;
      byPhone.set(key, cur);
    }
    const topCallers = [...byPhone.entries()]
      .map(([phone, v]) => ({ phone, name: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { total, handled, missed, newOnes, resolutionRate, topCallers };
  }, [calls]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Çağrı Takibi</h2>
          <p className="text-sm text-muted-foreground">
            Caller ID kutusundan gelen aramaların özeti.
          </p>
        </div>
        <div className="flex gap-1">
          {RANGE_OPTIONS.map((r) => (
            <Button
              key={r.key}
              size="sm"
              variant={range === r.key ? "default" : "outline"}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* KPI kartları */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          title="Toplam çağrı"
          icon={Phone}
          value={stats.total}
          loading={loading}
        />
        <KpiCard
          title="İlgilenildi"
          icon={PhoneIncoming}
          value={stats.handled}
          loading={loading}
        />
        <KpiCard
          title="Cevapsız"
          icon={PhoneMissed}
          value={stats.missed}
          loading={loading}
        />
        <KpiCard
          title="Çözüm oranı"
          icon={TrendingUp}
          value={`${stats.resolutionRate}%`}
          loading={loading}
        />
      </div>

      {/* En sık arayan müşteriler */}
      <Card>
        <CardHeader>
          <CardTitle>En sık arayanlar</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-24" />
          ) : stats.topCallers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Veri yok.</p>
          ) : (
            <ul className="divide-y">
              {stats.topCallers.map((c) => (
                <li
                  key={c.phone}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{c.name}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {formatPhoneForDisplay(c.phone)}
                    </span>
                  </span>
                  <Badge variant="secondary">{c.count} kez</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Tüm çağrıların listesi */}
      <Card>
        <CardHeader>
          <CardTitle>Çağrı geçmişi</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-md" />
              ))}
            </div>
          ) : calls.length === 0 ? (
            <EmptyState
              icon={Phone}
              title="Bu aralıkta çağrı yok"
              description="Filtre değiştirmeyi veya aralığı genişletmeyi deneyin."
            />
          ) : (
            <ul className="divide-y">
              {calls.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium">
                      {c.matchedCustomer?.name ?? "Bilinmeyen"}
                    </span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {formatPhoneForDisplay(c.phone)}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatDateTime(c.receivedAt)}
                    </span>
                  </span>
                  <Badge>{STATUS_LABEL[c.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  title,
  icon: Icon,
  value,
  loading,
}: {
  title: string;
  icon: typeof Phone;
  value: number | string;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-2xl font-bold tabular-nums">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
