"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Pizza, CheckCircle2 } from "lucide-react";
import { ApiError, registrations } from "@/lib/api";
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

/**
 * Public restaurant onboarding form. Submits a Pending registration that the
 * platform supervisor reviews from /supervisor/registrations.
 */
export default function RegisterPage() {
  const [storeName, setStoreName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!storeName.trim() || !contactName.trim() || !phone.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await registrations.create({
        storeName: storeName.trim(),
        contactName: contactName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail || err.message);
      } else {
        setError(String(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-10">
        <Card className="w-full">
          <CardHeader className="space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>Başvurunuz alındı</CardTitle>
              <CardDescription className="mt-1">
                Sistem yöneticisi başvurunuzu inceledikten sonra size dönüş
                yapacak. Onay sonrası mağaza ve yönetici hesabınız hazırlanır.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/login">Giriş ekranına dön</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-6 py-10">
      <Card className="w-full">
        <CardHeader className="space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Pizza className="h-6 w-6" />
          </div>
          <div>
            <CardTitle>Restoran Başvurusu</CardTitle>
            <CardDescription className="mt-1">
              NodaPos&apos;u kullanmak istediğinizi bize bildirin. Onay sonrası
              mağazanız ve yönetici hesabınız oluşturulur.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="storeName">Restoran / Mağaza Adı *</Label>
              <Input
                id="storeName"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contactName">Yetkili Ad Soyad *</Label>
              <Input
                id="contactName"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Telefon *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address">Adres</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Not</Label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={submitting}
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button
                type="submit"
                size="lg"
                disabled={
                  submitting ||
                  !storeName.trim() ||
                  !contactName.trim() ||
                  !phone.trim()
                }
              >
                {submitting ? "Gönderiliyor..." : "Başvuruyu Gönder"}
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
