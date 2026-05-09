"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, supervisor as supervisorApi } from "@/lib/api";
import type {
  StoreOverviewDto,
  StoreRegistrationRequestDto,
  SupervisorDashboardDto,
} from "@/types/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui-v2/card";
import { Skeleton } from "@/components/ui-v2/skeleton";
import { Badge } from "@/components/ui-v2/badge";
import { formatShortDate } from "@/lib/format";

export default function SupervisorDashboard() {
  const [stats, setStats] = useState<SupervisorDashboardDto | null>(null);
  const [recentReg, setRecentReg] = useState<StoreRegistrationRequestDto[]>([]);
  const [recentStores, setRecentStores] = useState<StoreOverviewDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [d, reg, stores] = await Promise.all([
          supervisorApi.dashboard(),
          supervisorApi.registrations.list(),
          supervisorApi.stores.list(),
        ]);
        if (cancelled) return;
        setStats(d);
        setRecentReg(reg.slice(0, 5));
        setRecentStores(
          [...stores]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 5)
        );
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.detail || err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Özet</h2>
        <p className="text-sm text-muted-foreground">
          Platform genel durumu ve son hareketler.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Toplam Mağaza"
          value={stats?.totalStores}
          loading={loading}
        />
        <Kpi
          label="Aktif Mağaza"
          value={stats?.activeStores}
          loading={loading}
        />
        <Kpi
          label="Bekleyen Başvuru"
          value={stats?.pendingRegistrations}
          loading={loading}
          accent={!!stats?.pendingRegistrations}
        />
        <Kpi
          label="Toplam Kullanıcı"
          value={stats?.totalUsers}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Son Başvurular</CardTitle>
            <Link
              href="/supervisor/registrations"
              className="text-sm text-primary hover:underline"
            >
              Tümü
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : recentReg.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Henüz başvuru yok.
              </p>
            ) : (
              <ul className="space-y-3">
                {recentReg.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {r.storeName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.contactName} · {r.phone}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Son Eklenen Mağazalar</CardTitle>
            <Link
              href="/supervisor/stores"
              className="text-sm text-primary hover:underline"
            >
              Tümü
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : recentStores.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Henüz mağaza yok.
              </p>
            ) : (
              <ul className="space-y-3">
                {recentStores.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/supervisor/stores/${s.id}`}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {s.name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.userCount} kullanıcı · {s.orderCount} sipariş
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatShortDate(s.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  loading,
  accent,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? "border-primary/30 bg-primary/5" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading || value === undefined ? (
          <Skeleton className="h-9 w-16" />
        ) : (
          <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight">
            {value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({
  status,
}: {
  status: StoreRegistrationRequestDto["status"];
}) {
  if (status === "Pending") return <Badge variant="secondary">Bekliyor</Badge>;
  if (status === "Approved") return <Badge>Onaylandı</Badge>;
  return <Badge variant="destructive">Reddedildi</Badge>;
}
