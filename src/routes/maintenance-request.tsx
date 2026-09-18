import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Wrench } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

const TITLE = "طلب صيانة | الرشودي للعقارات";
const DESC = "أرسل بلاغ صيانة لوحدتك في دقيقة واحدة وسيتواصل معك فريق الصيانة في الرشودي للعقارات.";

export const Route = createFileRoute("/maintenance-request")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://alrashudi.sa/maintenance-request" }],
  }),
  component: MaintenanceRequestPage,
});

const categories = [
  { key: "plumbing", label: "سباكة" },
  { key: "electrical", label: "كهرباء" },
  { key: "ac", label: "تكييف" },
  { key: "elevator", label: "مصعد" },
  { key: "cleaning", label: "نظافة" },
  { key: "structure", label: "إنشائي" },
  { key: "other", label: "أخرى" },
];

const priorities = [
  { key: "normal", label: "عادية" },
  { key: "high", label: "عالية" },
  { key: "urgent", label: "طارئة" },
];

function MaintenanceRequestPage() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    reporter_name: "",
    reporter_phone: "",
    category: "other",
    priority: "normal",
    description: "",
  });
  const set = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.reporter_name.trim() || !form.reporter_phone.trim() || !form.description.trim()) {
      toast.error("الاسم والجوال ووصف المشكلة مطلوبة");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("maintenance_requests").insert({
        reporter_name: form.reporter_name.trim(),
        reporter_phone: form.reporter_phone.trim(),
        category: form.category,
        priority: form.priority,
        description: form.description.trim(),
        status: "new",
        cost: 0,
      });
      if (error) throw error;
      setDone(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر إرسال البلاغ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SiteLayout>
      <section className="mx-auto w-full max-w-3xl px-4 py-12" dir="rtl">
        <header className="mb-8 text-center">
          <span className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-accent text-primary">
            <Wrench className="size-6" />
          </span>
          <h1 className="text-2xl font-bold text-foreground">طلب صيانة</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            صف المشكلة وسنتواصل معك لتحديد موعد الفني. لا تُرسل أي رسائل تلقائية؛ فريقنا يتواصل معك مباشرة.
          </p>
        </header>

        {done ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-card">
            <CheckCircle2 className="mx-auto size-10 text-primary" />
            <h2 className="mt-3 text-lg font-bold text-foreground">تم استلام بلاغك</h2>
            <p className="mt-2 text-sm text-muted-foreground">سيتواصل معك فريق الصيانة في أقرب وقت.</p>
            <Link to="/" className="mt-6 inline-block">
              <Button variant="outline">العودة للرئيسية</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-card sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-xs font-bold">الاسم</Label>
              <Input id="name" value={form.reporter_name} onChange={(e) => set("reporter_name", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone" className="text-xs font-bold">رقم الجوال</Label>
              <Input id="phone" inputMode="tel" value={form.reporter_phone} onChange={(e) => set("reporter_phone", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category" className="text-xs font-bold">نوع الصيانة</Label>
              <select
                id="category"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="priority" className="text-xs font-bold">درجة الأهمية</Label>
              <select
                id="priority"
                value={form.priority}
                onChange={(e) => set("priority", e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                {priorities.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="description" className="text-xs font-bold">وصف المشكلة</Label>
              <Textarea
                id="description"
                rows={5}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="مثال: تسريب ماء أسفل مغسلة المطبخ منذ يومين."
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "جارٍ الإرسال…" : "إرسال البلاغ"}
              </Button>
            </div>
          </form>
        )}
      </section>
    </SiteLayout>
  );
}
