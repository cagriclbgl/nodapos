"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, supervisor as supervisorApi } from "@/lib/api";
import type { StoreOverviewDto } from "@/types/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui-v2/card";
import { Badge } from "@/components/ui-v2/badge";
import { Skeleton } from "@/components/ui-v2/skeleton";
import { formatShortDate } from "@/lib/format";

export default function StoresPage() {
  const [stores, setStores] = useState<StoreOverviewDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await supervisorApi.stores.list();
        if (!cancelled) setStores(list);
      } catch (err) {
        if (!cancelled)
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
        <h2 className="text-3xl font-bold tracking-tight">Mağazalar</h2>
        <p className="text-sm text-muted-foreground">
          Sistemdeki tüm restoranlar.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : stores.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Henüz mağaza yok. Onayladığınız başvurular burada görünecek.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {stores.map((s) => (
            <Link
              key={s.id}
              href={`/supervisor/stores/${s.id}`}
              className="block transition-colors"
            >
              <Card className="hover:border-primary/40">
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-lg">{s.name}</CardTitle>
                    {s.address && (
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {s.address}
                      </p>
                    )}
                  </div>
                  <Badge variant={s.isActive ? "default" : "secondary"}>
                    {s.isActive ? "Aktif" : "Pasif"}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <Stat label="Kullanıcı" value={s.userCount} />
                    <Stat label="Sipariş" value={s.orderCount} />
                    <Stat
                      label="Açıldı"
                      value={formatShortDate(s.createdAt)}
                      mono={false}
                    />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: number | string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={mono ? "font-mono text-base font-semibold tabular-nums" : "text-base"}>
        {value}
      </p>
    </div>
  );
}
