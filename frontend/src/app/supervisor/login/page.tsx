"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  SupervisorAuthProvider,
  useSupervisorAuth,
} from "@/lib/supervisor-auth-context";
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

function LoginForm() {
  const router = useRouter();
  const { supervisor, loading, login } = useSupervisorAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && supervisor) router.replace("/supervisor");
  }, [loading, supervisor, router]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!username || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      await login({ username, password });
      router.replace("/supervisor");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 401
            ? "Hatalı kullanıcı veya şifre."
            : err.detail || err.message
        );
      } else {
        setError(String(err));
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
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <CardTitle>Supervisor Girişi</CardTitle>
            <CardDescription className="mt-1">
              Platform yöneticisi paneline erişin.
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
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive">
                {error}
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
        </CardContent>
      </Card>
    </main>
  );
}

export default function SupervisorLoginPage() {
  return (
    <SupervisorAuthProvider>
      <LoginForm />
    </SupervisorAuthProvider>
  );
}
