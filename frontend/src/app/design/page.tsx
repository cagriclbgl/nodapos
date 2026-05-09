"use client";
import * as React from "react";
import { ChefHat, Cookie, Pizza, Plus, Trash2, Sparkles, Inbox } from "lucide-react";
import { Button } from "@/components/ui-v2/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui-v2/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-v2/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui-v2/sheet";
import { Input } from "@/components/ui-v2/input";
import { Label } from "@/components/ui-v2/label";
import { Badge } from "@/components/ui-v2/badge";
import { Skeleton } from "@/components/ui-v2/skeleton";
import { Separator } from "@/components/ui-v2/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-v2/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-v2/tabs";
import { EmptyState } from "@/components/ui-v2/empty-state";
import { Toaster, toast } from "@/components/ui-v2/toaster";

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors />
      <div className="mx-auto max-w-6xl space-y-12 p-8">
        <header className="space-y-2">
          <Badge variant="outline" className="gap-1">
            <Sparkles className="h-3 w-3" /> design preview
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight">PizzaPos · Design System</h1>
          <p className="text-muted-foreground">
            shadcn/ui (default zinc) komponentleri. Brand renkleri henüz uygulanmadı.
          </p>
        </header>

        {/* Tipografi */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Tipografi</h2>
          <div className="space-y-2 rounded-lg border bg-card p-6">
            <h1 className="text-4xl font-bold tracking-tight">H1 — 4xl bold</h1>
            <h2 className="text-3xl font-semibold tracking-tight">H2 — 3xl semibold</h2>
            <h3 className="text-2xl font-semibold">H3 — 2xl semibold</h3>
            <h4 className="text-xl font-semibold">H4 — xl semibold</h4>
            <h5 className="text-lg font-medium">H5 — lg medium</h5>
            <h6 className="text-base font-medium">H6 — base medium</h6>
            <p className="text-base">
              Body — base normal. Hızlı kahverengi tilki tembel köpeğin üzerinden atlar.
            </p>
            <p className="text-sm text-muted-foreground">
              Small muted — kasiyer notu / yardımcı metin.
            </p>
            <code className="font-mono text-sm">font-mono · 1234.56 ₺</code>
          </div>
        </section>

        {/* Buttons */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Button — variant × size</h2>
          <Card>
            <CardContent className="flex flex-wrap gap-3 p-6">
              {(["default", "destructive", "outline", "secondary", "ghost", "link"] as const).map(
                (v) => (
                  <Button key={v} variant={v}>
                    {v}
                  </Button>
                )
              )}
            </CardContent>
            <Separator />
            <CardContent className="flex flex-wrap items-end gap-3 p-6">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" aria-label="ekle">
                <Plus />
              </Button>
              <Button size="touch">Dokunmatik (POS)</Button>
            </CardContent>
            <Separator />
            <CardContent className="flex flex-wrap gap-3 p-6">
              <Button>
                <Plus /> Sipariş ekle
              </Button>
              <Button variant="destructive">
                <Trash2 /> Kalem sil
              </Button>
              <Button variant="outline" disabled>
                Disabled
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Cards */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Card</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Bugünün Cirosu</CardTitle>
                <CardDescription>Tüm tamamlanmış siparişler</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">₺ 12.480,00</div>
              </CardContent>
              <CardFooter>
                <Badge variant="secondary">+%12 dünden</Badge>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Aktif Masalar</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold">7 / 12</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Açık Sipariş</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold">14</CardContent>
            </Card>
          </div>
        </section>

        {/* Dialog & Sheet */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Dialog &amp; Sheet</h2>
          <div className="flex flex-wrap gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button>Dialog aç</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Sipariş iptal edilsin mi?</DialogTitle>
                  <DialogDescription>
                    Bu işlem geri alınamaz. Sipariş kalemleri silinecek.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline">Vazgeç</Button>
                  <Button variant="destructive">Evet, iptal et</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Bottom Sheet (POS)</Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[80vh]">
                <SheetHeader>
                  <SheetTitle>Pizza seçenekleri</SheetTitle>
                  <SheetDescription>Boyut, kenar ve ekstraları seçin.</SheetDescription>
                </SheetHeader>
                <div className="grid gap-4 py-4">
                  <Label htmlFor="size">Boyut</Label>
                  <Select>
                    <SelectTrigger id="size">
                      <SelectValue placeholder="Boyut seç..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sm">Küçük</SelectItem>
                      <SelectItem value="md">Orta</SelectItem>
                      <SelectItem value="lg">Büyük</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <SheetFooter>
                  <Button size="touch" className="w-full">
                    Sepete ekle
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Right Sheet</Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Müşteri detayı</SheetTitle>
                </SheetHeader>
              </SheetContent>
            </Sheet>
          </div>
        </section>

        {/* Form */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Form öğeleri</h2>
          <Card>
            <CardContent className="grid gap-4 p-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Müşteri adı</Label>
                <Input id="name" placeholder="Ahmet Yılmaz" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input id="phone" type="tel" placeholder="05XX XXX XX XX" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat">Kategori</Label>
                <Select>
                  <SelectTrigger id="cat">
                    <SelectValue placeholder="Kategori seç" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pizza">Pizzalar</SelectItem>
                    <SelectItem value="drinks">İçecekler</SelectItem>
                    <SelectItem value="sides">Yan ürünler</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button className="w-full">Kaydet</Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Tabs */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Tabs</h2>
          <Tabs defaultValue="tables" className="w-full">
            <TabsList>
              <TabsTrigger value="tables">
                <Pizza className="mr-2 h-4 w-4" /> Masalar
              </TabsTrigger>
              <TabsTrigger value="takeaway">
                <Cookie className="mr-2 h-4 w-4" /> Paket
              </TabsTrigger>
              <TabsTrigger value="delivery">
                <ChefHat className="mr-2 h-4 w-4" /> Kurye
              </TabsTrigger>
            </TabsList>
            <TabsContent value="tables">
              <Card>
                <CardContent className="p-6 text-muted-foreground">
                  Masa ızgarası burada.
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="takeaway">
              <Card>
                <CardContent className="p-6 text-muted-foreground">Paket siparişler.</CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="delivery">
              <Card>
                <CardContent className="p-6 text-muted-foreground">Kurye siparişleri.</CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </section>

        {/* Badges & Skeleton */}
        <section className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Badges</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge>default</Badge>
              <Badge variant="secondary">secondary</Badge>
              <Badge variant="destructive">destructive</Badge>
              <Badge variant="outline">outline</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Skeleton</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        </section>

        {/* EmptyState */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Empty state</h2>
          <EmptyState
            icon={Inbox}
            title="Henüz sipariş yok"
            description="Bugünkü ilk siparişin gelmesini bekliyoruz. Kasada yeni bir masa açabilirsin."
            action={
              <Button>
                <Plus /> Yeni masa aç
              </Button>
            }
          />
        </section>

        {/* Toast */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Toast (sonner)</h2>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => toast("Sipariş kaydedildi.")}>default</Button>
            <Button variant="outline" onClick={() => toast.success("Ödeme alındı.")}>
              success
            </Button>
            <Button variant="destructive" onClick={() => toast.error("Bağlantı hatası.")}>
              error
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast.message("Yeni müşteri", { description: "Adres kaydı oluşturuldu." })
              }
            >
              with desc
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
