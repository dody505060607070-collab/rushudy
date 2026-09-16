import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  Check,
  FileText,
  Image as ImageIcon,
  Info,
  Link2,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Settings as SettingsIcon,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { Field, inputClass, textareaClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { Toggle } from "@/components/kit/Toggle";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "إعدادات الموقع — الرشودي للعقارات" },
      { name: "description", content: "التحكم في بيانات الموقع والتواصل وإعدادات التشغيل." },
      { property: "og:title", content: "إعدادات الموقع — الرشودي للعقارات" },
      { property: "og:description", content: "الهوية البصرية وبيانات التواصل والروابط والإحصائيات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

type SocialLinks = Record<string, string>;
type StatItem = { label: string; value: string };

type SettingsRow = {
  id: boolean;
  company_name: string;
  logo_url: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  email: string | null;
  address: string | null;
  about: string | null;
  currency: string;
  timezone: string;
  vat_rate: number;
  hold_minutes: number;
  max_property_images: number;
  max_pdf_mb: number;
  social_links: SocialLinks | null;
  stats: StatItem[] | null;
  maps_default_zoom: number;
};

const socialFields: { key: string; label: string }[] = [
  { key: "website", label: "الموقع الإلكتروني" },
  { key: "tiktok", label: "TikTok" },
  { key: "youtube", label: "YouTube" },
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "x", label: "X (تويتر)" },
  { key: "snapchat", label: "Snapchat" },
  { key: "linkedin", label: "LinkedIn" },
];

const tabs = [
  { key: "brand", label: "الهوية البصرية", icon: ImageIcon },
  { key: "contact", label: "التواصل", icon: Phone },
  { key: "invoices", label: "الفواتير", icon: FileText },
  { key: "info", label: "المعلومات", icon: Info },
  { key: "stats", label: "الإحصائيات", icon: BarChart3 },
  { key: "links", label: "الروابط", icon: Link2 },
  { key: "areas", label: "الأنواع والأحياء", icon: MapPin },
] as const;

function Note({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-border bg-accent/40 px-4 py-3 text-[12.5px] leading-6 text-muted-foreground">
      {text}
    </div>
  );
}

function SettingsPage() {
  const [tab, setTab] = useState<string>("brand");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data: row, error } = await supabase.from("app_settings").select("*").maybeSingle();
      if (error) throw error;
      return (row ?? null) as SettingsRow | null;
    },
  });

  const [form, setForm] = useState<SettingsRow | null>(null);
  useEffect(() => {
    if (data) setForm(data);
    else if (data === null)
      setForm({
        id: true,
        company_name: "الرشودي للعقارات",
        logo_url: null,
        phone: null,
        whatsapp_number: null,
        email: null,
        address: null,
        about: null,
        currency: "SAR",
        timezone: "Asia/Riyadh",
        vat_rate: 15,
        hold_minutes: 60,
        max_property_images: 20,
        max_pdf_mb: 20,
        social_links: {},
        stats: [],
        maps_default_zoom: 12,
      });
  }, [data]);

  const set = (patch: Partial<SettingsRow>) =>
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const payload = {
        id: true,
        company_name: form.company_name?.trim() || "الرشودي للعقارات",
        logo_url: form.logo_url?.trim() || null,
        phone: form.whatsapp_number?.trim() || null,
        whatsapp_number: form.whatsapp_number?.trim() || null,
        email: form.email?.trim() || null,
        address: form.address?.trim() || null,
        about: form.about?.trim() || null,
        currency: form.currency?.trim() || "SAR",
        timezone: form.timezone?.trim() || "Asia/Riyadh",
        vat_rate: Number(form.vat_rate) || 0,
        hold_minutes: Number(form.hold_minutes) || 0,
        max_property_images: Number(form.max_property_images) || 20,
        max_pdf_mb: Number(form.max_pdf_mb) || 20,
        maps_default_zoom: Number(form.maps_default_zoom) || 12,
        social_links: form.social_links ?? {},
        stats: form.stats ?? [],
      };
      const { error } = await supabase.from("app_settings").upsert(payload, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success("تم حفظ الإعدادات وستظهر على الموقع مباشرة");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحفظ"),
  });

  if (isLoading || !form) {
    return (
      <div className="surface-card grid place-items-center gap-2 px-6 py-20 text-center">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-[13px] text-muted-foreground">جاري تحميل الإعدادات…</p>
      </div>
    );
  }

  const links = form.social_links ?? {};
  const stats = form.stats ?? [];

  return (
    <>
      <PageHero
        title="إعدادات الموقع"
        subtitle="كل ما تحفظه هنا يظهر مباشرة على الموقع العام: البيانات، التواصل، الروابط والإحصائيات."
        icon={SettingsIcon}
        stats={[
          { value: String(Object.values(links).filter(Boolean).length), label: "رابط مفعّل" },
          { value: String(stats.length), label: "إحصائية" },
          { value: `${form.vat_rate}%`, label: "ضريبة القيمة المضافة" },
        ]}
      />

      <div className="surface-card overflow-hidden">
        <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-3">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-5 p-5">
          {tab === "brand" ? (
            <>
              <Note text="اسم الشركة وشعارها يظهران في رأس الموقع وفي الفواتير والرسائل." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="اسم الشركة">
                  <input
                    className={inputClass}
                    value={form.company_name ?? ""}
                    onChange={(e) => set({ company_name: e.target.value })}
                  />
                </Field>
                <Field label="رابط الشعار" hint="ارفع الشعار على أي مساحة عامة وضع الرابط هنا">
                  <input
                    className={inputClass}
                    dir="ltr"
                    value={form.logo_url ?? ""}
                    onChange={(e) => set({ logo_url: e.target.value })}
                  />
                </Field>
                {form.logo_url ? (
                  <div className="sm:col-span-2 grid place-items-center rounded-xl border border-dashed border-border bg-card py-6">
                    <img
                      src={form.logo_url}
                      alt="شعار الشركة"
                      className="max-h-24 w-auto object-contain"
                    />
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {tab === "contact" ? (
            <>
               <Note text="هذا الرقم يُستخدم معًا لأيقونة واتساب وأزرار الاتصال في الموقع." />
              <div className="grid gap-4 sm:grid-cols-2">
                 <Field label="رقم واتساب والمكالمات">
                  <input
                    className={inputClass}
                    dir="ltr"
                    value={form.whatsapp_number ?? ""}
                     onChange={(e) => set({ whatsapp_number: e.target.value, phone: e.target.value })}
                  />
                </Field>
                <Field label="البريد الإلكتروني">
                  <input
                    className={inputClass}
                    dir="ltr"
                    value={form.email ?? ""}
                    onChange={(e) => set({ email: e.target.value })}
                  />
                </Field>
                <Field label="العنوان">
                  <input
                    className={inputClass}
                    value={form.address ?? ""}
                    onChange={(e) => set({ address: e.target.value })}
                  />
                </Field>
              </div>
            </>
          ) : null}

          {tab === "invoices" ? (
            <>
              <Note text="نسبة الضريبة والعملة تُطبَّق تلقائيًا عند إنشاء الفواتير وحساب الإجماليات." />
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="العملة">
                  <input
                    className={inputClass}
                    dir="ltr"
                    value={form.currency ?? ""}
                    onChange={(e) => set({ currency: e.target.value })}
                  />
                </Field>
                <Field label="نسبة الضريبة %">
                  <input
                    className={inputClass}
                    dir="ltr"
                    inputMode="decimal"
                    value={String(form.vat_rate ?? 0)}
                    onChange={(e) => set({ vat_rate: Number(e.target.value) })}
                  />
                </Field>
                <Field label="أقصى حجم ملف PDF (ميجابايت)">
                  <input
                    className={inputClass}
                    dir="ltr"
                    inputMode="numeric"
                    value={String(form.max_pdf_mb ?? 20)}
                    onChange={(e) => set({ max_pdf_mb: Number(e.target.value) })}
                  />
                </Field>
              </div>
            </>
          ) : null}

          {tab === "info" ? (
            <>
              <Note text="نبذة الشركة تظهر في صفحة «من نحن»، وباقي القيم تضبط تشغيل الحجز والوسائط والخرائط." />
              <Field label="نبذة عن الشركة">
                <textarea
                  className={textareaClass}
                  value={form.about ?? ""}
                  onChange={(e) => set({ about: e.target.value })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="المنطقة الزمنية">
                  <input
                    className={inputClass}
                    dir="ltr"
                    value={form.timezone ?? ""}
                    onChange={(e) => set({ timezone: e.target.value })}
                  />
                </Field>
                <Field label="مدة الحجز المؤقت (دقيقة)">
                  <input
                    className={inputClass}
                    dir="ltr"
                    inputMode="numeric"
                    value={String(form.hold_minutes ?? 60)}
                    onChange={(e) => set({ hold_minutes: Number(e.target.value) })}
                  />
                </Field>
                <Field label="أقصى عدد صور للعقار">
                  <input
                    className={inputClass}
                    dir="ltr"
                    inputMode="numeric"
                    value={String(form.max_property_images ?? 20)}
                    onChange={(e) => set({ max_property_images: Number(e.target.value) })}
                  />
                </Field>
                <Field label="تكبير الخريطة الافتراضي">
                  <input
                    className={inputClass}
                    dir="ltr"
                    inputMode="numeric"
                    value={String(form.maps_default_zoom ?? 12)}
                    onChange={(e) => set({ maps_default_zoom: Number(e.target.value) })}
                  />
                </Field>
              </div>
            </>
          ) : null}

          {tab === "stats" ? (
            <>
              <Note text="الأرقام التي تظهر في شريط إحصائيات الصفحة الرئيسية (مثال: عدد العقارات، سنوات الخبرة)." />
              <div className="space-y-3">
                {stats.map((item, index) => (
                  <div key={index} className="flex flex-wrap items-end gap-3">
                    <Field label="العنوان" className="min-w-[200px] flex-1">
                      <input
                        className={inputClass}
                        value={item.label}
                        onChange={(e) => {
                          const next = [...stats];
                          next[index] = { ...item, label: e.target.value };
                          set({ stats: next });
                        }}
                      />
                    </Field>
                    <Field label="القيمة" className="w-40">
                      <input
                        className={inputClass}
                        dir="ltr"
                        value={item.value}
                        onChange={(e) => {
                          const next = [...stats];
                          next[index] = { ...item, value: e.target.value };
                          set({ stats: next });
                        }}
                      />
                    </Field>
                    <button
                      type="button"
                      onClick={() => set({ stats: stats.filter((_, i) => i !== index) })}
                      className="inline-flex h-10 items-center gap-1 rounded-lg border border-border px-3 text-[12.5px] font-semibold text-destructive"
                    >
                      <Trash2 className="size-4" />
                      حذف
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => set({ stats: [...stats, { label: "", value: "" }] })}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-[12.5px] font-semibold text-primary"
                >
                  <Plus className="size-4" />
                  إضافة إحصائية
                </button>
              </div>
            </>
          ) : null}

          {tab === "links" ? (
            <>
              <Note text="روابط حسابات التواصل تظهر في تذييل الموقع وصفحة «تواصل معنا». اتركها فارغة لإخفاء الأيقونة." />
              <div className="grid gap-4 sm:grid-cols-2">
                {socialFields.map((item) => (
                  <Field key={item.key} label={item.label}>
                    <input
                      className={inputClass}
                      dir="ltr"
                      placeholder="https://"
                      value={links[item.key] ?? ""}
                      onChange={(e) =>
                        set({ social_links: { ...links, [item.key]: e.target.value } })
                      }
                    />
                  </Field>
                ))}
              </div>
            </>
          ) : null}

          {tab === "areas" ? <AreasPanel /> : null}
        </div>
      </div>

      {tab !== "areas" ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-[13.5px] font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {save.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            حفظ الإعدادات
          </button>
        </div>
      ) : null}
    </>
  );
}

/* ------------------------------ الأنواع والأحياء ------------------------------ */

type City = { id: string; name: string; sort_order: number; is_active: boolean };
type District = {
  id: string;
  city_id: string | null;
  name: string;
  sort_order: number;
  is_active: boolean;
};
type PropertyType = { id: string; name: string; sort_order: number; is_active: boolean };

function AreasPanel() {
  const queryClient = useQueryClient();
  const [cityName, setCityName] = useState("");
  const [typeName, setTypeName] = useState("");
  const [districtName, setDistrictName] = useState("");
  const [activeCity, setActiveCity] = useState<string>("");

  const cities = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("id, name, sort_order, is_active")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data ?? []) as City[];
    },
  });

  const districts = useQuery({
    queryKey: ["districts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("districts")
        .select("id, city_id, name, sort_order, is_active")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data ?? []) as District[];
    },
  });

  const types = useQuery({
    queryKey: ["property-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_types")
        .select("id, name, sort_order, is_active")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data ?? []) as PropertyType[];
    },
  });

  const cityId = activeCity || cities.data?.[0]?.id || "";

  const refresh = (keys: string[]) =>
    keys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));

  const mutate = useMutation({
    mutationFn: async (op: { table: "cities" | "districts" | "property_types"; run: () => PromiseLike<{ error: unknown }> }) => {
      const { error } = await op.run();
      if (error) throw error;
      return op.table;
    },
    onSuccess: (table) => {
      refresh([table === "property_types" ? "property-types" : table, "public-properties"]);
      toast.success("تم تحديث القائمة");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر التحديث"),
  });

  const cityDistricts = (districts.data ?? []).filter((d) => d.city_id === cityId);

  return (
    <div className="space-y-5">
      <Note text="هذه القوائم تغذّي قوائم المدن والأحياء وأنواع العقار في نماذج إضافة العقار وفي فلاتر الموقع العام. أي عنصر تُوقفه يختفي من القوائم دون حذف بياناته." />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* المدن */}
        <section className="rounded-xl border border-border">
          <header className="border-b border-border px-4 py-3 text-[13.5px] font-bold">
            المدن ({cities.data?.length ?? 0})
          </header>
          <div className="flex gap-2 border-b border-border p-3">
            <input
              className={inputClass}
              placeholder="اسم المدينة"
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
            />
            <button
              type="button"
              disabled={!cityName.trim() || mutate.isPending}
              onClick={() =>
                mutate.mutate(
                  {
                    table: "cities",
                    run: () =>
                      supabase
                        .from("cities")
                        .insert({ name: cityName.trim(), sort_order: cities.data?.length ?? 0 }),
                  },
                  { onSuccess: () => setCityName("") },
                )
              }
              className="inline-flex h-10 items-center gap-1 rounded-lg bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Plus className="size-4" />
              إضافة
            </button>
          </div>
          <ul className="divide-y divide-border">
            {(cities.data ?? []).map((city) => (
              <li
                key={city.id}
                className={cn(
                  "flex items-center justify-between gap-2 px-4 py-2.5 text-[13px]",
                  city.id === cityId && "bg-accent/40",
                )}
              >
                <button
                  type="button"
                  onClick={() => setActiveCity(city.id)}
                  className="flex-1 text-start font-semibold"
                >
                  {city.name}
                  {city.id === cityId ? (
                    <Chip tone="primary">
                      <span className="text-[10.5px]">محدد</span>
                    </Chip>
                  ) : null}
                </button>
                <Toggle
                  label={`تفعيل ${city.name}`}
                  checked={city.is_active}
                  onChange={(value) =>
                    mutate.mutate({
                      table: "cities",
                      run: () =>
                        supabase.from("cities").update({ is_active: value }).eq("id", city.id),
                    })
                  }
                />
                <button
                  type="button"
                  aria-label={`حذف ${city.name}`}
                  onClick={() => {
                    if (window.confirm(`حذف المدينة "${city.name}"؟`))
                      mutate.mutate({
                        table: "cities",
                        run: () => supabase.from("cities").delete().eq("id", city.id),
                      });
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
            {!cities.data?.length ? (
              <li className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
                لا توجد مدن بعد
              </li>
            ) : null}
          </ul>
        </section>

        {/* الأحياء */}
        <section className="rounded-xl border border-border">
          <header className="border-b border-border px-4 py-3 text-[13.5px] font-bold">
            أحياء {cities.data?.find((c) => c.id === cityId)?.name ?? "—"} ({cityDistricts.length})
          </header>
          <div className="flex gap-2 border-b border-border p-3">
            <input
              className={inputClass}
              placeholder="اسم الحي"
              value={districtName}
              onChange={(e) => setDistrictName(e.target.value)}
            />
            <button
              type="button"
              disabled={!districtName.trim() || !cityId || mutate.isPending}
              onClick={() =>
                mutate.mutate(
                  {
                    table: "districts",
                    run: () =>
                      supabase.from("districts").insert({
                        name: districtName.trim(),
                        city_id: cityId,
                        sort_order: cityDistricts.length,
                      }),
                  },
                  { onSuccess: () => setDistrictName("") },
                )
              }
              className="inline-flex h-10 items-center gap-1 rounded-lg bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Plus className="size-4" />
              إضافة
            </button>
          </div>
          <ul className="max-h-[380px] divide-y divide-border overflow-y-auto">
            {cityDistricts.map((district) => (
              <li
                key={district.id}
                className="flex items-center justify-between gap-2 px-4 py-2.5 text-[13px]"
              >
                <span className="flex-1 font-semibold">{district.name}</span>
                <Toggle
                  label={`تفعيل ${district.name}`}
                  checked={district.is_active}
                  onChange={(value) =>
                    mutate.mutate({
                      table: "districts",
                      run: () =>
                        supabase
                          .from("districts")
                          .update({ is_active: value })
                          .eq("id", district.id),
                    })
                  }
                />
                <button
                  type="button"
                  aria-label={`حذف ${district.name}`}
                  onClick={() => {
                    if (window.confirm(`حذف الحي "${district.name}"؟`))
                      mutate.mutate({
                        table: "districts",
                        run: () => supabase.from("districts").delete().eq("id", district.id),
                      });
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
            {!cityDistricts.length ? (
              <li className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
                اختر مدينة ثم أضِف أحياءها
              </li>
            ) : null}
          </ul>
        </section>

        {/* أنواع العقار */}
        <section className="rounded-xl border border-border">
          <header className="border-b border-border px-4 py-3 text-[13.5px] font-bold">
            أنواع العقار ({types.data?.length ?? 0})
          </header>
          <div className="flex gap-2 border-b border-border p-3">
            <input
              className={inputClass}
              placeholder="مثال: شقة / فيلا / أرض"
              value={typeName}
              onChange={(e) => setTypeName(e.target.value)}
            />
            <button
              type="button"
              disabled={!typeName.trim() || mutate.isPending}
              onClick={() =>
                mutate.mutate(
                  {
                    table: "property_types",
                    run: () =>
                      supabase
                        .from("property_types")
                        .insert({ name: typeName.trim(), sort_order: types.data?.length ?? 0 }),
                  },
                  { onSuccess: () => setTypeName("") },
                )
              }
              className="inline-flex h-10 items-center gap-1 rounded-lg bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Plus className="size-4" />
              إضافة
            </button>
          </div>
          <ul className="max-h-[380px] divide-y divide-border overflow-y-auto">
            {(types.data ?? []).map((type) => (
              <li
                key={type.id}
                className="flex items-center justify-between gap-2 px-4 py-2.5 text-[13px]"
              >
                <span className="flex-1 font-semibold">{type.name}</span>
                <Toggle
                  label={`تفعيل ${type.name}`}
                  checked={type.is_active}
                  onChange={(value) =>
                    mutate.mutate({
                      table: "property_types",
                      run: () =>
                        supabase
                          .from("property_types")
                          .update({ is_active: value })
                          .eq("id", type.id),
                    })
                  }
                />
                <button
                  type="button"
                  aria-label={`حذف ${type.name}`}
                  onClick={() => {
                    if (window.confirm(`حذف النوع "${type.name}"؟`))
                      mutate.mutate({
                        table: "property_types",
                        run: () => supabase.from("property_types").delete().eq("id", type.id),
                      });
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
            {!types.data?.length ? (
              <li className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
                لا توجد أنواع بعد
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
