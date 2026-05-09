"use client";

import { useMemo } from "react";
import { useStoreApi } from "@/lib/use-store-api";
import {
  formatCurrency,
  startOfDayIso,
  endOfDayIso,
  startOfDayDaysAgoIso,
} from "@/lib/format";
import { OrderDto } from "@/types/api";
import { RevenueCharts } from "./revenue-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-v2/card";
import { Skeleton } from "@/components/ui-v2/skeleton";

export default function AdminHome() {
  // Last 7 days of completed orders → drives both the daily-trend chart and
  // today's KPIs.
  const weekPath = useMemo(
    () =>
      `/api/orders?status=Completed&from=${encodeURIComponent(
        startOfDayDaysAgoIso(6)
      )}&to=${encodeURIComponent(endOfDayIso())}`,
    []
  );

  const week = useStoreApi<OrderDto[]>(weekPath);
  const active = useStoreApi<OrderDto[]>("/api/orders?status=Active");

  const todayStart = startOfDayIso();
  const todayOrders = (week.data ?? []).filter(
    (o) => (o.completedAt ?? o.createdAt) >= todayStart
  );
  const todayRevenue = todayOrders.reduce((s, o) => s + o.total, 0);
  const todayCount = todayOrders.length;
  const activeCount = active.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Özet</h2>
        <p className="text-sm text-muted-foreground">Bugünün ana göstergeleri.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Kpi
          label="Bugünkü Ciro"
          value={week.loading ? null : formatCurrency(todayRevenue)}
          hint={`${todayCount} kapanmış sipariş`}
          error={week.error}
          loading={week.loading}
          accent
        />
        <Kpi
          label="Tamamlanan Sipariş"
          value={week.loading ? null : todayCount.toString()}
          hint="bugün"
          error={week.error}
          loading={week.loading}
        />
        <Kpi
          label="Aktif Sipariş"
          value={active.loading ? null : activeCount.toString()}
          hint="şu an"
          error={active.error}
          loading={active.loading}
        />
      </div>

      <RevenueCharts
        orders={week.data ?? []}
        loading={week.loading}
        error={week.error}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  error,
  loading,
  accent,
}: {
  label: string;
  value: string | null;
  hint?: string;
  error: string | null;
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
        {loading || value === null ? (
          <Skeleton className="h-9 w-24" />
        ) : (
          <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight">
            {value}
          </p>
        )}
        {hint && !error && (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        )}
        {error && (
          <p className="mt-2 text-xs text-destructive">API hatası: {error}</p>
        )}
      </CardContent>
    </Card>
  );
}
