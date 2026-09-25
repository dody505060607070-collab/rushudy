import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Camera, MapPin, CircleCheck, ClipboardList, Loader2, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState, formatDate, useTableRows } from "@/components/kit/LiveTable";
import {
  Field,
  GhostButton,
  Modal,
  PrimaryButton,
  inputClass,
  textareaClass,
} from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";
import { StatusLegend } from "@/components/kit/StatusLegend";
import { supabase } from "@/integrations/supabase/client";
import { priorityLabels, taskStatusLabels } from "@/lib/labels";
import { rowTone, toneBadgeClass, toneRowClass } from "@/lib/status-tone";

type Row = {
  id: string;
  title: string;
  details: string | null;
  task_type: string;
  priority: string;
  status: string;
  due_date: string | null;
  due_time: string | null;
  property_id: string | null;
  property: { name: string } | null;
  location_text: string | null;
  location_lat: number | null;
  location_lng: number | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "المهام | الرشودي للعقارات" },
      {
        name: "description",
        content: "كل المهام العادية ومهام التصوير في شاشة واحدة مع الحالة والأولوية والاعتماد.",
      },
      { property: "og:title", content: "المهام | الرشودي للعقارات" },
      { property: "og:description", content: "متابعة مهام الفريق ومهام التصوير واعتماد التنفيذ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TasksPage,
});

const SELECT =
  "id, title, details, task_type, priority, status, due_date, due_time, property_id, created_at, location_text, location_lat, location_lng, property:property_id(name)";

const statusOrder = ["new", "in_progress", "submitted", "approved", "rejected", "done", "cancelled"];

type FormState = {
  title: string;
  details: string;
  task_type: string;
  priority: string;
  status: string;
  due_date: string;
  due_time: string;
  property_id: string;
};

const emptyForm: FormState = {
  title: "",
  details: "",
  task_type: "normal",
  priority: "normal",
  status: "new",
  due_date: "",
  due_time: "",
  property_id: "",
};

function TasksPage() {
  const navigate = useNavigate();
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const queryClient = useQueryClient();

  const { data, isLoading } = useTableRows<Row>({
    table: "tasks",
    select: SELECT,
    orderBy: { column: "created_at" },
    queryKey: ["tasks"],
  });

  const properties = useQuery({
    queryKey: ["properties", "picker"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("properties")
        .select("id, name")
        .order("name")
        .limit(500);
      if (error) throw error;
      return rows ?? [];
    },
  });

  const rows = data ?? [];

  const assigneeNames = useQuery({
    queryKey: ["tasks", "assignee-names", rows.map((r) => r.id).join(",")],
    enabled: rows.length > 0,
    queryFn: async () => {
      const { data: links, error } = await supabase
        .from("task_assignees")
        .select("task_id, user_id")
        .in("task_id", rows.map((r) => r.id));
      if (error) throw error;
      const ids = [...new Set((links ?? []).map((l) => l.user_id))];
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name").in("id", ids)
        : { data: [] as { id: string; full_name: string | null }[] };
      const nameOf = new Map((profs ?? []).map((p) => [p.id, p.full_name ?? "موظف"]));
      const map: Record<string, string[]> = {};
      for (const l of links ?? []) (map[l.task_id] ??= []).push(nameOf.get(l.user_id) ?? "موظف");
      return map;
    },
  });
  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("عنوان المهمة مطلوب");
      const { error } = await supabase.from("tasks").insert({
        title: form.title.trim(),
        details: form.details.trim() || null,
        task_type: form.task_type,
        priority: form.priority,
        status: form.status,
        due_date: form.due_date || null,
        due_time: form.due_time || null,
        property_id: form.property_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      toast.success("تم إضافة المهمة");
      setOpen(false);
      setForm(emptyForm);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحفظ"),
  });

  const changeStatus = useMutation({
    mutationFn: async (input: { id: string; status: string }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: input.status })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      toast.success("تم تحديث حالة المهمة");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر التحديث"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("تم حذف المهمة");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحذف"),
  });

  const byType = rows.filter((r) =>
    type === "all" ? true : type === "photography" ? r.task_type === "photography" : r.task_type !== "photography",
  );

  const counts = useMemo(() => {
    const overdue = (r: Row) =>
      r.due_date != null &&
      new Date(r.due_date) < new Date() &&
      !["approved", "done", "cancelled"].includes(r.status);
    return {
      all: rows.length,
      normal: rows.filter((r) => r.task_type !== "photography").length,
      photography: rows.filter((r) => r.task_type === "photography").length,
      typeAll: byType.length,
      inProgress: byType.filter((r) => r.status === "in_progress").length,
      submitted: byType.filter((r) => r.status === "submitted").length,
      done: byType.filter((r) => r.status === "approved" || r.status === "done").length,
      overdue: byType.filter(overdue).length,
      active: rows.filter((r) => !["approved", "done", "cancelled"].includes(r.status)).length,
      overdueAll: rows.filter(overdue).length,
      awaiting: rows.filter((r) => r.status === "submitted").length,
    };
  }, [rows, byType]);

  const filtered = byType.filter((r) => {
    if (status === "all") return true;
    if (status === "in_progress") return r.status === "in_progress";
    if (status === "submitted") return r.status === "submitted";
    if (status === "done") return r.status === "approved" || r.status === "done";
    return (
      r.due_date != null &&
      new Date(r.due_date) < new Date() &&
      !["approved", "done", "cancelled"].includes(r.status)
    );
  });

  return (
    <>
      <PageHero
        title="المهام"
        subtitle="تنظيم المهام ومتابعة التنفيذ والمراجعة."
        icon={ClipboardList}
        stats={[
          { value: String(counts.overdueAll), label: "مهام متأخرة" },
          { value: String(counts.awaiting), label: "تنتظر الموافقة" },
          { value: String(counts.active), label: "مهمة نشطة" },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
        <Link
          to="/task-form"
          search={{ id: "" }}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" />
          إضافة مهمة
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
        >
          إضافة سريعة
        </button>
        </div>
      </div>

      <Pills
        variant="card"
        defaultKey="all"
        onChange={(key) => {
          setType(key);
          setStatus("all");
        }}
        items={[
          { key: "all", label: "كل المهام", count: counts.all, icon: CircleCheck },
          { key: "normal", label: "عادية", count: counts.normal },
          { key: "photography", label: "تصوير", count: counts.photography, icon: Camera },
        ]}
      />

      <Pills
        key={type}
        defaultKey="all"
        onChange={setStatus}
        items={[
          { key: "all", label: "الكل", count: counts.typeAll },
          { key: "in_progress", label: "قيد التنفيذ", count: counts.inProgress },
          { key: "submitted", label: "تنتظر الموافقة", count: counts.submitted },
          { key: "done", label: "مكتملة", count: counts.done },
          { key: "overdue", label: "متأخرة", count: counts.overdue },
        ]}
      />

      {isLoading ? (
        <div className="surface-card grid place-items-center gap-2 px-6 py-16 text-center">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-[13px] text-muted-foreground">جاري تحميل المهام…</p>
        </div>
      ) : (
        <div className="space-y-3">
          <StatusLegend />
          <DataTable<Row>
          rows={filtered}
          onRowClick={(r) => navigate({ to: "/task-form", search: { id: r.id } })}
          selectable
          showColumnsButton
          draggableRows
          dragLabel="مهمة"
          searchPlaceholder="بحث بعنوان المهمة"
          rowClassName={(r) => toneRowClass[rowTone(r.status, r.due_date)]}
          emptyState={
            <EmptyState
              text="لا توجد مهام"
              hint="أنشئ مهمة وحدد نوعها وموعد تسليمها لتظهر هنا مع حالتها."
            />
          }
          columns={[
            { header: "المهمة", sortable: true, cell: (r) => r.title, className: "font-semibold" },
            {
              header: "النوع",
              cell: (r) => (
                <Chip tone={r.task_type === "photography" ? "gold" : "neutral"}>
                  {r.task_type === "photography" ? "تصوير" : "عادية"}
                </Chip>
              ),
            },
            {
              header: "الأولوية",
              cell: (r) => (
                <Chip tone={r.priority === "high" || r.priority === "urgent" ? "danger" : "warning"}>
                  {priorityLabels[r.priority] ?? r.priority}
                </Chip>
              ),
            },
            {
              header: "الموظف",
              cell: (r) => assigneeNames.data?.[r.id]?.join("، ") || "—",
            },
            {
              header: "الموقع",
              cell: (r) =>
                r.location_lat != null && r.location_lng != null ? (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${r.location_lat},${r.location_lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary"
                  >
                    <MapPin className="size-3.5" />
                    {r.location_text || "عرض على الخريطة"}
                  </a>
                ) : (
                  (r.location_text ?? "—")
                ),
            },
            {
              header: "الموعد",
              sortable: true,
              value: (r) => r.due_date ?? "",
              cell: (r) => [formatDate(r.due_date), r.due_time].filter(Boolean).join(" · ") || "—",
            },
            {
              header: "الحالة الكلية",
              cell: (r) => (
                <select
                  value={r.status}
                  onChange={(e) => changeStatus.mutate({ id: r.id, status: e.target.value })}
                  className={`h-9 rounded-lg border px-2 text-[12.5px] font-semibold outline-none ${toneBadgeClass[rowTone(r.status, r.due_date)]}`}
                  aria-label="حالة المهمة"
                >
                  {statusOrder.map((s) => (
                    <option key={s} value={s}>
                      {taskStatusLabels[s] ?? s}
                    </option>
                  ))}
                </select>
              ),
            },
            {
              header: "أُنشئت",
              sortable: true,
              value: (r) => r.created_at,
              cell: (r) => formatDate(r.created_at),
            },
            {
              header: "إجراءات",
              cell: (r) => (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`حذف المهمة "${r.title}"؟`)) remove.mutate(r.id);
                  }}
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-destructive"
                >
                  <Trash2 className="size-4" />
                  حذف
                </button>
              ),
            },
          ]}
          />
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        wide
        title="إضافة مهمة"
        subtitle="حدّد نوع المهمة وأولويتها وموعد تسليمها والعقار المرتبط بها."
        footer={
          <>
            <PrimaryButton onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              حفظ المهمة
            </PrimaryButton>
            <GhostButton onClick={() => setOpen(false)}>إلغاء</GhostButton>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="عنوان المهمة" className="sm:col-span-2">
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="مثال: تصوير شقة حي الرحاب"
            />
          </Field>
          <Field label="النوع">
            <select
              className={inputClass}
              value={form.task_type}
              onChange={(e) => set({ task_type: e.target.value })}
            >
              <option value="normal">عادية</option>
              <option value="photography">تصوير</option>
            </select>
          </Field>
          <Field label="الأولوية">
            <select
              className={inputClass}
              value={form.priority}
              onChange={(e) => set({ priority: e.target.value })}
            >
              {Object.entries(priorityLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="تاريخ التسليم">
            <input
              type="date"
              className={inputClass}
              value={form.due_date}
              onChange={(e) => set({ due_date: e.target.value })}
            />
          </Field>
          <Field label="وقت التسليم">
            <input
              type="time"
              className={inputClass}
              value={form.due_time}
              onChange={(e) => set({ due_time: e.target.value })}
            />
          </Field>
          <Field label="العقار المرتبط" className="sm:col-span-2">
            <select
              className={inputClass}
              value={form.property_id}
              onChange={(e) => set({ property_id: e.target.value })}
            >
              <option value="">— بدون —</option>
              {(properties.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="تفاصيل المهمة" className="sm:col-span-2">
            <textarea
              className={textareaClass}
              value={form.details}
              onChange={(e) => set({ details: e.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
