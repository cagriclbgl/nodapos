"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo } from "react";
import { OrderDto } from "@/types/api";
import { formatCurrency } from "@/lib/format";

interface Props {
  orders: OrderDto[];
  loading: boolean;
  error: string | null;
}

interface DailyPoint {
  key: string;
  label: string;
  total: number;
  count: number;
}

interface HourlyPoint {
  hour: number;
  label: string;
  total: number;
  count: number;
}

const DAY_LABEL = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
});

const WEEKDAY = new Intl.DateTimeFormat("tr-TR", { weekday: "short" });

export function RevenueCharts({ orders, loading, error }: Props) {
  const daily = useMemo<DailyPoint[]>(() => buildDaily(orders, 7), [orders]);
  const hourly = useMemo<HourlyPoint[]>(() => buildHourly(orders), [orders]);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
        Grafik verisi yüklenemedi: {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard
        title="Son 7 Gün Cirosu"
        subtitle="Günlük toplam (TL)"
        loading={loading}
        empty={!loading && daily.every((d) => d.total === 0)}
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" className="text-zinc-500" />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="currentColor"
              className="text-zinc-500"
              tickFormatter={(v) => compactCurrency(v as number)}
              width={56}
            />
            <Tooltip
              cursor={{ fill: "rgba(234,88,12,0.08)" }}
              formatter={(v) => formatCurrency(typeof v === "number" ? v : Number(v) || 0)}
              labelFormatter={(l, payload) => {
                const p = payload?.[0]?.payload as DailyPoint | undefined;
                return p ? `${l} · ${p.count} sipariş` : l;
              }}
              contentStyle={tooltipStyle}
            />
            <Bar dataKey="total" fill="#ea580c" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Bugünün Saatlik Trendi"
        subtitle="Saatlik toplam (TL)"
        loading={loading}
        empty={!loading && hourly.every((h) => h.total === 0)}
      >
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={hourly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" className="text-zinc-500" interval={1} />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="currentColor"
              className="text-zinc-500"
              tickFormatter={(v) => compactCurrency(v as number)}
              width={56}
            />
            <Tooltip
              formatter={(v) => formatCurrency(typeof v === "number" ? v : Number(v) || 0)}
              labelFormatter={(l, payload) => {
                const p = payload?.[0]?.payload as HourlyPoint | undefined;
                return p ? `${l} · ${p.count} sipariş` : l;
              }}
              contentStyle={tooltipStyle}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#ea580c"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#ea580c" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

const tooltipStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(228,228,231,0.6)",
  background: "rgba(255,255,255,0.95)",
  fontSize: 12,
};

function ChartCard({
  title,
  subtitle,
  loading,
  empty,
  children,
}: {
  title: string;
  subtitle: string;
  loading: boolean;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-xs text-zinc-500">{subtitle}</p>
      </div>
      {loading ? (
        <div className="flex h-[240px] items-center justify-center text-sm text-zinc-500">
          Yükleniyor…
        </div>
      ) : empty ? (
        <div className="flex h-[240px] items-center justify-center text-sm text-zinc-500">
          Henüz veri yok.
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function buildDaily(orders: OrderDto[], days: number): DailyPoint[] {
  const buckets = new Map<string, DailyPoint>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const key = dayKey(d);
    buckets.set(key, {
      key,
      label: i === 0 ? "Bugün" : i === 1 ? "Dün" : `${WEEKDAY.format(d)} ${DAY_LABEL.format(d)}`,
      total: 0,
      count: 0,
    });
  }
  for (const o of orders) {
    const at = new Date(o.completedAt ?? o.createdAt);
    const k = dayKey(at);
    const bucket = buckets.get(k);
    if (bucket) {
      bucket.total += o.total;
      bucket.count += 1;
    }
  }
  return Array.from(buckets.values());
}

function buildHourly(orders: OrderDto[]): HourlyPoint[] {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const hours: HourlyPoint[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${String(h).padStart(2, "0")}:00`,
    total: 0,
    count: 0,
  }));
  for (const o of orders) {
    const at = new Date(o.completedAt ?? o.createdAt);
    if (at < todayStart) continue;
    const h = at.getHours();
    hours[h].total += o.total;
    hours[h].count += 1;
  }
  return hours;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function compactCurrency(v: number): string {
  if (v >= 1000) return `${Math.round(v / 100) / 10}k`;
  return v.toString();
}
