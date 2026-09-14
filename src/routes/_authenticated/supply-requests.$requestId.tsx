import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useParams } from "@tanstack/react-router";
import { ArrowRight, Loader2, MessageCircle, Save, Search, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";
import { requestStatusLabels } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/supply-requests/$requestId")({
  head: () => ({
    meta: [
      { title: "تفاصيل طلب توفير عقار | الرشودي للعقارات" },
      { name: "description", content: "عرض الطلب كما أرسله العميل مع إمكانية التعديل وتحديث الحالة." },
      { property: "og:title", content: "تفاصيل طلب توفير عقار | الرشودي للعقارات" },
      { property: "og:description", content: "متابعة طلب توفير عقار وتحديث حالته." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupplyRequestDetail,
});

const statusOrder = ["new", "in_review", "contacted", "approved", "converted", "rejected", "closed"];

const fieldClass =
  "h-11 w-full rounded-lg border border-border bg-card px-3 text-[13px] text-foreground outline-none focus:border-primary";

function SupplyRequestDetail() {
  const { requestId } = useParams({ from: "/_authenticated/supply-requests/$requestId" });
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["supply_request", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supply_requests")
        .select("*")
        .eq("id", requestId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  type SupplyForm = {
    full_name: string;
    phone: string;
    request_type: string;
    requester_type: string;
    broker_name: string;
    broker_phone: string;
    property_type: string;
    city: string;
    districts: string;
    budget_min: string;
    budget_max: string;
    requester_notes: string;
    admin_notes: string;
    status: string;
  };

  const [form, setForm] = useState<SupplyForm>({
    full_name: "",
    phone: "",
    request_type: "rent",
    requester_type: "client",
    broker_name: "",
    broker_phone: "",
    property_type: "",
    city: "",
    districts: "",
    budget_min: "",
    budget_max: "",
    requester_notes: "",
    admin_notes: "",
    status: "new",
  });

  useEffect(() => {
    const row = query.data;
    if (!row) return;
    setForm({
      full_name: row.full_name ?? "",
      phone: row.phone ?? "",
      request_type: row.request_type ?? "rent",
      requester_type: row.requester_type ?? "client",
      broker_name: row.broker_name ?? "",
      broker_phone: row.broker_phone ?? "",
      property_type: row.property_type ?? "",
      city: row.city ?? "",
      districts: row.districts ?? "",
      budget_min: row.budget_min == null ? "" : String(row.budget_min),
      budget_max: row.budget_max == null ? "" : String(row.budget_max),
      requester_notes: row.requester_notes ?? "",
      admin_notes: row.admin_notes ?? "",
      status: row.status ?? "new",
    });
  }, [query.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("supply_requests")
        .update({
          full_name: form.full_name,
          phone: form.phone,
          request_type: form.request_type,
          requester_type: form.requester_type,
          broker_name: form.broker_name || null,
          broker_phone: form.broker_phone || null,
          property_type: form.property_type || null,
          city: form.city || null,
          districts: form.districts || null,
          budget_min: form.budget_min ? Number(form.budget_min) : null,
          budget_max: form.budget_max ? Number(form.budget_max) : null,
          requester_notes: form.requester_notes || null,
          admin_notes: form.admin_notes || null,
          status: form.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supply_request", requestId] });
      queryClient.invalidateQueries({ queryKey: ["supply_requests"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      toast.success("تم حفظ الطلب");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحفظ"),
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
        <Link to="/supply-requests" className="text-[13px] font-semibold text-primary">
          العودة للقائمة
        </Link>
      </div>
    );
  }

  const waPhone = (form.phone).replace(/[^0-9]/g, "");

  return (
    <>
      <PageHero
        title={`طلب توفير عقار — ${form.full_name || "بدون اسم"}`}
        subtitle={`الحالة الحالية: ${requestStatusLabels[form.status] ?? form.status}`}
        icon={Search}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/supply-requests"
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
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          حفظ التعديلات
        </button>
      </div>

      <section className="surface-card mt-4 p-5">
        <h2 className="text-[15px] font-bold text-foreground">البيانات كما أرسلها مقدّم الطلب</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="الاسم">
            <input className={fieldClass} value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
          </Field>
          <Field label="الجوال">
            <input dir="ltr" inputMode="tel" className={fieldClass} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="نوع الطلب">
            <select className={fieldClass} value={form.request_type ?? "rent"} onChange={(e) => setForm((f) => ({ ...f, request_type: e.target.value }))}>
              <option value="rent">إيجار</option>
              <option value="buy">شراء</option>
            </select>
          </Field>
          <Field label="صفة مقدّم الطلب">
            <select className={fieldClass} value={form.requester_type ?? "client"} onChange={(e) => setForm((f) => ({ ...f, requester_type: e.target.value }))}>
              <option value="client">عميل</option>
              <option value="broker">وسيط</option>
            </select>
          </Field>
          <Field label="اسم الوسيط">
            <input className={fieldClass} value={form.broker_name} onChange={(e) => setForm((f) => ({ ...f, broker_name: e.target.value }))} />
          </Field>
          <Field label="جوال الوسيط">
            <input dir="ltr" className={fieldClass} value={form.broker_phone} onChange={(e) => setForm((f) => ({ ...f, broker_phone: e.target.value }))} />
          </Field>
          <Field label="نوع العقار">
            <input className={fieldClass} value={form.property_type} onChange={(e) => setForm((f) => ({ ...f, property_type: e.target.value }))} />
          </Field>
          <Field label="المدينة">
            <input className={fieldClass} value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          </Field>
          <Field label="الأحياء المطلوبة">
            <input className={fieldClass} value={form.districts} onChange={(e) => setForm((f) => ({ ...f, districts: e.target.value }))} />
          </Field>
          <Field label="الحالة">
            <select className={fieldClass} value={form.status ?? "new"} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              {statusOrder.map((s) => (
                <option key={s} value={s}>{requestStatusLabels[s] ?? s}</option>
              ))}
            </select>
          </Field>
          <Field label="الميزانية من">
            <input dir="ltr" inputMode="numeric" className={fieldClass} value={form.budget_min} onChange={(e) => setForm((f) => ({ ...f, budget_min: e.target.value }))} />
          </Field>
          <Field label="الميزانية إلى">
            <input dir="ltr" inputMode="numeric" className={fieldClass} value={form.budget_max} onChange={(e) => setForm((f) => ({ ...f, budget_max: e.target.value }))} />
          </Field>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="ملاحظات مقدّم الطلب">
            <textarea rows={4} className="w-full rounded-lg border border-border bg-card p-3 text-[13px] text-foreground outline-none focus:border-primary" value={form.requester_notes} onChange={(e) => setForm((f) => ({ ...f, requester_notes: e.target.value }))} />
          </Field>
          <Field label="ملاحظات الإدارة">
            <textarea rows={4} className="w-full rounded-lg border border-border bg-card p-3 text-[13px] text-foreground outline-none focus:border-primary" value={form.admin_notes} onChange={(e) => setForm((f) => ({ ...f, admin_notes: e.target.value }))} />
          </Field>
        </div>
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
