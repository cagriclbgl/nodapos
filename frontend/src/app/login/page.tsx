"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pizza } from "lucide-react";
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

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, login } = useAuth();

  const [stores, setStores] = useState<StoreSummaryDto[]>([]);
  const [storeId, setStoreId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [storesError, setStoresError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
        if (list.length === 1) setStoreId(list[0].id);
      } catch (err) {
        if (cancelled) return;
        setStoresError(
          err instanceof ApiError ? err.detail || err.message : String(err)
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!storeId || !username || !password) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await login({ storeId, username, password });
      router.replace(res.user.role === "Manager" ? "/admin" : "/pos");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setSubmitError("Hatalı kullanıcı veya şifre.");
        } else if (err.status === 423) {
          router.push(`/setup?storeId=${encodeURIComponent(storeId)}`);
          return;
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
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-10">
      <Card className="w-full">
        <CardHeader className="space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Pizza className="h-6 w-6" />
          </div>
          <div>
            <CardTitle>PizzaPos Giriş</CardTitle>
            <CardDescription className="mt-1">
              Mağazanızı seçin ve kullanıcı bilgilerinizle giriş yapın.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            {storesError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive">
                Mağazalar yüklenemedi: {storesError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="store">Mağaza</Label>
              <Select
                value={storeId}
                onValueChange={setStoreId}
                disabled={submitting || stores.length === 0}
              >
                <SelectTrigger id="store">
                  <SelectValue
                    placeholder={
                      stores.length === 0 ? "Mağaza bulunamadı" : "Mağaza seçin..."
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            {submitError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive">
                {submitError}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={submitting || !storeId || !username || !password}
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
