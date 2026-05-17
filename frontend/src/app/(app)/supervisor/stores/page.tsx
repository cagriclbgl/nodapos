"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { ApiError, supervisor as supervisorApi } from "@/lib/api";
import type { StoreTodayRowDto } from "@/types/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui-v2/card";
import { Badge } from "@/components/ui-v2/badge";
import { Skeleton } from "@/components/ui-v2/skeleton";
import { Input } from "@/components/ui-v2/input";
import { formatCurrency } from "@/lib/format";

type SortKey =
  | "name"
  | "revenue"
  | "orderCount"
  | "averageBasket"
  | "openOrderCount"
  | "lastPaymentAt"
  | "userCount"
  | "lifetimeOrderCount";

type SortDir = "asc" | "desc";

export default function StoresPage() {
  const [rows, setRows] = useState<StoreTodayRowDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const t = await supervisorApi.analytics.today();
        if (!cancelled) setRows(t.stores);
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
  }, []);

  const sorted = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    const filtered = q
      ? rows.filter((r) => r.storeName.toLocaleLowerCase("tr-TR").includes(q))
      : rows;
    const sign = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "name") {
        return sign * a.storeName.localeCompare(b.storeName, "tr-TR");
      }
      if (sortKey === "lastPaymentAt") {
        const av = a.lastPaymentAt ? new Date(a.lastPaymentAt).getTime() : 0;
        const bv = b.lastPaymentAt ? new Date(b.lastPaymentAt).getTime() : 0;
        return sign * (av - bv);
      }
      return sign * ((a[sortKey] as number) - (b[sortKey] as number));
    });
  }, [rows, query, sortKey, sortDir]);

  const totalToday = useMemo(
    () => sorted.reduce((acc, r) => acc + r.revenue, 0),
    [sorted]
  );

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(k);
      setSortDir(k === "name" ? "asc" : "desc");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Mağazalar</h2>
          <p className="text-sm text-muted-foreground">
            Tüm mağazaların bugünkü operasyonel durumu.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Bugün toplam ciro</p>
          <p className="font-mono text-xl font-semibold tabular-nums">
            {loading ? (
              <Skeleton className="ml-auto h-7 w-28" />
            ) : (
              formatCurrency(totalToday)
            )}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Mağaza ara…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {query ? "Eşleşen mağaza yok." : "Henüz mağaza yok."}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {sorted.length} mağaza
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0">
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <Th label="Mağaza" sortKey="name" current={sortKey} dir={sortDir} onClick={toggleSort} className="pl-6" />
                  <Th label="Durum" />
                  <Th label="Bugün Ciro" sortKey="revenue" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                  <Th label="Sipariş" sortKey="orderCount" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                  <Th label="Ort. Sepet" sortKey="averageBasket" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                  <Th label="Açık" sortKey="openOrderCount" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                  <Th label="Son Aktivite" sortKey="lastPaymentAt" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                  <Th label="Kullanıcı" sortKey="userCount" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                  <Th label="Toplam Sipariş" sortKey="lifetimeOrderCount" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" className="pr-6" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <StoreRow key={r.storeId} row={r} />
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Th({
  label,
  sortKey,
  current,
  dir,
  onClick,
  align = "left",
  className = "",
}: {
  label: string;
  sortKey?: SortKey;
  current?: SortKey;
  dir?: SortDir;
  onClick?: (k: SortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const sortable = !!sortKey && !!onClick;
  const active = sortable && current === sortKey;
  return (
    <th
      className={`px-3 py-2.5 font-medium ${align === "right" ? "text-right" : "text-left"} ${className}`}
    >
      {sortable ? (
        <button
          type="button"
          onClick={() => onClick!(sortKey!)}
          className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : ""} ${align === "right" ? "ml-auto" : ""}`}
        >
          {label}
          {active ? (
            dir === "asc" ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-40" />
          )}
        </button>
      ) : (
        label
      )}
    </th>
  );
}

function StoreRow({ row }: { row: StoreTodayRowDto }) {
  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/40">
      <td className="px-3 py-3 pl-6">
        <Link
          href={`/supervisor/stores/${row.storeId}`}
          className="font-medium hover:underline"
        >
          {row.storeName}
        </Link>
      </td>
      <td className="px-3 py-3">
        <Badge variant={row.isActive ? "default" : "secondary"}>
          {row.isActive ? "Aktif" : "Pasif"}
        </Badge>
      </td>
      <td className="px-3 py-3 text-right font-mono tabular-nums">
        {row.revenue > 0 ? (
          <span className="font-semibold">{formatCurrency(row.revenue)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-right font-mono tabular-nums">
        {row.orderCount || <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-3 text-right font-mono tabular-nums text-muted-foreground">
        {row.orderCount > 0 ? formatCurrency(row.averageBasket) : "—"}
      </td>
      <td className="px-3 py-3 text-right">
        {row.openOrderCount > 0 ? (
          <Badge variant="secondary" className="tabular-nums">
            {row.openOrderCount}
          </Badge>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </td>
      <td className="px-3 py-3 text-right text-xs text-muted-foreground">
        {row.lastPaymentAt ? <RelativeTime iso={row.lastPaymentAt} /> : "—"}
      </td>
      <td className="px-3 py-3 text-right font-mono tabular-nums text-muted-foreground">
        {row.userCount}
      </td>
      <td className="px-3 py-3 pr-6 text-right font-mono tabular-nums text-muted-foreground">
        {row.lifetimeOrderCount}
      </td>
    </tr>
  );
}

function RelativeTime({ iso }: { iso: string }) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return <>az önce</>;
  if (min < 60) return <>{min} dk önce</>;
  const hr = Math.floor(min / 60);
  if (hr < 24) return <>{hr} sa önce</>;
  return <>{Math.floor(hr / 24)} g önce</>;
}
