import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Plus, Trash2, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { EmptyState, formatCurrency, formatDate } from "@/components/kit/LiveTable";
import { Modal } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";
import { supabase } from "@/integrations/supabase/client";
import { whatsappLink } from "@/lib/site-data";

const TITLE = "إدارة الصيانة | الرشودي للعقارات";
const DESC = "بلاغات الصيانة من المستأجرين والملاك مع الفني والتكلفة والحالة وتقييم الخدمة.";

export const Route = createFileRoute("/_authenticated/maintenance")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MaintenancePage,
});

const statuses: Record<
  string,
  { label: string; tone: "info" | "warning" | "success" | "danger" | "muted" }
> = {
  new: { label: "جديد", tone: "info" },
  assigned: { label: "مُسند لفني", tone: "warning" },
  in_progress: { label: "جارٍ التنفيذ", tone: "warning" },
  done: { label: "مكتمل", tone: "success" },
  cancelled: { label: "ملغي", tone: "muted" },
};

const priorities: Record<string, string> = {
  low: "منخفضة",
  normal: "عادية",
  high: "عالية",
  urgent: "طارئة",
};

const categories: Record<string, string> = {
  plumbing: "سباكة",
  electrical: "كهرباء",
  ac: "تكييف",
  elevator: "مصعد",
  cleaning: "نظافة",
  structure: "إنشائي",
  other: "أخرى",
};

type Row = {
  id: string;
  reporter_name: string;
  reporter_phone: string;
  category: string;
  priority: string;
  description: string;
  status: string;
  technician_name: string | null;
  technician_phone: string | null;
  scheduled_at: string | null;
  cost: number;
  rating: number | null;
  internal_notes: string | null;
  created_at: string;
  property: { name: string; code: string } | null;
};

type OwnerRequestRow = {
  id: string;
  title: string;
  details: string | null;
  status: string;
  created_at: string;
  property_id: string | null;
  owner: { full_name: string; phone: string | null } | null;
  property: { name: string; code: string | null } | null;
};

const emptyForm = {
  reporter_name: "",
  reporter_phone: "",
  category: "other",
  priority: "normal",
  description: "",
  property_id: "",
  technician_name: "",
  technician_phone: "",
  cost: "0",
  internal_notes: "",
  status: "new",
};

function MaintenancePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("open");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { data, isLoading } = useQuery({
    queryKey: ["maintenance-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_requests")
        .select(
          "id, reporter_name, reporter_phone, category, priority, description, status, technician_name, technician_phone, scheduled_at, cost, rating, internal_notes, created_at, property:property_id(name, code)",
        )
        .order("created_at", { ascending: false })
        .limit(400);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  // بلاغات الصيانة القادمة من بوابة المالك تصل هنا مباشرة.
  const ownerRequests = useQuery({
    queryKey: ["owner-maintenance-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("owner_requests")
        .select(
          "id, title, details, status, created_at, property_id, owner:owner_id(full_name, phone), property:property_id(name, code)",
        )
        .eq("kind", "maintenance")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as OwnerRequestRow[];
    },
  });

  const convertOwnerRequest = useMutation({
    mutationFn: async (row: OwnerRequestRow) => {
      const insert = await supabase.from("maintenance_requests").insert({
        reporter_name: row.owner?.full_name ?? "المالك",
        reporter_phone: row.owner?.phone ?? "",
        ...(row.property_id ? { property_id: row.property_id } : {}),
        category: "owner",
        priority: "normal",
        description: [row.title, row.details].filter(Boolean).join(" — "),
        status: "new",
      });
      if (insert.error) throw insert.error;
      const update = await supabase
        .from("owner_requests")
        .update({ status: "in_progress" })
        .eq("id", row.id);
      if (update.error) throw update.error;
    },
    onSuccess: () => {
      toast.success("تم تحويل طلب المالك إلى بلاغ صيانة");
      void qc.invalidateQueries({ queryKey: ["owner-maintenance-requests"] });
      void qc.invalidateQueries({ queryKey: ["maintenance-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: properties } = useQuery({
    queryKey: ["maintenance-properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, code")
        .order("name")
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = data ?? [];
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const openCount = (counts["new"] ?? 0) + (counts["assigned"] ?? 0) + (counts["in_progress"] ?? 0);

  const visible = useMemo(() => {
    if (tab === "all") return rows;
    if (tab === "open")
      return rows.filter((r) => ["new", "assigned", "in_progress"].includes(r.status));
    return rows.filter((r) => r.status === tab);
  }, [rows, tab]);

  const totalCost = rows
    .filter((r) => r.status === "done")
    .reduce((s, r) => s + Number(r.cost ?? 0), 0);
  const rated = rows.filter((r) => r.rating != null);
  const avgRating = rated.length
    ? rated.reduce((s, r) => s + Number(r.rating), 0) / rated.length
    : 0;

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        reporter_name: form.reporter_name.trim(),
        reporter_phone: form.reporter_phone.trim(),
        category: form.category,
        priority: form.priority,
        description: form.description.trim(),
        status: form.status,
        property_id: form.property_id || null,
        technician_name: form.technician_name.trim() || null,
        technician_phone: form.technician_phone.trim() || null,
        cost: Number(form.cost || 0),
        internal_notes: form.internal_notes.trim() || null,
      };
      if (!payload.reporter_name || !payload.reporter_phone || !payload.description) {
        throw new Error("الاسم والجوال ووصف البلاغ مطلوبة");
      }
      if (editId) {
        const { error } = await supabase
          .from("maintenance_requests")
          .update(payload)
          .eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("maintenance_requests").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "تم تحديث البلاغ" : "تم تسجيل البلاغ");
      setOpen(false);
      setEditId(null);
      setForm({ ...emptyForm });
      void qc.invalidateQueries({ queryKey: ["maintenance-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: { status?: string; rating?: number | null };
    }) => {
      const { error } = await supabase.from("maintenance_requests").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["maintenance-requests"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("maintenance_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف البلاغ");
      void qc.invalidateQueries({ queryKey: ["maintenance-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const field =
    "h-10 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-foreground";

  return (
    <div className="space-y-6" dir="rtl">
      <PageHero
        title="إدارة الصيانة"
        subtitle="من البلاغ حتى الإنجاز: الفني، الموعد، التكلفة، وتقييم المستأجر للخدمة."
        icon={Wrench}
        stats={[
          { value: String(rows.length), label: "إجمالي البلاغات" },
          { value: String(openCount), label: "بلاغات مفتوحة" },
          { value: formatCurrency(totalCost), label: "تكلفة منجزة" },
        ]}
      />

      <section className="rounded-2xl border border-border bg-card p-5">
        <header className="mb-3">
          <h2 className="text-[14px] font-bold text-foreground">طلبات الصيانة الواردة من الملاك</h2>
          <p className="text-[12px] text-muted-foreground">
            كل طلب صيانة يرسله المالك من بوابته يصل هنا، وتحوّله إلى بلاغ داخلي بضغطة واحدة.
          </p>
        </header>
        {!ownerRequests.data?.length ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-[12.5px] text-muted-foreground">
            لا توجد طلبات صيانة واردة من الملاك حاليًا.
          </p>
        ) : (
          <div className="space-y-2">
            {ownerRequests.data.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
              >
                <div>
                  <p className="text-[13px] font-bold text-foreground">{row.title}</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {[row.owner?.full_name, row.property?.name, row.details]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={row.status !== "new" || convertOwnerRequest.isPending}
                  onClick={() => convertOwnerRequest.mutate(row)}
                  className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {row.status === "new" ? "تحويل إلى بلاغ" : "تم التحويل"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pills
          defaultKey="open"
          onChange={setTab}
          items={[
            { key: "open", label: "مفتوحة", count: openCount },
            { key: "new", label: "جديدة", count: counts["new"] ?? 0 },
            { key: "in_progress", label: "جارية", count: counts["in_progress"] ?? 0 },
            { key: "done", label: "مكتملة", count: counts["done"] ?? 0 },
            { key: "all", label: "الكل", count: rows.length },
          ]}
        />
        <div className="flex items-center gap-3">
          <span className="text-[12.5px] text-muted-foreground">
            متوسط التقييم: {avgRating ? `${avgRating.toFixed(1)} / 5` : "—"}
          </span>
          <button
            type="button"
            onClick={() => {
              setEditId(null);
              setForm({ ...emptyForm });
              setOpen(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" /> بلاغ صيانة جديد
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          جارٍ التحميل…
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          text="لا توجد بلاغات في هذا التبويب"
          hint="سجّل بلاغًا جديدًا أو جرّب تبويبًا آخر."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((row) => {
            const info = statuses[row.status] ?? statuses["new"]!;
            return (
              <article
                key={row.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-card"
              >
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-foreground">
                      {categories[row.category] ?? "صيانة"} — {row.property?.name ?? "بدون عقار"}
                    </h2>
                    <p className="mt-1 text-[12.5px] text-muted-foreground">
                      {row.reporter_name} · {row.reporter_phone} · {formatDate(row.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Chip
                      tone={
                        row.priority === "urgent"
                          ? "danger"
                          : row.priority === "high"
                            ? "warning"
                            : "muted"
                      }
                    >
                      {priorities[row.priority] ?? "عادية"}
                    </Chip>
                    <Chip tone={info.tone}>{info.label}</Chip>
                  </div>
                </header>

                <p className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-[12.5px] leading-6 text-foreground">
                  {row.description}
                </p>

                <dl className="mt-3 grid grid-cols-2 gap-3 text-[12.5px] sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-background p-3">
                    <dt className="text-muted-foreground">الفني</dt>
                    <dd className="mt-1 font-semibold text-foreground">
                      {row.technician_name ?? "لم يُسند"}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-3">
                    <dt className="text-muted-foreground">التكلفة</dt>
                    <dd className="mt-1 font-semibold text-foreground">
                      {formatCurrency(row.cost)}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-3">
                    <dt className="text-muted-foreground">التقييم</dt>
                    <dd className="mt-1 font-semibold text-foreground">
                      {row.rating ? `${row.rating} / 5` : "—"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <select
                    value={row.status}
                    onChange={(e) =>
                      patch.mutate({ id: row.id, values: { status: e.target.value } })
                    }
                    className="h-9 rounded-lg border border-border bg-background px-2 text-[12.5px] text-foreground"
                  >
                    {Object.entries(statuses).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={row.rating ?? ""}
                    onChange={(e) =>
                      patch.mutate({
                        id: row.id,
                        values: { rating: e.target.value ? Number(e.target.value) : null },
                      })
                    }
                    className="h-9 rounded-lg border border-border bg-background px-2 text-[12.5px] text-foreground"
                  >
                    <option value="">تقييم الخدمة</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} / 5
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setEditId(row.id);
                      setForm({
                        reporter_name: row.reporter_name,
                        reporter_phone: row.reporter_phone,
                        category: row.category,
                        priority: row.priority,
                        description: row.description,
                        property_id: "",
                        technician_name: row.technician_name ?? "",
                        technician_phone: row.technician_phone ?? "",
                        cost: String(row.cost ?? 0),
                        internal_notes: row.internal_notes ?? "",
                        status: row.status,
                      });
                      setOpen(true);
                    }}
                    className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-[12.5px] font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    تعديل
                  </button>
                  <a
                    href={whatsappLink(
                      row.reporter_phone,
                      `مرحبًا ${row.reporter_name}، بخصوص بلاغ الصيانة لديكم: ${row.description.slice(0, 120)}`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    <MessageCircle className="size-4" /> مراسلة المُبلِّغ
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("هل أنت متأكد من الحذف؟")) remove.mutate(row.id);
                    }}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[12.5px] font-semibold text-destructive transition-colors hover:bg-muted"
                  >
                    <Trash2 className="size-4" /> حذف
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "تعديل بلاغ الصيانة" : "بلاغ صيانة جديد"}
        subtitle="لا تُرسل أي رسالة تلقائيًا — المراسلة تتم بضغطك على زر واتساب فقط."
        wide
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-10 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate()}
              className="h-10 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-60"
            >
              حفظ
            </button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className={field}
            placeholder="اسم المُبلِّغ"
            value={form.reporter_name}
            onChange={(e) => setForm((f) => ({ ...f, reporter_name: e.target.value }))}
          />
          <input
            className={field}
            placeholder="جوال المُبلِّغ"
            value={form.reporter_phone}
            onChange={(e) => setForm((f) => ({ ...f, reporter_phone: e.target.value }))}
          />
          <select
            className={field}
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          >
            {Object.entries(categories).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            className={field}
            value={form.priority}
            onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
          >
            {Object.entries(priorities).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            className={field}
            value={form.property_id}
            onChange={(e) => setForm((f) => ({ ...f, property_id: e.target.value }))}
          >
            <option value="">بدون ربط بعقار</option>
            {(properties ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
          <select
            className={field}
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          >
            {Object.entries(statuses).map(([key, value]) => (
              <option key={key} value={key}>
                {value.label}
              </option>
            ))}
          </select>
          <input
            className={field}
            placeholder="اسم الفني"
            value={form.technician_name}
            onChange={(e) => setForm((f) => ({ ...f, technician_name: e.target.value }))}
          />
          <input
            className={field}
            placeholder="جوال الفني"
            value={form.technician_phone}
            onChange={(e) => setForm((f) => ({ ...f, technician_phone: e.target.value }))}
          />
          <input
            className={field}
            type="number"
            placeholder="التكلفة"
            value={form.cost}
            onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
          />
          <textarea
            className="min-h-24 rounded-lg border border-border bg-background p-3 text-[13px] text-foreground sm:col-span-2"
            placeholder="وصف البلاغ"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <textarea
            className="min-h-20 rounded-lg border border-border bg-background p-3 text-[13px] text-foreground sm:col-span-2"
            placeholder="ملاحظات داخلية"
            value={form.internal_notes}
            onChange={(e) => setForm((f) => ({ ...f, internal_notes: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}
