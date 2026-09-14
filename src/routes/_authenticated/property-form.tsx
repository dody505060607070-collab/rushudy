import { uploadMedia, mediaUrl } from "@/lib/media";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  Check,
  Film,
  Image as ImageIcon,
  Loader2,
  MapPin,
  NotebookPen,
  Plus,
  ShieldCheck,

  Trash2,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Field, inputClass, textareaClass } from "@/components/kit/Modal";
import { SOCIAL_PLATFORMS, SocialGlyph } from "@/components/site/SocialIcons";
import { PageHero } from "@/components/kit/PageHero";
import { Toggle } from "@/components/kit/Toggle";
import { supabase } from "@/integrations/supabase/client";
import { resolvePropertyCoordinates } from "@/lib/geo.functions";

export const Route = createFileRoute("/_authenticated/property-form")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search["id"] === "string" ? (search["id"] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "إضافة / تعديل عقار | الرشودي للعقارات" },
      {
        name: "description",
        content: "نموذج كامل لإضافة عقار: البيانات، السعر، الموقع، الصور، الفيديوهات والملاحظات الداخلية.",
      },
      { property: "og:title", content: "إضافة / تعديل عقار | الرشودي للعقارات" },
      { property: "og:description", content: "نموذج كامل لبيانات العقار ووسائطه وموقعه على الخريطة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PropertyFormPage,
});

type MediaRow = { id: string; url: string; sort_order: number; is_cover?: boolean; title?: string | null };

const DEFAULT_SALE_GUARANTEES = [
  { name: "الأنابيب الخضراء", years: 15 },
  { name: "نيو باور", years: 5 },
  { name: "أسلاك وكابلات الرياض", years: 25 },
  { name: "كهرباء الفنار", years: 25 },
  { name: "الهيكل الإنشائي", years: 10 },
] as const;

const statusOptions: [string, string][] = [
  ["available", "متاح"],
  ["reserved", "محجوز"],
  ["rented", "مؤجر"],
  ["sold", "مبيع"],
  ["hidden", "مخفي"],
];

const emptyForm = {
  name: "",
  code: "",
  purpose: "rent",
  rent_period: "yearly",
  property_type: "",
  city: "بريدة",
  district: "",
  price_text: "",
  price_value: "",
  status: "available",
  description: "",
  map_url: "",
  latitude: "",
  longitude: "",
  whatsapp_number: "",
  link_youtube: "",
  link_tiktok: "",
  link_instagram: "",
  link_snapchat: "",
  link_x: "",
  link_facebook: "",
  link_tour: "",
  sort_order: "0",
  internal_notes: "",
  is_visible: true,
  is_featured: false,
  needs_review: false,
};

type FormState = typeof emptyForm;

function SectionCard({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: typeof Building2;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-card overflow-hidden">
      <header className="flex items-center gap-3 border-b border-border bg-accent/40 px-5 py-3.5">
        <div className="grid size-9 place-items-center rounded-lg border border-border bg-card text-primary">
          <Icon className="size-4" />
        </div>
        <div>
          <h2 className="text-[14px] font-bold text-foreground">{title}</h2>
          <p className="text-[12px] text-muted-foreground">{subtitle}</p>
        </div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function PropertyFormPage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [guaranteeName, setGuaranteeName] = useState("");
  const [guaranteeYears, setGuaranteeYears] = useState("");
  const [step, setStep] = useState(0);


  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  // تحديد خط الطول والعرض تلقائياً من رابط خرائط جوجل
  const [geoBusy, setGeoBusy] = useState(false);
  const mapUrlValue = form.map_url.trim();
  const lastResolvedUrl = useRef("");

  useEffect(() => {
    if (!mapUrlValue || !/^https?:\/\//i.test(mapUrlValue)) return;
    if (lastResolvedUrl.current === mapUrlValue) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      lastResolvedUrl.current = mapUrlValue;
      setGeoBusy(true);
      try {
        const coords = await resolvePropertyCoordinates({ data: { mapUrl: mapUrlValue } });
        if (cancelled) return;
        if (coords) {
          setForm((prev) => ({
            ...prev,
            latitude: String(coords.latitude),
            longitude: String(coords.longitude),
          }));
          toast.success("تم تحديد موقع العقار من الرابط");
        } else {
          toast.error("تعذّر استخراج الموقع من هذا الرابط، أدخل الإحداثيات يدوياً");
        }
      } catch {
        if (!cancelled) toast.error("تعذّر قراءة الرابط الآن");
      } finally {
        if (!cancelled) setGeoBusy(false);
      }
    }, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mapUrlValue]);


  const property = useQuery({
    queryKey: ["property", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const cities = useQuery({
    queryKey: ["cities", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("id, name")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const districts = useQuery({
    queryKey: ["districts", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("districts")
        .select("id, name, city_id")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const types = useQuery({
    queryKey: ["property-types", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_types")
        .select("id, name")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const owners = useQuery({
    queryKey: ["contacts", "owners", "select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, full_name")
        .contains("roles", ["owner"])
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [ownerId, setOwnerId] = useState("");

  useEffect(() => {
    const row = property.data;
    if (!row) return;
    setForm({
      name: row.name ?? "",
      code: row.code ?? "",
      purpose: row.purpose ?? "rent",
      rent_period: row.rent_period ?? "yearly",
      property_type: row.property_type ?? "",
      city: row.city ?? "",
      district: row.district ?? "",
      price_text: row.price_text ?? "",
      price_value: row.price_value != null ? String(row.price_value) : "",
      status: row.status ?? "available",
      description: row.description ?? "",
      map_url: row.map_url ?? "",
      latitude: row.latitude != null ? String(row.latitude) : "",
      longitude: row.longitude != null ? String(row.longitude) : "",
      whatsapp_number: row.whatsapp_number ?? "",
      link_youtube: row.link_youtube ?? "",
      link_tiktok: row.link_tiktok ?? "",
      link_instagram: row.link_instagram ?? "",
      link_snapchat: row.link_snapchat ?? "",
      link_x: row.link_x ?? "",
      link_facebook: row.link_facebook ?? "",
      link_tour: row.link_tour ?? "",
      sort_order: String(row.sort_order ?? 0),
      internal_notes: row.internal_notes ?? "",
      is_visible: Boolean(row.is_visible),
      is_featured: Boolean(row.is_featured),
      needs_review: Boolean(row.needs_review),
    });
    setOwnerId(row.owner_id ?? "");
  }, [property.data]);

  const images = useQuery({
    queryKey: ["property-images", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_images")
        .select("id, url, sort_order, is_cover")
        .eq("property_id", id)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as MediaRow[];
    },
  });

  const videos = useQuery({
    queryKey: ["property-videos", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_videos")
        .select("id, url, title, sort_order")
        .eq("property_id", id)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as MediaRow[];
    },
  });

  const guarantees = useQuery({
    queryKey: ["property-guarantees", id],
    enabled: Boolean(id) && form.purpose === "sale",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_guarantees")
        .select("id, name, years, sort_order")
        .eq("property_id", id)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; years: number; sort_order: number }[];
    },
  });

  const presets = useQuery({
    queryKey: ["sale-guarantees", "active"],
    enabled: form.purpose === "sale",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_guarantees")
        .select("id, name, default_years")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; default_years: number | null }[];
    },
  });

  const refreshGuarantees = () =>
    queryClient.invalidateQueries({ queryKey: ["property-guarantees", id] });

  const addGuarantee = useMutation({
    mutationFn: async (input: { name: string; years: number }) => {
      if (!id) throw new Error("احفظ العقار أولًا");
      if (form.purpose !== "sale") throw new Error("الضمانات متاحة لعقارات البيع فقط");
      if (!input.name.trim()) throw new Error("اكتب اسم الضمان");
      const { error } = await supabase.from("property_guarantees").insert({
        property_id: id,
        name: input.name.trim(),
        years: input.years,
        sort_order: guarantees.data?.length ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setGuaranteeName("");
      setGuaranteeYears("");
      refreshGuarantees();
      queryClient.invalidateQueries({ queryKey: ["public-property"] });
      toast.success("تمت إضافة الضمان");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّرت الإضافة"),
  });

  const updateGuarantee = useMutation({
    mutationFn: async (input: { rowId: string; name?: string; years?: number }) => {
      const { error } = await supabase
        .from("property_guarantees")
        .update({
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.years !== undefined ? { years: input.years } : {}),
        })
        .eq("id", input.rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      refreshGuarantees();
      toast.success("تم تحديث الضمان");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر التحديث"),
  });

  const removeGuarantee = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase.from("property_guarantees").delete().eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      refreshGuarantees();
      toast.success("تم حذف الضمان");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحذف"),
  });



  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["properties"] });
    queryClient.invalidateQueries({ queryKey: ["public-properties"] });
    queryClient.invalidateQueries({ queryKey: ["property", id] });
    queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("اسم العقار مطلوب");
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || `P-${Date.now().toString(36).toUpperCase()}`,
        purpose: form.purpose,
        property_type: form.property_type.trim() || null,
        city: form.city.trim() || null,
        district: form.district.trim() || null,
        price_text: form.price_text.trim() || null,
        price_value: form.price_value ? Number(form.price_value) : null,
        status: form.status,
        description: form.description.trim() || null,
        map_url: form.map_url.trim() || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        whatsapp_number: form.whatsapp_number.trim() || null,
        ...Object.fromEntries(
          SOCIAL_PLATFORMS.map((p) => [p.key, (form[p.key] as string).trim() || null]),
        ),
        sort_order: Number(form.sort_order) || 0,
        internal_notes: form.internal_notes.trim() || null,
        owner_id: ownerId || null,
        is_visible: form.is_visible,
        is_featured: form.is_featured,
        needs_review: form.needs_review,
      };
      if (payload.latitude == null || payload.longitude == null) {
        try {
          const coords = await resolvePropertyCoordinates({
            data: {
              mapUrl: payload.map_url,
              hint: [payload.name, payload.district, payload.city, "بريدة، السعودية"]
                .filter(Boolean)
                .join("، "),
            },
          });
          if (coords) {
            payload.latitude = coords.latitude;
            payload.longitude = coords.longitude;
          }
        } catch {
          /* الموقع اختياري — لا نمنع الحفظ */
        }
      }
      if (id) {
        const { error } = await supabase.from("properties").update(payload).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("properties")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (newId) => {
      invalidateAll();
      toast.success(id ? "تم تحديث العقار" : "تم إضافة العقار");
      if (!id) navigate({ to: "/property-form", search: { id: newId } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحفظ"),
  });

  const addImage = useMutation({
    mutationFn: async (url: string) => {
      if (!id) throw new Error("احفظ العقار أولًا ثم أضِف الصور");
      const { error } = await supabase.from("property_images").insert({
        property_id: id,
        url,
        sort_order: images.data?.length ?? 0,
        is_cover: !images.data?.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setImageUrl("");
      queryClient.invalidateQueries({ queryKey: ["property-images", id] });
      queryClient.invalidateQueries({ queryKey: ["public-properties"] });
      toast.success("تمت إضافة الصورة");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّرت إضافة الصورة"),
  });

  const removeMedia = useMutation({
    mutationFn: async (input: { table: "property_images" | "property_videos"; rowId: string }) => {
      const { error } = await supabase.from(input.table).delete().eq("id", input.rowId);
      if (error) throw error;
      return input.table;
    },
    onSuccess: (table) => {
      queryClient.invalidateQueries({
        queryKey: [table === "property_images" ? "property-images" : "property-videos", id],
      });
      queryClient.invalidateQueries({ queryKey: ["public-properties"] });
      toast.success("تم الحذف");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحذف"),
  });

  const setCover = useMutation({
    mutationFn: async (rowId: string) => {
      if (!id) return;
      const clear = await supabase
        .from("property_images")
        .update({ is_cover: false })
        .eq("property_id", id);
      if (clear.error) throw clear.error;
      const { error } = await supabase
        .from("property_images")
        .update({ is_cover: true })
        .eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property-images", id] });
      queryClient.invalidateQueries({ queryKey: ["public-properties"] });
      toast.success("تم تعيين الصورة الرئيسية");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر التحديث"),
  });

  const addVideo = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("احفظ العقار أولًا ثم أضِف الفيديوهات");
      if (!videoUrl.trim()) throw new Error("ضع رابط الفيديو");
      const { error } = await supabase.from("property_videos").insert({
        property_id: id,
        url: videoUrl.trim(),
        title: videoTitle.trim() || null,
        sort_order: videos.data?.length ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setVideoUrl("");
      setVideoTitle("");
      queryClient.invalidateQueries({ queryKey: ["property-videos", id] });
      toast.success("تمت إضافة الفيديو");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّرت الإضافة"),
  });

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!id) {
      toast.error("احفظ العقار أولًا ثم ارفع الصور");
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { url } = await uploadMedia("property-media", path, file);
        await addImage.mutateAsync(url);
      }
      toast.success("تم رفع الصور");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر رفع الملفات");
    } finally {
      setUploading(false);
    }
  };

  const cityDistricts = (districts.data ?? []).filter((d) => {
    const city = cities.data?.find((c) => c.name === form.city);
    return city ? d.city_id === city.id : true;
  });
  const steps = ["البيانات", "السعر والموقع", "الروابط والضمانات", "الصور والملاحظات"];

  return (
    <>
      <PageHero
        title={id ? "تعديل عقار" : "إضافة عقار جديد"}
        subtitle="املأ البيانات بالترتيب؛ العقار يظهر على الموقع العام بمجرد تفعيل «مرئي على الموقع»."
        icon={Building2}
      />

      <div className="flex items-center justify-between gap-3">
        <Link
          to="/properties"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <ArrowRight className="size-4" />
          رجوع لقائمة العقارات
        </Link>
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-[13px] font-bold text-primary-foreground disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {id ? "حفظ التعديلات" : "حفظ العقار"}
        </button>
      </div>

      <nav aria-label="خطوات نموذج العقار" className="surface-card grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
        {steps.map((label, index) => <button key={label} type="button" onClick={() => setStep(index)} className={`rounded-lg px-3 py-2 text-[12.5px] font-bold transition ${step === index ? "bg-primary text-primary-foreground" : index < step ? "bg-success/12 text-success" : "bg-secondary text-muted-foreground"}`}><span className="me-1">{index + 1}.</span>{label}</button>)}
      </nav>

      {step === 0 ? <>
      <SectionCard
        title="البيانات الأساسية"
        subtitle="اسم العقار وكوده والغرض منه ونوعه وموقعه الإداري."
        icon={Building2}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="اسم العقار" className="sm:col-span-2">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="مثال: شقة في حي الرحاب"
            />
          </Field>
          <Field label="كود العقار" hint="يُولَّد تلقائيًا إذا تركته فارغًا">
            <input
              className={inputClass}
              dir="ltr"
              value={form.code}
              onChange={(e) => set({ code: e.target.value })}
            />
          </Field>
          <Field label="الغرض">
            <select
              className={inputClass}
              value={form.purpose}
              onChange={(e) => set({ purpose: e.target.value })}
            >
              <option value="rent">إيجار</option>
              <option value="sale">بيع</option>
              <option value="investment">استثمار</option>
            </select>
          </Field>
          <Field label="نوع العقار" hint="القائمة تُدار من إعدادات الموقع ← الأنواع والأحياء">
            <select
              className={inputClass}
              value={form.property_type}
              onChange={(e) => set({ property_type: e.target.value })}
            >
              <option value="">— اختر —</option>
              {(types.data ?? []).map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
              {form.property_type &&
              !(types.data ?? []).some((t) => t.name === form.property_type) ? (
                <option value={form.property_type}>{form.property_type}</option>
              ) : null}
            </select>
          </Field>
          <Field label="الحالة">
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => set({ status: e.target.value })}
            >
              {statusOptions.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="المدينة">
            <select
              className={inputClass}
              value={form.city}
              onChange={(e) => set({ city: e.target.value, district: "" })}
            >
              <option value="">— اختر —</option>
              {(cities.data ?? []).map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
              {form.city && !(cities.data ?? []).some((c) => c.name === form.city) ? (
                <option value={form.city}>{form.city}</option>
              ) : null}
            </select>
          </Field>
          <Field label="الحي">
            <select
              className={inputClass}
              value={form.district}
              onChange={(e) => set({ district: e.target.value })}
            >
              <option value="">— اختر —</option>
              {cityDistricts.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
              {form.district && !cityDistricts.some((d) => d.name === form.district) ? (
                <option value={form.district}>{form.district}</option>
              ) : null}
            </select>
          </Field>
          <Field label="المالك" hint="يُربط العقار بسجل المالك في قسم الملاك">
            <select
              className={inputClass}
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
            >
              <option value="">— بدون —</option>
              {(owners.data ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.full_name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </SectionCard>
      </> : null}

      {step === 1 ? <>
      <SectionCard
        title="السعر والوصف والنشر"
        subtitle="السعر المعروض على الموقع، الوصف، رقم الواتساب وحالة الظهور."
        icon={Check}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="السعر كنص للعرض">
            <input
              className={inputClass}
              value={form.price_text}
              onChange={(e) => set({ price_text: e.target.value })}
              placeholder="35,000 ريال سنويًا"
            />
          </Field>
          <Field label="السعر كرقم" hint="يُستخدم في الفرز والفلاتر">
            <input
              className={inputClass}
              dir="ltr"
              inputMode="numeric"
              value={form.price_value}
              onChange={(e) => set({ price_value: e.target.value })}
            />
          </Field>
          <Field label="رقم واتساب للتواصل">
            <input
              className={inputClass}
              dir="ltr"
              value={form.whatsapp_number}
              onChange={(e) => set({ whatsapp_number: e.target.value })}
            />
          </Field>
          <Field label="ترتيب الظهور">
            <input
              className={inputClass}
              dir="ltr"
              inputMode="numeric"
              value={form.sort_order}
              onChange={(e) => set({ sort_order: e.target.value })}
            />
          </Field>
          <Field label="وصف العقار" className="sm:col-span-2">
            <textarea
              className={textareaClass}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-6 sm:col-span-2">
            <span className="flex items-center gap-2 text-[12.5px] font-semibold">
              <Toggle
                label="مرئي على الموقع"
                checked={form.is_visible}
                onChange={(v) => set({ is_visible: v })}
              />
              مرئي على الموقع
            </span>
            <span className="flex items-center gap-2 text-[12.5px] font-semibold">
              <Toggle
                label="عقار مميز"
                checked={form.is_featured}
                onChange={(v) => set({ is_featured: v })}
              />
              عقار مميز
            </span>
            <span className="flex items-center gap-2 text-[12.5px] font-semibold">
              <Toggle
                label="بحاجة مراجعة"
                checked={form.needs_review}
                onChange={(v) => set({ needs_review: v })}
              />
              بحاجة مراجعة
            </span>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="الموقع على الخريطة"
        subtitle="أدخل رابط خرائط جوجل أو الإحداثيات ليظهر العقار على خريطة الموقع."
        icon={MapPin}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="رابط خرائط جوجل" className="sm:col-span-3">
            <input
              className={inputClass}
              dir="ltr"
              value={form.map_url}
              onChange={(e) => set({ map_url: e.target.value })}
              placeholder="https://maps.google.com/..."
            />
            <p className="mt-1 text-[12px] text-muted-foreground">
              {geoBusy
                ? "جارٍ تحديد الموقع من الرابط..."
                : "الصق الرابط وسيتم ملء خط الطول والعرض تلقائياً."}
            </p>
          </Field>

          <Field label="خط العرض (Latitude)">
            <input
              className={inputClass}
              dir="ltr"
              value={form.latitude}
              onChange={(e) => set({ latitude: e.target.value })}
              placeholder="26.3260"
            />
          </Field>
          <Field label="خط الطول (Longitude)">
            <input
              className={inputClass}
              dir="ltr"
              value={form.longitude}
              onChange={(e) => set({ longitude: e.target.value })}
              placeholder="43.9750"
            />
          </Field>
        </div>
      </SectionCard>
      </> : null}

      {step === 2 ? <>
      <SectionCard
        title="روابط التواصل والوسائط"
        subtitle="كل منصة لها خانة مستقلة، وتظهر بأيقونتها الحقيقية في صفحة العقار على الموقع."
        icon={Film}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIAL_PLATFORMS.map((p) => (
            <Field key={p.key} label={p.label}>
              <div className="flex items-center gap-2">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-lg border border-border"
                  style={{ color: p.color }}
                >
                  <SocialGlyph platform={p.key} />
                </span>
                <input
                  className={inputClass}
                  dir="ltr"
                  value={form[p.key]}
                  onChange={(e) => set({ [p.key]: e.target.value } as Partial<FormState>)}
                  placeholder={p.placeholder}
                />
              </div>
            </Field>
          ))}
        </div>
      </SectionCard>

      {form.purpose === "sale" ? (
        <SectionCard
          title="الضمانات المقدمة في هذا العقار"
          subtitle="علّم على الضمانات المتوفرة، وعدّل الاسم أو عدد السنوات عند الحاجة لتظهر للزوار في صفحة العقار."
          icon={ShieldCheck}
        >
          {!id ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-[13px] text-muted-foreground">
              احفظ عقار البيع أولًا ثم أضِف الضمانات.
            </p>
          ) : (
            <div className="space-y-4">
              <ul className="space-y-3">
                {(guarantees.data ?? []).map((g) => (
                  <li key={g.id} className="overflow-hidden rounded-xl border border-border bg-card">
                    <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                      <label className="flex items-center gap-2 text-[12.5px] font-bold text-foreground">
                        <input type="checkbox" checked readOnly className="size-4 accent-primary" />
                        متضمن
                      </label>
                      <span className="text-[12px] font-bold text-foreground">{g.name}</span>
                      <button
                        type="button"
                        aria-label="حذف الضمان"
                        onClick={() => removeGuarantee.mutate(g.id)}
                        className="grid size-8 place-items-center rounded-md text-destructive transition hover:bg-destructive/10"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <div className="grid gap-3 p-4 sm:grid-cols-2">
                      <Field label="الضمان">
                        <input
                          className={inputClass}
                          defaultValue={g.name}
                          onBlur={(e) => {
                            const name = e.target.value.trim();
                            if (name && name !== g.name) updateGuarantee.mutate({ rowId: g.id, name });
                          }}
                        />
                      </Field>
                      <Field label="السنوات">
                        <input
                          type="number"
                          min={0}
                          defaultValue={g.years}
                          onBlur={(e) =>
                            updateGuarantee.mutate({ rowId: g.id, years: Number(e.target.value) || 0 })
                          }
                          className={inputClass}
                        />
                      </Field>
                    </div>
                  </li>
                ))}
                {!guarantees.data?.length ? (
                  <li className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-muted-foreground">
                    لا توجد ضمانات مضافة
                  </li>
                ) : null}
              </ul>

              <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-4">
                <p className="mb-3 text-[12.5px] font-bold text-foreground">الضمانات الأساسية</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {[...DEFAULT_SALE_GUARANTEES, ...(presets.data ?? []).map((p) => ({ name: p.name, years: p.default_years ?? 0 }))]
                    .filter((preset, index, list) => list.findIndex((item) => item.name === preset.name) === index)
                    .map((preset) => {
                      const selected = (guarantees.data ?? []).some((g) => g.name === preset.name);
                      return (
                        <label
                          key={preset.name}
                          className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-3 transition ${selected ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/50"}`}
                        >
                          <span className="flex items-center gap-2 text-[12.5px] font-semibold text-foreground">
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={addGuarantee.isPending || removeGuarantee.isPending}
                              onChange={() => {
                                const row = (guarantees.data ?? []).find((g) => g.name === preset.name);
                                if (row) removeGuarantee.mutate(row.id);
                                else addGuarantee.mutate(preset);
                              }}
                              className="size-4 accent-primary"
                            />
                            {preset.name}
                          </span>
                          <span className="text-[11px] font-bold text-primary">{preset.years} سنوات</span>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="grid items-end gap-3 border-t border-border pt-5 sm:grid-cols-[1fr_180px_auto]">
                <Field label="الضمان">
                  <input
                    className={inputClass}
                    value={guaranteeName}
                    onChange={(e) => setGuaranteeName(e.target.value)}
                    placeholder="مثال: ضمان السباكة"
                  />
                </Field>
                <Field label="السنوات">
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    value={guaranteeYears}
                    onChange={(e) => setGuaranteeYears(e.target.value)}
                    placeholder="عدد السنوات"
                  />
                </Field>
                <button
                  type="button"
                  onClick={() =>
                    addGuarantee.mutate({
                      name: guaranteeName.trim(),
                      years: Number(guaranteeYears) || 0,
                    })
                  }
                  disabled={addGuarantee.isPending}
                  className="inline-flex h-10 items-center justify-center gap-1 rounded-lg bg-primary px-5 text-[12.5px] font-bold text-primary-foreground disabled:opacity-50"
                >
                  <Plus className="size-4" />
                  إضافة ضمان
                </button>
              </div>
            </div>
          )}
        </SectionCard>
      ) : null}
      </> : null}



      {step === 3 ? <>
      <SectionCard
        title="صور العقار"
        subtitle="ارفع الصور من جهازك أو أضِف روابط جاهزة، وحدّد الصورة الرئيسية."
        icon={ImageIcon}
      >
        {!id ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-muted-foreground">
            احفظ بيانات العقار أولًا لتفعيل رفع الصور والفيديوهات.
          </p>
        ) : (
          <div className="space-y-4">
            <label className="grid cursor-pointer place-items-center gap-2 rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
              {uploading ? (
                <Loader2 className="size-6 animate-spin text-primary" />
              ) : (
                <UploadCloud className="size-6 text-muted-foreground" />
              )}
              <span className="text-[13px] text-muted-foreground">
                اسحب الصور هنا أو اضغط للاختيار
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => uploadFiles(e.target.files)}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <input
                className={inputClass + " max-w-md flex-1"}
                dir="ltr"
                placeholder="أو ألصق رابط صورة https://"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
              <button
                type="button"
                disabled={!imageUrl.trim() || addImage.isPending}
                onClick={() => addImage.mutate(imageUrl.trim())}
                className="inline-flex h-10 items-center gap-1 rounded-lg border border-border px-4 text-[12.5px] font-semibold text-primary disabled:opacity-50"
              >
                <Plus className="size-4" />
                إضافة
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {(images.data ?? []).map((img) => (
                <figure
                  key={img.id}
                  className="overflow-hidden rounded-xl border border-border bg-card"
                >
                  <img src={img.url} alt="صورة العقار" className="h-32 w-full object-cover" />
                  <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-[12px]">
                    <button
                      type="button"
                      onClick={() => setCover.mutate(img.id)}
                      className={
                        img.is_cover ? "font-bold text-primary" : "font-semibold text-muted-foreground"
                      }
                    >
                      {img.is_cover ? "الصورة الرئيسية" : "تعيين كرئيسية"}
                    </button>
                    <button
                      type="button"
                      aria-label="حذف الصورة"
                      onClick={() =>
                        removeMedia.mutate({ table: "property_images", rowId: img.id })
                      }
                      className="text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="فيديوهات العقار"
        subtitle="روابط فيديو من YouTube أو TikTok أو أي مصدر آخر."
        icon={Film}
      >
        {!id ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-muted-foreground">
            احفظ بيانات العقار أولًا.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <input
                className={inputClass}
                dir="ltr"
                placeholder="رابط الفيديو"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="عنوان الفيديو (اختياري)"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
              />
              <button
                type="button"
                onClick={() => addVideo.mutate()}
                disabled={addVideo.isPending}
                className="inline-flex h-10 items-center gap-1 rounded-lg border border-border px-4 text-[12.5px] font-semibold text-primary disabled:opacity-50"
              >
                <Plus className="size-4" />
                إضافة
              </button>
            </div>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {(videos.data ?? []).map((video) => (
                <li key={video.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="truncate text-[12.5px]" dir="ltr">
                    {video.title ? `${video.title} — ` : ""}
                    {video.url}
                  </span>
                  <button
                    type="button"
                    aria-label="حذف الفيديو"
                    onClick={() => removeMedia.mutate({ table: "property_videos", rowId: video.id })}
                    className="text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
              {!videos.data?.length ? (
                <li className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
                  لا توجد فيديوهات
                </li>
              ) : null}
            </ul>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="ملاحظات داخلية"
        subtitle="لا تظهر على الموقع العام — للفريق فقط."
        icon={NotebookPen}
      >
        <textarea
          className={textareaClass}
          value={form.internal_notes}
          onChange={(e) => set({ internal_notes: e.target.value })}
          placeholder="ملاحظات عن المالك، التفاوض، أو تفاصيل تشغيلية."
        />
      </SectionCard>
      </> : null}

      <div className="flex flex-wrap items-center justify-center gap-3 pb-4">
        {step > 0 ? <button type="button" onClick={() => setStep((current) => current - 1)} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 text-[13px] font-semibold"><ChevronRight className="size-4" />السابق</button> : null}
        {step < steps.length - 1 ? <button type="button" onClick={() => setStep((current) => current + 1)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-[13px] font-bold text-primary-foreground">التالي<ChevronLeft className="size-4" /></button> : null}
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-[13.5px] font-bold text-primary-foreground disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {id ? "حفظ التعديلات" : "حفظ العقار"}
        </button>
        <Link
          to="/properties"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-[13.5px] font-semibold"
        >
          <ArrowRight className="size-4" />
          رجوع
        </Link>
      </div>
    </>
  );
}
