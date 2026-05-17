"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  CalendarRange,
  Receipt,
  ShoppingBag,
  Wallet,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ApiError, supervisor as supervisorApi } from "@/lib/api";
import type {
  OpenOrderRowDto,
  PaymentMethodBreakdown,
  StoreAnalyticsDto,
  SupervisorPeriod,
  TopProductDto,
} from "@/types/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui-v2/card";
import { Badge } from "@/components/ui-v2/badge";
import { Skeleton } from "@/components/ui-v2/skeleton";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui-v2/tabs";
import { formatCurrency, formatShortHour } from "@/lib/format";

const PERIOD_LABEL: Record<SupervisorPeriod, string> = {
  today: "Bugün",
  "7d": "Son 7 Gün",
  "30d": "Son 30 Gün",
};

const PAYMENT_LABEL: Record<PaymentMethodBreakdown["method"], string> = {
  Cash: "Nakit",
  CreditCard: "Kredi Kartı",
  DebitCard: "Banka Kartı",
  MealCard: "Yemek Kartı",
  Other: "Diğer",
};

const ORDER_TYPE_LABEL: Record<string, string> = {
  DineIn: "Masa",
  Takeaway: "Paket / Gel-Al",
  Delivery: "Kurye",
};

export function StorePerformance({ storeId }: { storeId: string }) {
  const [period, setPeriod] = useState<SupervisorPeriod>("today");
  const [data, setData] = useState<StoreAnalyticsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const dto = await supervisorApi.analytics.store(storeId, period);
        if (!cancelled) {
          setData(dto);
          setError(null);
        }
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof ApiError ? err.detail || err.message : String(err)
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, period]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Tabs
          value={period}
          onValueChange={(v) => setPeriod(v as SupervisorPeriod)}
        >
          <TabsList>
            <TabsTrigger value="today">Bugün</TabsTrigger>
            <TabsTrigger value="7d">Son 7 Gün</TabsTrigger>
            <TabsTrigger value="30d">Son 30 Gün</TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
          <CalendarRange className="h-3.5 w-3.5" />
          {PERIOD_LABEL[period]}
        </span>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi
          icon={Wallet}
          label="Ciro"
          value={data ? formatCurrency(data.totalRevenue) : null}
          loading={loading}
          accent
        />
        <Kpi
          icon={Receipt}
          label="Sipariş"
          value={data ? data.orderCount.toString() : null}
          loading={loading}
        />
        <Kpi
          icon={ShoppingBag}
          label="Ortalama Sepet"
          value={data ? formatCurrency(data.averageBasket) : null}
          loading={loading}
        />
        <Kpi
          icon={Receipt}
          label="Açık Sipariş"
          value={data ? data.openOrderCount.toString() : null}
          loading={loading}
          subtitle="şu an"
        />
        <Kpi
          icon={XCircle}
          label="İptal"
          value={data ? data.cancelledOrderCount.toString() : null}
          loading={loading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {period === "today" ? "Saatlik Ciro" : "Günlük Ciro"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading || !data ? (
            <Skeleton className="h-64 w-full" />
          ) : period === "today" ? (
            <HourlyChart data={data.hourly} />
          ) : (
            <DailyChart data={data.daily} />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">En Çok Satan Ürünler</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <Skeleton className="h-48 w-full" />
            ) : data.topProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Bu aralıkta tamamlanan sipariş yok.
              </p>
            ) : (
              <TopProductsList items={data.topProducts} />
            )}
          </CardContent>
        </Card>

        {period === "today" ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Açık Siparişler</CardTitle>
              {data && data.openOrderCount > data.openOrders.length && (
                <span className="text-xs text-muted-foreground">
                  ilk {data.openOrders.length} / {data.openOrderCount}
                </span>
              )}
            </CardHeader>
            <CardContent>
              {loading || !data ? (
                <Skeleton className="h-48 w-full" />
              ) : data.openOrders.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Şu an açık sipariş yok.
                </p>
              ) : (
                <OpenOrdersList items={data.openOrders} />
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ödeme Yöntemi</CardTitle>
            </CardHeader>
            <CardContent>
              {loading || !data ? (
                <Skeleton className="h-48 w-full" />
              ) : data.paymentBreakdown.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Bu aralıkta tahsilat yok.
                </p>
              ) : (
                <PaymentBreakdownList items={data.paymentBreakdown} />
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {period === "today" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ödeme Yöntemi (Bugün)</CardTitle>
            </CardHeader>
            <CardContent>
              {loading || !data ? (
                <Skeleton className="h-32 w-full" />
              ) : data.paymentBreakdown.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Bugün tahsilat yok.
                </p>
              ) : (
                <PaymentBreakdownList items={data.paymentBreakdown} />
              )}
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sipariş Tipi</CardTitle>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <Skeleton className="h-32 w-full" />
            ) : data.orderTypeBreakdown.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Bu aralıkta tamamlanan sipariş yok.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.orderTypeBreakdown.map((b) => (
                  <li
                    key={b.orderType}
                    className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm"
                  >
                    <span>{ORDER_TYPE_LABEL[b.orderType] ?? b.orderType}</span>
                    <span className="flex items-center gap-4">
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {b.count} sipariş
                      </span>
                      <span className="font-mono font-semibold tabular-nums">
                        {formatCurrency(b.total)}
                      </span>
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
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon
          className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground"}`}
        />
      </CardHeader>
      <CardContent>
        {loading || value === null ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <p className="font-mono text-xl font-semibold tabular-nums">
            {value}
          </p>
        )}
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

function HourlyChart({ data }: { data: StoreAnalyticsDto["hourly"] }) {
  const labelled = data.map((h) => ({
    ...h,
    label: `${h.hour.toString().padStart(2, "0")}:00`,
  }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={labelled}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
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
            interval={2}
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
            cursor={{ fill: "hsl(var(--muted))" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof labelled)[number];
              return (
                <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-md">
                  <p className="font-medium">{p.label}</p>
                  <p className="font-mono">{formatCurrency(p.revenue)}</p>
                  <p className="text-muted-foreground">
                    {p.orderCount} sipariş
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="revenue" radius={[3, 3, 0, 0]}>
            {labelled.map((entry, i) => (
              <Cell
                key={i}
                fill={
                  entry.revenue > 0
                    ? "hsl(var(--primary))"
                    : "hsl(var(--muted))"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DailyChart({ data }: { data: StoreAnalyticsDto["daily"] }) {
  const labelled = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
    }),
  }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={labelled}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="storeRev" x1="0" y1="0" x2="0" y2="1">
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
            interval={Math.max(0, Math.floor(labelled.length / 8) - 1)}
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
              const p = payload[0].payload as (typeof labelled)[number];
              return (
                <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-md">
                  <p className="font-medium">{p.label}</p>
                  <p className="font-mono">{formatCurrency(p.revenue)}</p>
                  <p className="text-muted-foreground">
                    {p.orderCount} sipariş
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#storeRev)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function TopProductsList({ items }: { items: TopProductDto[] }) {
  const max = Math.max(...items.map((i) => i.quantity), 1);
  return (
    <ul className="space-y-2.5">
      {items.map((p, i) => {
        const pct = (p.quantity / max) * 100;
        return (
          <li key={p.productId}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold tabular-nums">
                  {i + 1}
                </span>
                <span className="truncate text-sm">{p.productName}</span>
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums">
                {p.quantity} ·{" "}
                <span className="text-muted-foreground">
                  {formatCurrency(p.revenue)}
                </span>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary/70"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function OpenOrdersList({ items }: { items: OpenOrderRowDto[] }) {
  return (
    <ul className="space-y-2">
      {items.map((o) => (
        <li
          key={o.orderId}
          className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm"
        >
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-medium">
              <span className="font-mono text-xs text-muted-foreground">
                #{o.orderNumber}
              </span>
              <Badge variant="secondary" className="text-[10px]">
                {ORDER_TYPE_LABEL[o.orderType] ?? o.orderType}
              </Badge>
              {o.tableName && (
                <span className="text-xs text-muted-foreground">
                  {o.tableName}
                </span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {o.customerName ?? "Müşteri belirtilmemiş"} ·{" "}
              {formatShortHour(o.createdAt)}
            </p>
          </div>
          <p className="shrink-0 font-mono text-sm font-semibold tabular-nums">
            {formatCurrency(o.total)}
          </p>
        </li>
      ))}
    </ul>
  );
}

function PaymentBreakdownList({ items }: { items: PaymentMethodBreakdown[] }) {
  const total = items.reduce((a, b) => a + b.total, 0) || 1;
  return (
    <ul className="space-y-2.5">
      {items.map((b) => {
        const pct = (b.total / total) * 100;
        return (
          <li key={b.method}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span>{PAYMENT_LABEL[b.method] ?? b.method}</span>
              <span className="font-mono tabular-nums">
                {formatCurrency(b.total)}{" "}
                <span className="text-xs text-muted-foreground">
                  ({pct.toFixed(0)}%)
                </span>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary/70"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
