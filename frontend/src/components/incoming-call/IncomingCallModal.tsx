"use client";

import { useRouter } from "next/navigation";
import { Phone, PhoneOff, UserPlus, History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-v2/dialog";
import { Button } from "@/components/ui-v2/button";
import { Badge } from "@/components/ui-v2/badge";
import { useIncomingCall } from "@/lib/incoming-call-listener";
import { formatPhoneForDisplay } from "@/lib/phone-normalize";
import { formatCurrency } from "@/lib/format";

/**
 * Çağrı geldiğinde açılan ekran. Akış:
 *  - Kayıtlı müşteri varsa: isim + son adres + son 3 sipariş + "Yeni Sipariş" CTA
 *  - Kayıtsız: "Yeni müşteri ekle + sipariş başlat" CTA
 *  - Cevapsız işaretle: backend'e PATCH (status=Missed)
 *  - Şimdi değil (ignore): UI'dan düşür ama kayıt değişmez
 *
 * "Yeni Sipariş" → /pos/delivery/new?callId=...&customerId=...
 *   Sayfa açılınca müşteri prefilled gelir; sipariş yaratıldığında çağrı
 *   otomatik Handled + ResolvedOrderId set edilir (backend tarafı yönetir).
 */
export function IncomingCallModal() {
  const router = useRouter();
  const { activeCall, activeCallFallback, clearActiveCall, markMissed } =
    useIncomingCall();

  // Backend kayıt başarısız olduysa minimal fallback göster (login değilse).
  if (!activeCall && activeCallFallback) {
    return (
      <Dialog open onOpenChange={(o) => !o && clearActiveCall()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" /> Gelen Arama
            </DialogTitle>
            <DialogDescription>
              {activeCallFallback.unauthenticated
                ? "Çağrı kaydı için kasa girişi yapılmamış. Lütfen önce giriş yapın."
                : "Çağrı kaydı backend'e ulaştırılamadı."}
            </DialogDescription>
          </DialogHeader>
          <div className="text-2xl font-semibold tabular-nums">
            {formatPhoneForDisplay(activeCallFallback.phone)}
            {activeCallFallback.lineNumber !== undefined && (
              <Badge variant="secondary" className="ml-3">
                Hat {activeCallFallback.lineNumber}
              </Badge>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={clearActiveCall}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (!activeCall) return null;

  const matched = activeCall.matchedCustomer;
  const phone = formatPhoneForDisplay(activeCall.phone);

  const startDeliveryOrder = () => {
    if (!matched) {
      // Kayıtsız → /pos/delivery/new + ?prefillPhone=... ekrana düşer ve
      // CustomerSearch'in inline "yeni müşteri" formu prefilled açılır.
      const qs = new URLSearchParams({
        callId: activeCall.id,
        prefillPhone: activeCall.phone ?? "",
      });
      router.push(`/pos/delivery/new?${qs.toString()}`);
    } else {
      const qs = new URLSearchParams({
        callId: activeCall.id,
        customerId: matched.id,
      });
      router.push(`/pos/delivery/new?${qs.toString()}`);
    }
    clearActiveCall();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && clearActiveCall()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Phone className="h-5 w-5 text-primary" /> Gelen Arama
            {activeCall.lineNumber !== null && (
              <Badge variant="secondary">Hat {activeCall.lineNumber}</Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-2xl font-bold tabular-nums text-foreground">
            {phone}
          </DialogDescription>
        </DialogHeader>

        {matched ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-lg font-semibold">{matched.name}</p>
              {matched.defaultAddressLine && (
                <p className="text-sm text-muted-foreground">
                  {matched.defaultAddressLine}
                  {matched.defaultAddressDistrict
                    ? ` — ${matched.defaultAddressDistrict}`
                    : ""}
                </p>
              )}
            </div>

            {activeCall.recentOrders.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground">
                  <History className="h-3 w-3" /> Son siparişler
                </p>
                <ul className="space-y-1 text-sm">
                  {activeCall.recentOrders.map((o) => (
                    <li
                      key={o.id}
                      className="flex items-center justify-between rounded border px-2 py-1"
                    >
                      <span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {o.orderNumber}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {new Date(o.createdAt).toLocaleString("tr-TR")}
                        </span>
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(o.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-center">
            <UserPlus className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Kayıtlı müşteri bulunamadı. Sipariş başlatınca yeni müşteri olarak
              kaydedilebilir.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => void markMissed(activeCall.id)}
          >
            <PhoneOff /> Cevapsız
          </Button>
          <Button variant="ghost" onClick={clearActiveCall}>
            Şimdi değil
          </Button>
          <Button onClick={startDeliveryOrder}>
            {matched ? "Yeni Sipariş" : "Yeni Müşteri + Sipariş"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
