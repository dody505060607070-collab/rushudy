import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Home, ImagePlus, KeyRound, MapPin, Search, UserRound, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import heroImage from "@/assets/hero-list-property.jpg";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getStoredReferral } from "@/lib/marketing";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/list-property")({
  head: () => ({
    meta: [
      { title: "اعرض أو اطلب عقارك | الرشودي للعقارات" },
      { name: "description", content: "أرسل بيانات عقارك لعرضه أو اطلب عقاراً بمواصفاتك وسيتواصل معك فريق الرشودي." },
      { property: "og:title", content: "اعرض أو اطلب عقارك | الرشودي للعقارات" },
      { property: "og:description", content: "نموذج واضح لعرض العقار أو طلب عقار في بريدة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://alrashudi.sa/list-property" }],
  }),
  component: ListPropertyPage,
});

type Mode = "offer" | "request";
const propertyTypes = ["شقة", "فيلا", "أرض", "عمارة", "دور", "محل", "مكتب", "استراحة"];
const cities = ["بريدة", "عنيزة", "الرس", "البكيرية", "البدائع", "رياض الخبراء"];

function RequiredLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return <Label htmlFor={htmlFor} className="text-xs font-bold">{children}<span className="me-1 text-destructive">*</span></Label>;
}

function PurposeChoice({ value, selected, icon: Icon, label, onClick }: { value: string; selected: boolean; icon: typeof Home; label: string; onClick: (value: string) => void }) {
  return <Button type="button" variant="outline" onClick={() => onClick(value)} className={cn("h-24 flex-1 flex-col gap-2 text-sm", selected && "border-primary bg-accent text-primary ring-1 ring-primary")}><Icon className="size-6" />{label}</Button>;
}

function ListPropertyPage() {
  const [mode, setMode] = useState<Mode>("offer");
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [isBroker, setIsBroker] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", phone: "", purpose: "sale", property_type: "", city: "بريدة", district: "", asking_price: "", description: "", budget_min: "", budget_max: "", map_url: "", broker_name: "", broker_phone: "" });
  const set = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const switchMode = (next: Mode) => { setMode(next); setForm((prev) => ({ ...prev, purpose: next === "offer" ? "sale" : "rent" })); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.full_name.trim() || !form.phone.trim()) { toast.error("الاسم ورقم الجوال مطلوبان"); return; }
    if (mode === "offer" && (!form.property_type || !form.description || !form.asking_price || !form.map_url)) { toast.error("أكمل بيانات العقار المطلوبة"); return; }
    setBusy(true);
    try {
      const referral = getStoredReferral();
      if (mode === "offer") {
        const attachments: { path: string; name: string; size: number; type: string }[] = [];
        for (const file of images) {
          const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
          const path = `public/${crypto.randomUUID()}.${extension}`;
          const upload = await supabase.storage.from("listing-request-media").upload(path, file, { contentType: file.type });
          if (upload.error) throw upload.error;
          attachments.push({ path, name: file.name, size: file.size, type: file.type });
        }
        const notes = [form.description, additionalNotes, isBroker && form.broker_phone ? `جوال الوسيط: ${form.broker_phone}` : ""].filter(Boolean).join("\n\n");
        const result = await supabase.from("listing_requests").insert({ full_name: form.full_name, phone: form.phone, purpose: form.purpose, property_type: form.property_type, city: form.city || null, district: form.district || null, asking_price: form.asking_price, description: notes, map_url: form.map_url, attachments, referral_code: referral?.code ?? null });
        if (result.error) throw result.error;
      } else {
        const result = await supabase.from("supply_requests").insert({ full_name: form.full_name, phone: form.phone, request_type: form.purpose, city: form.city || null, districts: form.district || null, property_type: form.property_type || null, requester_type: isBroker ? "broker" : "client", broker_name: null, broker_phone: isBroker ? form.broker_phone || null : null, budget_min: form.budget_min ? Number(form.budget_min) : null, budget_max: form.budget_max ? Number(form.budget_max) : null, requester_notes: form.description || null, referral_code: referral?.code ?? null });
        if (result.error) throw result.error;
      }
      try { const { reportPublicRequest } = await import("@/lib/automation.functions"); await reportPublicRequest({ data: { full_name: form.full_name, phone: form.phone, purpose: form.purpose, city: form.city || undefined, property_type: form.property_type || undefined, request_kind: mode === "offer" ? "listing" : "supply" } }); } catch { /* الطلب محفوظ حتى عند تعذر رسالة التأكيد */ }
      toast.success("تم إرسال طلبك بنجاح");
      void navigate({ to: "/thank-you" });
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذّر إرسال الطلب"); }
    finally { setBusy(false); }
  };

  return <SiteLayout>
    <section className="relative isolate flex min-h-[380px] items-center justify-center overflow-hidden md:min-h-[440px]" dir="rtl">
      <img src={heroImage} alt="اعرض أو اطلب عقارك" width={1920} height={1080} className="absolute inset-0 -z-20 size-full object-cover" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-primary/70 mix-blend-multiply" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-foreground/45 via-transparent to-foreground/35" />
      <div className="px-4 py-20 text-center text-white">
        <p className="animate-pop-in text-sm font-extrabold drop-shadow md:text-base">خدمة اعرض عقارك</p>
        <h1 className="animate-pop-in mt-1 font-display text-[42px] font-black leading-[1.15] drop-shadow-lg sm:text-6xl md:text-7xl">
          اعرض أو اطلب عقارك
        </h1>
        <p className="animate-pop-in mx-auto mt-4 max-w-2xl text-sm font-semibold leading-8 text-white/90 drop-shadow md:text-base" style={{ animationDelay: "180ms" }}>
          أوصل عقارك للمهتمين، أو شاركنا مواصفات طلبك وسنساعدك في الوصول للخيار المناسب.
        </p>
        <nav aria-label="مسار الصفحة" className="animate-pop-in mt-5 text-xs font-semibold text-white/75 md:text-sm" style={{ animationDelay: "300ms" }}>
          <Link to="/" className="hover:text-white">الرئيسية</Link>
          <span className="mx-2">/</span>
          <span>اعرض أو اطلب</span>
        </nav>
      </div>
    </section>
    <main className="bg-secondary/40 px-4 py-8 sm:py-12" dir="rtl">
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg border border-border bg-card p-1 shadow-card">
        <Button type="button" variant={mode === "offer" ? "default" : "ghost"} onClick={() => switchMode("offer")} className="h-11"><Home />اعرض عقارك</Button>
        <Button type="button" variant={mode === "request" ? "default" : "ghost"} onClick={() => switchMode("request")} className="h-11"><Search />اطلب عقارك</Button>
      </div>

      <form onSubmit={submit} className="overflow-hidden rounded-xl border border-border bg-card shadow-float">
        <header className="border-b border-border bg-accent px-5 py-4 sm:px-7">
          <h2 className="text-lg font-extrabold text-primary">{mode === "offer" ? "بيانات العقار" : "بيانات طلب العقار"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{mode === "offer" ? "يرجى تعبئة جميع الحقول المطلوبة بدقة" : "أخبرنا بما تبحث عنه وسنتواصل معك بأسرع وقت"}</p>
        </header>

        <div className="space-y-5 p-5 sm:p-7">
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><RequiredLabel htmlFor="name">الاسم</RequiredLabel><Input id="name" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="الاسم الكامل" /></div><div className="space-y-2"><RequiredLabel htmlFor="phone">رقم الجوال</RequiredLabel><Input id="phone" dir="ltr" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="05xxxxxxxx" /></div></div>
          <div className="space-y-2"><RequiredLabel htmlFor="purpose">{mode === "offer" ? "النوع" : "نوع الطلب"}</RequiredLabel><div className="flex gap-3"><PurposeChoice value="sale" selected={form.purpose === "sale"} icon={Home} label={mode === "offer" ? "للبيع" : "أبي أشتري"} onClick={(v) => set("purpose", v)} /><PurposeChoice value="rent" selected={form.purpose === "rent"} icon={KeyRound} label={mode === "offer" ? "للإيجار" : "أبي أستأجر"} onClick={(v) => set("purpose", v)} /></div></div>

          {mode === "offer" ? <>
            <div className="space-y-2"><RequiredLabel htmlFor="property_type">نوع العقار</RequiredLabel><select id="property_type" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.property_type} onChange={(e) => set("property_type", e.target.value)}><option value="">اختر نوع العقار</option>{propertyTypes.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="space-y-2"><RequiredLabel htmlFor="district">الحي</RequiredLabel><select id="district" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.district} onChange={(e) => set("district", e.target.value)}><option value="">اختر الحي</option><option>شمال بريدة</option><option>وسط بريدة</option><option>شرق بريدة</option><option>غرب بريدة</option><option>جنوب بريدة</option></select></div>
            <div className="space-y-2"><RequiredLabel htmlFor="description">وصف العقار</RequiredLabel><Textarea id="description" rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="اكتب وصفاً تفصيلياً للعقار (المساحة، عدد الغرف، المميزات...)" /></div>
            <div className="space-y-2"><RequiredLabel htmlFor="asking_price">السعر المطلوب</RequiredLabel><Input id="asking_price" value={form.asking_price} onChange={(e) => set("asking_price", e.target.value)} placeholder="مثال: 150,000 ريال أو قابل للتفاوض" /></div>
            <div className="space-y-2"><RequiredLabel htmlFor="map_url">موقع العقار على خرائط جوجل</RequiredLabel><div className="relative"><MapPin className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="map_url" dir="ltr" className="pe-10" value={form.map_url} onChange={(e) => set("map_url", e.target.value)} placeholder="https://maps.app.goo.gl/..." /></div><p className="text-[11px] text-muted-foreground">افتح خرائط جوجل، انسخ موقع العقار ثم الصق الرابط هنا.</p></div>
            <div className="space-y-2"><RequiredLabel htmlFor="images">صور العقار (بحد أقصى 3 صور)</RequiredLabel><label htmlFor="images" className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-secondary/40 p-5 text-center transition hover:border-primary"><ImagePlus className="size-7 text-muted-foreground" /><span className="text-xs font-semibold">اسحب الصور هنا أو اضغط للاختيار</span><span className="text-[10px] text-muted-foreground">JPG، PNG، WEBP — بحد أقصى 8 ميجابايت للصورة</span><input id="images" type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(event) => { const selected = Array.from(event.target.files ?? []).filter((file) => file.size <= 8 * 1024 * 1024); setImages((current) => [...current, ...selected].slice(0, 3)); event.target.value = ""; }} /></label>{images.length ? <ul className="grid gap-2 sm:grid-cols-3">{images.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-xs"><span className="truncate">{file.name}</span><Button type="button" variant="ghost" size="icon-sm" aria-label="حذف الصورة" onClick={() => setImages((current) => current.filter((_, i) => i !== index))}><X className="text-destructive" /></Button></li>)}</ul> : null}</div>
          </> : <>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><RequiredLabel htmlFor="city">المدينة</RequiredLabel><select id="city" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.city} onChange={(e) => set("city", e.target.value)}>{cities.map((item) => <option key={item}>{item}</option>)}</select></div><div className="space-y-2"><Label htmlFor="district" className="text-xs font-bold">الحي</Label><Input id="district" value={form.district} onChange={(e) => set("district", e.target.value)} placeholder="مثال: حي بريدة" /></div></div>
            <div className="space-y-2"><Label htmlFor="property_type" className="text-xs font-bold">نوع العقار</Label><select id="property_type" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.property_type} onChange={(e) => set("property_type", e.target.value)}><option value="">اختر نوع العقار</option>{propertyTypes.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="budget_min" className="text-xs font-bold">الميزانية بالريال</Label><p className="text-[11px] text-muted-foreground">حدد نطاق الميزانية التقريبي</p><div className="grid gap-3 sm:grid-cols-2"><Input id="budget_min" type="number" value={form.budget_min} onChange={(e) => set("budget_min", e.target.value)} placeholder="من — مثال: 15000" /><Input type="number" value={form.budget_max} onChange={(e) => set("budget_max", e.target.value)} placeholder="إلى — مثال: 23000" /></div></div>
          </>}

          <section className="rounded-lg border border-border bg-secondary/25"><div className="flex items-center justify-between gap-3 border-b border-border p-3"><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground"><UserRound className="size-4" /></span><div><p className="text-xs font-bold">أنا وسيط عقاري</p><p className="text-[10px] text-muted-foreground">لن يظهر اسم الوسيط في الموقع</p></div></div><Switch checked={isBroker} onCheckedChange={setIsBroker} aria-label="أنا وسيط عقاري" /></div>{isBroker ? <div className="p-3"><div className="space-y-2"><RequiredLabel htmlFor="broker_phone">جوال الوسيط</RequiredLabel><Input id="broker_phone" dir="ltr" value={form.broker_phone} onChange={(e) => set("broker_phone", e.target.value)} placeholder="05xxxxxxxx" /></div></div> : null}</section>
          <div className="space-y-2"><Label htmlFor="notes" className="text-xs font-bold">{mode === "offer" ? "ملاحظات إضافية" : "مواصفات العقار المطلوبة"}</Label><Textarea id="notes" rows={4} value={mode === "offer" ? additionalNotes : form.description} onChange={(e) => mode === "offer" ? setAdditionalNotes(e.target.value) : set("description", e.target.value)} placeholder={mode === "offer" ? "أي تفاصيل إضافية تساعدنا في إيجاد المشتري المناسب لك..." : "اكتب وصفاً تفصيلياً للعقار المطلوب..."} /></div>
          <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "جارٍ الإرسال..." : "إرسال الطلب"}</Button>
        </div>
      </form>
    </div>
  </main></SiteLayout>;
}