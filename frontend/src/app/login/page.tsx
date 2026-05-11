"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { StoreSummaryDto } from "@/types/api";
import { Button } from "@/components/ui-v2/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui-v2/card";
import { Input } from "@/components/ui-v2/input";
import { Label } from "@/components/ui-v2/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-v2/select";

/**
 * Username + password only. Server resolves the store automatically when the
 * username is unambiguous (vast majority of cases — one cashier, one store).
 *
 * If the same username exists in multiple stores, the server returns 409 and
 * we surface a store dropdown for disambiguation. The dropdown stays hidden
 * by default so the common case is a clean two-field form.
 */
export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [storeId, setStoreId] = useState("");

  const [needStorePicker, setNeedStorePicker] = useState(false);
  const [stores, setStores] = useState<StoreSummaryDto[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    router.replace(user.role === "Manager" ? "/admin" : "/pos");
  }, [authLoading, user, router]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!username || !password) return;
    if (needStorePicker && !storeId) {
      setSubmitError("Lütfen bir mağaza seç.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await login({
        username,
        password,
        ...(storeId ? { storeId } : {}),
      });
      router.replace(res.user.role === "Manager" ? "/admin" : "/pos");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setSubmitError("Hatalı kullanıcı adı veya şifre.");
        } else if (err.status === 409) {
          // Multiple stores have this username — surface the picker.
          setNeedStorePicker(true);
          setSubmitError("Bu kullanıcı birden fazla mağazada bulundu. Mağaza seç ve tekrar dene.");
          // Lazy-load store list only when we actually need it.
          if (stores.length === 0) {
            setStoresLoading(true);
            try {
              const list = await api.get<StoreSummaryDto[]>("/api/stores");
              setStores(list);
            } catch {
              /* ignore — user will see error on next submit if list still empty */
            } finally {
              setStoresLoading(false);
            }
          }
        } else if (err.status === 423) {
          // First-Manager bootstrap path needs an explicit store.
          if (!storeId) {
            setSubmitError("İlk Manager kurulumu için mağaza seçimi gerekli.");
            setNeedStorePicker(true);
            if (stores.length === 0) {
              try {
                const list = await api.get<StoreSummaryDto[]>("/api/stores");
                setStores(list);
              } catch {
                /* ignore */
              }
            }
          } else {
            router.push(`/setup?storeId=${encodeURIComponent(storeId)}`);
          }
        } else {
          setSubmitError(err.detail || err.message);
        }
      } else {
        setSubmitError(String(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 px-6 py-10 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      {/* Dekoratif blur orb'ları — sıcak NodaPos paleti */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-orange-400/40 blur-3xl dark:bg-orange-600/20"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-rose-400/30 blur-3xl dark:bg-rose-600/15"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300/25 blur-3xl dark:bg-amber-700/10"
      />
      {/* İnce noise / grid dokusu */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.05)_1px,transparent_0)] [background-size:24px_24px] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.04)_1px,transparent_0)]"
      />

      <Card className="relative z-10 w-full max-w-md border-white/40 bg-white/70 shadow-2xl shadow-orange-900/10 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/70 dark:shadow-black/40">
        <CardHeader className="space-y-4 pb-2">
          <div className="flex items-center justify-center">
            <div className="rounded-2xl bg-white p-2 shadow-lg shadow-orange-500/20 ring-1 ring-orange-200/60 dark:bg-zinc-950 dark:ring-orange-900/40">
              <Image
                src="/icon.png"
                alt="NodaPos"
                width={64}
                height={64}
                priority
                className="h-16 w-16 rounded-xl"
              />
            </div>
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl">NodaPos&apos;a Hoş Geldin</CardTitle>
            <CardDescription className="mt-1.5">
              Kullanıcı adın ve şifrenle giriş yap.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="username">Kullanıcı Adı</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={submitting}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            {needStorePicker && (
              <div className="space-y-1.5">
                <Label htmlFor="store">Mağaza</Label>
                <Select
                  value={storeId}
                  onValueChange={setStoreId}
                  disabled={submitting || storesLoading || stores.length === 0}
                >
                  <SelectTrigger id="store">
                    <SelectValue
                      placeholder={
                        storesLoading
                          ? "Mağazalar yükleniyor..."
                          : stores.length === 0
                            ? "Mağaza bulunamadı"
                            : "Mağaza seçin..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {submitError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive">
                {submitError}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={submitting || !username || !password}
            >
              {submitting ? "Giriş yapılıyor..." : "Giriş Yap"}
            </Button>
          </form>
          <div className="mt-6 flex flex-col gap-1.5 border-t pt-4 text-center text-sm">
            <span className="text-muted-foreground">
              Restoran sahibi misin?{" "}
              <a
                href="/register"
                className="font-medium text-primary hover:underline"
              >
                Başvuru yap
              </a>
            </span>
            <a
              href="/supervisor/login"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Platform yöneticisi girişi
            </a>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
