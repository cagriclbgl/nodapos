"use client";

import { FormEvent, use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pizza } from "lucide-react";
import { ApiError, api, auth } from "@/lib/api";
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

interface SearchParams {
  [key: string]: string | string[] | undefined;
}

/**
 * One-time bootstrap of the first Manager for a store. The backend returns
 * 423 Locked from /api/auth/login if the store has no users yet — the login
 * page redirects here when that happens.
 */
export default function SetupPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const router = useRouter();
  const { user, loading: authLoading, refresh } = useAuth();

  const params = use(searchParams);
  const storeIdParam = typeof params.storeId === "string" ? params.storeId : "";

  const [stores, setStores] = useState<StoreSummaryDto[]>([]);
  const [storeId, setStoreId] = useState(storeIdParam);
  const [storeName, setStoreName] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    router.replace(user.role === "Manager" ? "/admin" : "/pos");
  }, [authLoading, user, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.get<StoreSummaryDto[]>("/api/stores");
        if (cancelled) return;
        setStores(list);
        const found = list.find((s) => s.id === storeIdParam);
        if (found) setStoreName(found.name);
      } catch {
        // Non-fatal — we still have storeId from the query string.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeIdParam]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!storeId || !username || !password || !fullName) return;
    if (password !== confirm) {
      setSubmitError("Şifreler eşleşmiyor.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await auth.bootstrap({
        storeId,
        username,
        password,
        fullName,
      });
      await refresh();
      router.replace(res.user.role === "Manager" ? "/admin" : "/pos");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setSubmitError(
            "Bu mağazada zaten bir yönetici tanımlı. Giriş ekranına dönün."
          );
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

  if (!storeIdParam) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-10">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Kurulum</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Bu sayfa, henüz yönetici tanımlanmamış bir mağaza için kullanılır.
              Lütfen önce giriş ekranından bir mağaza seçin.
            </p>
            <Button asChild>
              <Link href="/login">Giriş ekranına dön</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-10">
      <Card className="w-full">
        <CardHeader className="space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Pizza className="h-6 w-6" />
          </div>
          <div>
            <CardTitle>İlk Kurulum</CardTitle>
            <CardDescription className="mt-1">
              {storeName ? (
                <>
                  <span className="font-medium">{storeName}</span> için ilk
                  yöneticiyi oluştur.
                </>
              ) : (
                <>Bu mağaza için ilk yöneticiyi oluştur.</>
              )}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            {stores.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="storeId">Mağaza ID</Label>
                <Input id="storeId" value={storeId} readOnly />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="fullName">Ad Soyad</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="username">Kullanıcı Adı</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">Şifre (tekrar)</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            {submitError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive">
                {submitError}
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button
                type="submit"
                size="lg"
                disabled={
                  submitting ||
                  !storeId ||
                  !username ||
                  !password ||
                  !fullName ||
                  password !== confirm
                }
              >
                {submitting ? "Oluşturuluyor..." : "Yönetici Oluştur"}
              </Button>
              <Link
                href="/login"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Giriş ekranına dön
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
