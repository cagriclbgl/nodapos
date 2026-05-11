"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Phone, PhoneMissed, PhoneIncoming, Plus } from "lucide-react";
import { incomingCalls } from "@/lib/api";
import { describeError } from "@/lib/use-store-api";
import { useStoreContext } from "@/lib/store-context";
import { startOfDayIso, endOfDayIso, formatDateTime } from "@/lib/format";
import { formatPhoneForDisplay } from "@/lib/phone-normalize";
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

const STATUS_VARIANT: Record<
  IncomingCallStatus,
  "default" | "secondary" | "outline"
> = {
  New: "default",
  Handled: "secondary",
  Missed: "outline",
  Ignored: "outline",
};

/**
 * Bugünkü çağrı geçmişi — kasiyerin "az önce kim aradı?" sorusuna hızlı cevap.
 * Aktif filtre: tarih (bugün varsayılan) + durum.
 */
export default function PosCallsPage() {
  const { storeId } = useStoreContext();
  const [calls, setCalls] = useState<IncomingCallDto[]>([]);
  const [filter, setFilter] = useState<IncomingCallStatus | "All">("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useMemo(
    () => async () => {
      if (!storeId) return;
      setLoading(true);
      setError(null);
      try {
        const data = await incomingCalls.list({
          from: startOfDayIso(),
          to: endOfDayIso(),
          status: filter === "All" ? undefined : filter,
          limit: 200,
        });
        setCalls(data);
      } catch (err) {
        setError(describeError(err));
      } finally {
        setLoading(false);
      }
    },
    [storeId, filter]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Auto-refresh: her 15sn'de bir tazele (kasada bir başkasının cevapladığı
  // çağrı görülsün diye).
  useEffect(() => {
    const t = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  const markMissed = async (id: string) => {
    try {
      await incomingCalls.resolve(id, { status: "Missed" });
      void refresh();
    } catch (err) {
      setError(describeError(err));
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Paket Servis</h2>
          <p className="text-sm text-muted-foreground">
            Caller ID kutusundan gelen aramalar ve manuel oluşturulan paket
            siparişler.
          </p>
        </div>
        <Button asChild size="lg" className="shrink-0">
          <Link href="/pos/delivery/new">
            <Plus className="mr-1.5 h-5 w-5" />
            Yeni Paket Sipariş
          </Link>
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1">
        {(["All", "New", "Handled", "Missed", "Ignored"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => setFilter(s)}
          >
            {s === "All" ? "Hepsi" : STATUS_LABEL[s]}
          </Button>
        ))}
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : calls.length === 0 ? (
        <EmptyState
          icon={Phone}
          title="Bugün çağrı yok"
          description="Kutudan henüz bir arama gelmedi."
        />
      ) : (
        <ul className="space-y-2">
          {calls.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                {c.status === "Missed" ? (
                  <PhoneMissed className="h-5 w-5 shrink-0 text-amber-500" />
                ) : (
                  <PhoneIncoming className="h-5 w-5 shrink-0 text-primary" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {c.matchedCustomer?.name ?? "Bilinmeyen"}
                    {c.lineNumber !== null && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        Hat {c.lineNumber}
                      </Badge>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">
                      {formatPhoneForDisplay(c.phone)}
                    </span>
                    <span className="mx-2">·</span>
                    {formatDateTime(c.receivedAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[c.status]}>
                  {STATUS_LABEL[c.status]}
                </Badge>
                {c.matchedCustomer && c.status === "New" && (
                  <Button asChild size="sm">
                    <Link
                      href={`/pos/delivery/new?callId=${c.id}&customerId=${c.matchedCustomer.id}`}
                    >
                      Sipariş Aç
                    </Link>
                  </Button>
                )}
                {c.status === "New" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void markMissed(c.id)}
                  >
                    Cevapsız
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
