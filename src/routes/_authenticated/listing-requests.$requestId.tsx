import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useParams } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, Loader2, MapPin, MessageCircle, Save, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";
import { requestStatusLabels } from "@/lib/labels";
import { approveListingRequest } from "@/lib/requests.functions";

export const Route = createFileRoute("/_authenticated/listing-requests/$requestId")({
  head: () => ({
    meta: [
      { title: "تفاصيل طلب عرض عقار | الرشودي للعقارات" },
      { name: "description", content: "عرض طلب عرض العقار كما أرسله المالك مع الصور والتعديل والاعتماد." },
      { property: "og:title", content: "تفاصيل طلب عرض عقار | الرشودي للعقارات" },
      { property: "og:description", content: "مراجعة طلب عرض العقار واعتماده ونشره." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ListingRequestDetail,
});

const statusOrder = ["new", "in_review", "contacted", "approved", "converted", "rejected", "closed"];

const fieldClass =
  "h-11 w-full rounded-lg border border-border bg-card px-3 text-[13px] text-foreground outline-none focus:border-primary";

type Attachment = { path?: string; name?: string };

function ListingRequestDetail() {
  const { requestId } = useParams({ from: "/_authenticated/listing-requests/$requestId" });
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["listing_request", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_requests")
        .select("*")
        .eq("id", requestId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const attachments = ((query.data?.attachments as Attachment[] | null) ?? []).filter((a) => a?.path);

  const media = useQuery({
    queryKey: ["listing_request_media", requestId, attachments.length],
    enabled: attachments.length > 0,
    queryFn: async () => {
      const signed = await Promise.all(
        attachments.map((a) =>
          supabase.storage.from("listing-request-media").createSignedUrl(a.path as string, 600),
        ),
      );
      return signed.map((s) => s.data?.signedUrl).filter((u): u is string => Boolean(u));
    },
  });

  type ListingForm = {
    full_name: string;
    phone: string;
    email: string;
    purpose: string;
    property_type: string;
    city: string;
    district: string;
    asking_price: string;
    rent_period: string;
    map_url: string;
    description: string;
    admin_notes: string;
    status: string;
  };

  const [form, setForm] = useState<ListingForm>({
    full_name: "",
    phone: "",
    email: "",
    purpose: "rent",
    property_type: "",
    city: "",
    district: "",
    asking_price: "",
    rent_period: "",
    map_url: "",
    description: "",
    admin_notes: "",
    status: "new",
  });

  useEffect(() => {
    const row = query.data;
    if (!row) return;
    setForm({
      full_name: row.full_name ?? "",
      phone: row.phone ?? "",
      email: row.email ?? "",
      purpose: row.purpose ?? "rent",
      property_type: row.property_type ?? "",
      city: row.city ?? "",
      district: row.district ?? "",
      asking_price: row.asking_price ?? "",
      rent_period: row.rent_period ?? "",
      map_url: row.map_url ?? "",
      description: row.description ?? "",
      admin_notes: row.admin_notes ?? "",
      status: row.status ?? "new",
    });
  }, [query.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("listing_requests")
        .update({
          full_name: form.full_name,
          phone: form.phone,
          email: form.email || null,
          purpose: form.purpose,
          property_type: form.property_type || null,
          city: form.city || null,
          district: form.district || null,
          asking_price: form.asking_price || null,
          rent_period: form.rent_period || null,
          map_url: form.map_url || null,
          description: form.description || null,
          admin_notes: form.admin_notes || null,
          status: form.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listing_request", requestId] });
      queryClient.invalidateQueries({ queryKey: ["listing_requests"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      toast.success("تم حفظ الطلب");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحفظ"),
  });

  const approve = useMutation({
    mutationFn: async () => {
      await save.mutateAsync();
      return approveListingRequest({ data: { requestId, notifyWhatsapp: true } });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["listing_request", requestId] });
      queryClient.invalidateQueries({ queryKey: ["listing_requests"] });
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      toast.success(
        result.whatsapp.ok
          ? "تم اعتماد العقار ونشره، وأُرسل إشعار واتساب للمالك"
          : "تم اعتماد العقار ونشره (لم يُرسل إشعار واتساب)",
      );
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الاعتماد"),
  });

  if (query.isLoading) {
    return (
      <div className="surface-card grid place-items-center gap-2 px-6 py-16 text-center">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-[13px] text-muted-foreground">جاري تحميل الطلب…</p>
      </div>
    );
  }

  if (query.error || !query.data) {
    return (
      <div className="surface-card grid place-items-center gap-2 px-6 py-16 text-center">
        <TriangleAlert className="size-7 text-destructive" />
        <p className="text-[14px] font-semibold text-foreground">تعذّر فتح الطلب</p>
        <Link to="/listing-requests" className="text-[13px] font-semibold text-primary">
          العودة للقائمة
        </Link>
      </div>
    );
  }

  const waPhone = (form.phone).replace(/[^0-9]/g, "");
  const approved = query.data.status === "approved" || query.data.status === "converted";

  return (
    <>
      <PageHero
        title={`طلب عرض عقار — ${form.full_name || "بدون اسم"}`}
        subtitle={`الحالة الحالية: ${requestStatusLabels[form.status] ?? form.status}`}
        icon={BadgeCheck}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/listing-requests"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground hover:bg-muted"
        >
          <ArrowRight className="size-4" />
          كل الطلبات
        </Link>
        {waPhone ? (
          <a
            href={`https://wa.me/${waPhone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground hover:bg-muted"
          >
            <MessageCircle className="size-4" />
            تواصل واتساب
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground hover:bg-muted disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          حفظ التعديلات
        </button>
        <button
          type="button"
          onClick={() => approve.mutate()}
          disabled={approve.isPending}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {approve.isPending ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />}
          {approved ? "إعادة الاعتماد والنشر" : "اعتماد ونشر العقار"}
        </button>
        {query.data.property_id ? (
          <Link
            to="/property-form"
            search={{ id: query.data.property_id }}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground hover:bg-muted"
          >
            فتح العقار في النظام
          </Link>
        ) : null}
      </div>

      <section className="surface-card mt-4 p-5">
        <h2 className="text-[15px] font-bold text-foreground">الصفحة كما عبّأها المالك</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="اسم المالك">
            <input className={fieldClass} value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
          </Field>
          <Field label="الجوال">
            <input dir="ltr" inputMode="tel" className={fieldClass} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="البريد الإلكتروني">
            <input dir="ltr" className={fieldClass} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="الغرض">
            <select className={fieldClass} value={form.purpose ?? "rent"} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}>
              <option value="rent">إيجار</option>
              <option value="sale">بيع</option>
            </select>
          </Field>
          <Field label="نوع العقار">
            <input className={fieldClass} value={form.property_type} onChange={(e) => setForm((f) => ({ ...f, property_type: e.target.value }))} />
          </Field>
          <Field label="مدة الإيجار">
            <input className={fieldClass} value={form.rent_period} onChange={(e) => setForm((f) => ({ ...f, rent_period: e.target.value }))} />
          </Field>
          <Field label="المدينة">
            <input className={fieldClass} value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          </Field>
          <Field label="الحي">
            <input className={fieldClass} value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} />
          </Field>
          <Field label="السعر المطلوب">
            <input className={fieldClass} value={form.asking_price} onChange={(e) => setForm((f) => ({ ...f, asking_price: e.target.value }))} />
          </Field>
          <Field label="الحالة">
            <select className={fieldClass} value={form.status ?? "new"} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              {statusOrder.map((s) => (
                <option key={s} value={s}>{requestStatusLabels[s] ?? s}</option>
              ))}
            </select>
          </Field>
          <Field label="رابط الموقع على الخريطة">
            <input dir="ltr" className={fieldClass} value={form.map_url} onChange={(e) => setForm((f) => ({ ...f, map_url: e.target.value }))} />
          </Field>
        </div>

        {form.map_url ? (
          <a
            href={form.map_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary"
          >
            <MapPin className="size-4" />
            فتح الموقع على الخريطة
          </a>
        ) : null}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="وصف العقار كما كتبه المالك">
            <textarea rows={5} className="w-full rounded-lg border border-border bg-card p-3 text-[13px] text-foreground outline-none focus:border-primary" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </Field>
          <Field label="ملاحظات الإدارة">
            <textarea rows={5} className="w-full rounded-lg border border-border bg-card p-3 text-[13px] text-foreground outline-none focus:border-primary" value={form.admin_notes} onChange={(e) => setForm((f) => ({ ...f, admin_notes: e.target.value }))} />
          </Field>
        </div>
      </section>

      <section className="surface-card mt-4 p-5">
        <h2 className="text-[15px] font-bold text-foreground">الصور المرفقة</h2>
        {attachments.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-muted-foreground">لم يرفق المالك أي صور.</p>
        ) : media.isLoading ? (
          <p className="mt-2 text-[12.5px] text-muted-foreground">جاري تحميل الصور…</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(media.data ?? []).map((url) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-xl border border-border">
                <img src={url} alt="صورة العقار المرفقة" loading="lazy" className="h-48 w-full object-cover" />
              </a>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
