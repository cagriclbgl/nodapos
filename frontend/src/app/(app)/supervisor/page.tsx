"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowUpRight,
  Building2,
  ClipboardList,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ApiError, supervisor as supervisorApi } from "@/lib/api";
import type {
  StoreRegistrationRequestDto,
  StoreTodayRowDto,
  SupervisorDashboardDto,
  SupervisorRevenueTrendDto,
  SupervisorTodaySummaryDto,
} from "@/types/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui-v2/card";
import { Skeleton } from "@/components/ui-v2/skeleton";
import { Badge } from "@/components/ui-v2/badge";
import { formatCurrency, formatShortDate } from "@/lib/format";

export default function SupervisorDashboard() {
  const [today, setToday] = useState<SupervisorTodaySummaryDto | null>(null);
  const [trend, setTrend] = useState<SupervisorRevenueTrendDto | null>(null);
  const [counts, setCounts] = useState<SupervisorDashboardDto | null>(null);
  const [recentReg, setRecentReg] = useState<StoreRegistrationRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [t, r, d, reg] = await Promise.all([
          supervisorApi.analytics.today(),
          supervisorApi.analytics.revenueTrend(7),
          supervisorApi.dashboard(),
          supervisorApi.registrations.list("Pending"),
        ]);
        if (cancelled) return;
        setToday(t);
        setTrend(r);
        setCounts(d);
        setRecentReg(reg.slice(0, 5));
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

  const topStores = useMemo(
    () =>
      today
        ? [...today.stores].sort((a, b) => b.revenue - a.revenue).slice(0, 8)
        : [],
    [today]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Bugün</h2>
          <p className="text-sm text-muted-foreground">
            Tüm mağazaların canlı operasyon özeti — fiili tahsilat bazlı.
          </p>
        </div>
        {today && (
          <p className="text-xs text-muted-foreground">
            {new Date(today.fromUtc).toLocaleDateString("tr-TR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PrimaryKpi
          icon={Wallet}
          label="Bugün Ciro"
          value={today ? formatCurrency(today.totalRevenue) : null}
          loading={loading}
          accent
        />
        <PrimaryKpi
          icon={Receipt}
          label="Sipariş"
          value={today ? today.orderCount.toString() : null}
          loading={loading}
        />
        <PrimaryKpi
          icon={ShoppingBag}
          label="Ortalama Sepet"
          value={today ? formatCurrency(today.averageBasket) : null}
          loading={loading}
        />
        <PrimaryKpi
          icon={Activity}
          label="Aktif Mağaza"
          value={
            today
              ? `${today.activeStoreCount} / ${today.totalStoreCount}`
              : null
          }
          loading={loading}
          subtitle="bugün satışı olan"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Son 7 Gün Ciro Trendi</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Toplam tahsilat (TL) · Sipariş sayısı tooltip'te
              </p>
            </div>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading || !trend ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <RevenueTrendChart points={trend.points} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Bugünün En İyileri</CardTitle>
            <Link
              href="/supervisor/stores"
              className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
            >
              Tümü <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-56 w-full" />
            ) : topStores.length === 0 || topStores[0].revenue === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Bugün henüz tahsilat yok.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {topStores
                  .filter((s) => s.revenue > 0)
                  .map((s, i) => (
                    <TopStoreRow key={s.storeId} row={s} rank={i + 1} />
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Platform</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Genel durum — bugünden bağımsız sayımlar.
            </p>
          </div>
          {counts?.pendingRegistrations ? (
            <Badge variant="secondary" className="gap-1">
              <ClipboardList className="h-3 w-3" />
              {counts.pendingRegistrations} bekleyen başvuru
            </Badge>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <SecondaryKpi
              icon={Building2}
              label="Toplam Mağaza"
              value={counts?.totalStores}
              loading={loading}
            />
            <SecondaryKpi
              icon={Activity}
              label="Aktif Mağaza"
              value={counts?.activeStores}
              loading={loading}
            />
            <SecondaryKpi
              icon={ClipboardList}
              label="Bekleyen Başvuru"
              value={counts?.pendingRegistrations}
              loading={loading}
              accent={!!counts?.pendingRegistrations}
            />
            <SecondaryKpi
              icon={Users}
              label="Toplam Kullanıcı"
              value={counts?.totalUsers}
              loading={loading}
            />
          </div>
        </CardContent>
      </Card>

      {recentReg.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Bekleyen Başvurular</CardTitle>
            <Link
              href="/supervisor/registrations"
              className="text-sm text-primary hover:underline inline-flex items-center gap-0.5"
            >
              Tümü <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {recentReg.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.storeName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.contactName} · {r.phone}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatShortDate(r.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PrimaryKpi({
  icon: Icon,
  label,
  value,
  loading,
  accent,
  subtitle,
}: {
  icon: LucideIcon;
  label: string;
  value: string | null;
  loading: boolean;
  accent?: boolean;
  subtitle?: string;
}) {
  return (
    <Card className={accent ? "border-primary/30 bg-primary/5" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon
          className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground"}`}
        />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-9 w-24" />
        ) : (
          <p
            className={`font-mono text-2xl font-semibold tabular-nums tracking-tight ${value === null ? "text-muted-foreground" : ""}`}
          >
            {value ?? "—"}
          </p>
        )}
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

function SecondaryKpi({
  icon: Icon,
  label,
  value,
  loading,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: number | undefined;
  loading: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${accent ? "border-primary/30 bg-primary/5" : ""}`}
    >
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      {loading || value === undefined ? (
        <Skeleton className="h-7 w-14" />
      ) : (
        <p className="font-mono text-xl font-semibold tabular-nums">{value}</p>
      )}
    </div>
  );
}

function TopStoreRow({ row, rank }: { row: StoreTodayRowDto; rank: number }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <Link
          href={`/supervisor/stores/${row.storeId}`}
          className="block truncate text-sm font-medium hover:underline"
        >
          {row.storeName}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {row.orderCount} sipariş · ort {formatCurrency(row.averageBasket)}
        </p>
      </div>
      <p className="shrink-0 font-mono text-sm font-semibold tabular-nums">
        {formatCurrency(row.revenue)}
      </p>
    </li>
  );
}

function RevenueTrendChart({
  points,
}: {
  points: SupervisorRevenueTrendDto["points"];
}) {
  const data = points.map((p) => ({
    ...p,
    label: new Date(p.date).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
    }),
  }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) =>
              v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`
            }
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof data)[number];
              return (
                <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-md">
                  <p className="font-medium">{p.label}</p>
                  <p className="font-mono">{formatCurrency(p.revenue)}</p>
                  <p className="text-muted-foreground">{p.orderCount} sipariş</p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#rev)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
