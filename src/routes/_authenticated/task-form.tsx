import { uploadMedia, mediaUrl } from "@/lib/media";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Camera,
  Check,
  ClipboardList,
  Loader2,
  Paperclip,
  Trash2,
  UploadCloud,
  Users,
  MapPin,
  Send,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Field, inputClass, textareaClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";
import { priorityLabels, taskStatusLabels } from "@/lib/labels";
import { notifyTaskNow } from "@/lib/tasks.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/task-form")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search["id"] === "string" ? (search["id"] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "إضافة / تعديل مهمة | الرشودي للعقارات" },
      {
        name: "description",
        content: "نموذج كامل لإنشاء مهمة: النوع، التفاصيل، الأولوية، الموعد، الموظفون المكلّفون والمرفقات.",
      },
      { property: "og:title", content: "إضافة / تعديل مهمة | الرشودي للعقارات" },
      { property: "og:description", content: "تكليف الفريق بمهام عادية أو مهام تصوير ومتابعة تنفيذها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TaskFormPage,
});

const emptyForm = {
  title: "",
  details: "",
  task_type: "normal",
  priority: "normal",
  status: "new",
  due_date: "",
  due_time: "",
  property_id: "",
  contact_id: "",
  location_text: "",
  location_lat: "",
  location_lng: "",
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
  icon: typeof ClipboardList;
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

function TaskFormPage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const task = useQuery({
    queryKey: ["task", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const taskAssignees = useQuery({
    queryKey: ["task-assignees", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_assignees")
        .select("id, user_id")
        .eq("task_id", id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const attachments = useQuery({
    queryKey: ["task-attachments", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_attachments")
        .select("id, file_path, file_name, kind")
        .eq("task_id", id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const employees = useQuery({
    queryKey: ["profiles", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, job_title")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const properties = useQuery({
    queryKey: ["properties", "select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, code")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const contacts = useQuery({
    queryKey: ["contacts", "select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, full_name")
        .order("full_name")
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const row = task.data;
    if (!row) return;
    setForm({
      title: row.title ?? "",
      details: row.details ?? "",
      task_type: row.task_type ?? "normal",
      priority: row.priority ?? "normal",
      status: row.status ?? "new",
      due_date: row.due_date ?? "",
      due_time: row.due_time ?? "",
      property_id: row.property_id ?? "",
      contact_id: row.contact_id ?? "",
      location_text: (row as Record<string, unknown>)["location_text"]?.toString() ?? "",
      location_lat: (row as Record<string, unknown>)["location_lat"]?.toString() ?? "",
      location_lng: (row as Record<string, unknown>)["location_lng"]?.toString() ?? "",
    });
  }, [task.data]);

  useEffect(() => {
    if (taskAssignees.data) setAssignees(taskAssignees.data.map((a) => a.user_id));
  }, [taskAssignees.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("عنوان المهمة مطلوب");
      const payload = {
        title: form.title.trim(),
        details: form.details.trim() || null,
        task_type: form.task_type,
        priority: form.priority,
        status: form.status,
        due_date: form.due_date || null,
        due_time: form.due_time || null,
        property_id: form.property_id || null,
        contact_id: form.contact_id || null,
        location_text: form.location_text.trim() || null,
        location_lat: form.location_lat ? Number(form.location_lat) : null,
        location_lng: form.location_lng ? Number(form.location_lng) : null,
      };
      let taskId = id;
      if (taskId) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", taskId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("tasks").insert(payload).select("id").single();
        if (error) throw error;
        taskId = data.id as string;
      }
      const current = (taskAssignees.data ?? []).map((a) => a.user_id);
      const toAdd = assignees.filter((u) => !current.includes(u));
      const toRemove = current.filter((u) => !assignees.includes(u));
      if (toAdd.length) {
        const { error } = await supabase
          .from("task_assignees")
          .insert(toAdd.map((user_id) => ({ task_id: taskId, user_id })));
        if (error) throw error;
      }
      if (toRemove.length) {
        const { error } = await supabase
          .from("task_assignees")
          .delete()
          .eq("task_id", taskId)
          .in("user_id", toRemove);
        if (error) throw error;
      }
      return { taskId, added: toAdd };
    },
    onSuccess: async ({ taskId: newId, added }) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      queryClient.invalidateQueries({ queryKey: ["task-assignees", newId] });
      toast.success(id ? "تم تحديث المهمة" : "تم إنشاء المهمة وتكليف الفريق");
      if (added.length && newId) {
        try {
          const result = await notifyTaskNow({
            data: { taskId: newId, userIds: added, schedule: true },
          });
          if (result.sent > 0) toast.success(`تم إرسال المهمة على واتساب لـ ${result.sent} موظف`);
          if (result.failed > 0) toast.error(`تعذّر إرسال واتساب لـ ${result.failed} موظف`);
          queryClient.invalidateQueries({ queryKey: ["task-reminder-state", newId] });
        } catch {
          toast.error("تعذّر إرسال المهمة على واتساب");
        }
      }
      if (!id && newId) navigate({ to: "/task-form", search: { id: newId } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحفظ"),
  });

  const reminderState = useQuery({
    queryKey: ["task-reminder-state", id],
    enabled: Boolean(id),
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_reminder_state")
        .select("id, user_id, next_send_at, sent_count")
        .eq("task_id", id!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const nextSend = (reminderState.data ?? [])
    .map((r) => r.next_send_at)
    .filter(Boolean)
    .sort()[0] as string | undefined;

  const sendTask = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("احفظ المهمة أولًا قبل إرسالها");
      if (!assignees.length) throw new Error("اختر موظفًا واحدًا على الأقل");
      return notifyTaskNow({ data: { taskId: id, userIds: assignees, schedule: true } });
    },
    onSuccess: (result) => {
      if (result.sent > 0) toast.success(`تم إرسال المهمة على واتساب لـ ${result.sent} موظف`);
      if (result.failed > 0) toast.error(`تعذّر إرسال واتساب لـ ${result.failed} موظف`);
      if (result.skipped > 0) toast.warning(`${result.skipped} موظف بدون رقم واتساب مفعّل`);
      queryClient.invalidateQueries({ queryKey: ["task-reminder-state", id] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر إرسال المهمة"),
  });

  const completeTask = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("احفظ المهمة أولًا");
      return finishTask({ data: { taskId: id } });
    },
    onSuccess: () => {
      toast.success("تم إنهاء المهمة وإيقاف رسائل واتساب المتكررة");
      setForm((f) => ({ ...f, status: "done" }));
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      queryClient.invalidateQueries({ queryKey: ["task-reminder-state", id] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر إنهاء المهمة"),
  });

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!id) {
      toast.error("احفظ المهمة أولًا ثم أرفق الملفات");
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const path = `tasks/${id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        await uploadMedia("internal-files", path, file);
        const { error } = await supabase.from("task_attachments").insert({
          task_id: id,
          file_path: path,
          file_name: file.name,
          kind: "reference",
        });
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["task-attachments", id] });
      toast.success("تم إرفاق الملفات");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر الإرفاق");
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase.from("task_attachments").delete().eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-attachments", id] });
      toast.success("تم حذف المرفق");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحذف"),
  });

  const openAttachment = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("internal-files")
      .createSignedUrl(path, 60 * 10);
    if (error || !data) {
      toast.error("تعذّر فتح الملف");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <>
      <PageHero
        title={id ? "تعديل مهمة" : "إضافة مهمة جديدة"}
        subtitle="حدّد نوع المهمة والموظفين المكلّفين والموعد، وأرفق الصور المرجعية عند الحاجة."
        icon={form.task_type === "photo" ? Camera : ClipboardList}
      />

      <div className="flex items-center justify-between gap-3">
        <Link
          to="/tasks"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold transition-colors hover:bg-muted"
        >
          <ArrowRight className="size-4" />
          رجوع لقائمة المهام
        </Link>
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-[13px] font-bold text-primary-foreground disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {id ? "حفظ التعديلات" : "حفظ المهمة"}
        </button>
      </div>

      <SectionCard
        title="نوع المهمة"
        subtitle="المهمة العادية للأعمال الإدارية، ومهمة التصوير لتغطية عقار بالصور والفيديو."
        icon={ClipboardList}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { key: "normal", label: "مهمة عادية", hint: "متابعة، اتصال، زيارة، تجهيز مستندات", icon: ClipboardList },
            { key: "photo", label: "مهمة تصوير", hint: "تصوير عقار ورفع الصور والفيديو", icon: Camera },
          ].map((item) => {
            const Icon = item.icon;
            const active = form.task_type === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => set({ task_type: item.key })}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-4 text-start transition-colors",
                  active ? "border-primary bg-accent/50" : "border-border hover:bg-muted",
                )}
              >
                <Icon className="mt-0.5 size-5 text-primary" />
                <span>
                  <span className="block text-[13.5px] font-bold">{item.label}</span>
                  <span className="block text-[12px] text-muted-foreground">{item.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="بيانات المهمة"
        subtitle="العنوان والتفاصيل والأولوية والحالة والموعد."
        icon={Check}
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
          <Field label="تفاصيل المهمة" className="sm:col-span-2">
            <textarea
              className={textareaClass}
              value={form.details}
              onChange={(e) => set({ details: e.target.value })}
              placeholder="اكتب الخطوات المطلوبة بالتفصيل"
            />
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
          <Field label="الحالة">
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => set({ status: e.target.value })}
            >
              {Object.entries(taskStatusLabels).map(([key, label]) => (
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
              dir="ltr"
              value={form.due_date}
              onChange={(e) => set({ due_date: e.target.value })}
            />
          </Field>
          <Field label="وقت التسليم">
            <input
              type="time"
              className={inputClass}
              dir="ltr"
              value={form.due_time}
              onChange={(e) => set({ due_time: e.target.value })}
            />
          </Field>
          <Field label="العقار المرتبط">
            <select
              className={inputClass}
              value={form.property_id}
              onChange={(e) => set({ property_id: e.target.value })}
            >
              <option value="">— بدون —</option>
              {(properties.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code ? `${p.code} — ` : ""}
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="العميل المرتبط">
            <select
              className={inputClass}
              value={form.contact_id}
              onChange={(e) => set({ contact_id: e.target.value })}
            >
              <option value="">— بدون —</option>
              {(contacts.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="موقع المهمة"
        subtitle="حدد وصف الموقع والإحداثيات؛ تظهر خريطة مصغّرة للموظف مع إمكانية فتح الاتجاهات."
        icon={MapPin}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="وصف الموقع" className="sm:col-span-3">
            <input
              className={inputClass}
              value={form.location_text}
              onChange={(e) => set({ location_text: e.target.value })}
              placeholder="مثال: حي الملقا - شارع أنس بن مالك"
            />
          </Field>
          <Field label="خط العرض (Lat)">
            <input
              className={inputClass}
              dir="ltr"
              value={form.location_lat}
              onChange={(e) => set({ location_lat: e.target.value })}
              placeholder="24.7136"
            />
          </Field>
          <Field label="خط الطول (Lng)">
            <input
              className={inputClass}
              dir="ltr"
              value={form.location_lng}
              onChange={(e) => set({ location_lng: e.target.value })}
              placeholder="46.6753"
            />
          </Field>
          <Field label="اتجاهات">
            {form.location_lat && form.location_lng ? (
              <a
                className="inline-flex h-10 items-center rounded-lg border border-border px-3 text-[13px] font-semibold text-primary"
                href={`https://www.google.com/maps/dir/?api=1&destination=${form.location_lat},${form.location_lng}`}
                target="_blank"
                rel="noreferrer"
              >
                فتح في خرائط Google
              </a>
            ) : (
              <p className="text-[12.5px] text-muted-foreground">أدخل الإحداثيات لعرض الخريطة.</p>
            )}
          </Field>
        </div>
        {form.location_lat && form.location_lng ? (
          <iframe
            title="خريطة موقع المهمة"
            className="mt-4 h-56 w-full rounded-xl border border-border"
            loading="lazy"
            src={`https://www.google.com/maps?q=${form.location_lat},${form.location_lng}&z=15&output=embed`}
          />
        ) : null}
      </SectionCard>


      <SectionCard
        title="الموظفون المكلّفون"
        subtitle="اختيار الموظف يحفظ التكليف فقط؛ لن تُرسل أي رسالة إلا عند الضغط على زر واتساب."
        icon={Users}
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(employees.data ?? []).map((emp) => {
            const active = assignees.includes(emp.id);
            return (
              <button
                key={emp.id}
                type="button"
                onClick={() =>
                  setAssignees((prev) =>
                    prev.includes(emp.id) ? prev.filter((x) => x !== emp.id) : [...prev, emp.id],
                  )
                }
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-start text-[13px] transition-colors",
                  active ? "border-primary bg-accent/50 font-bold" : "border-border hover:bg-muted",
                )}
              >
                <span>
                  {emp.full_name || "بدون اسم"}
                  {emp.job_title ? (
                    <span className="block text-[11.5px] font-normal text-muted-foreground">
                      {emp.job_title}
                    </span>
                  ) : null}
                </span>
                {active ? <Check className="size-4 text-primary" /> : null}
              </button>
            );
          })}
          {!employees.data?.length ? (
            <p className="text-[12.5px] text-muted-foreground">لا يوجد موظفون نشطون بعد.</p>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="المرفقات المرجعية"
        subtitle="صور أو ملفات توضّح المطلوب — تُخزَّن بشكل خاص للفريق فقط."
        icon={Paperclip}
      >
        {!id ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-muted-foreground">
            احفظ المهمة أولًا لتفعيل المرفقات.
          </p>
        ) : (
          <div className="space-y-4">
            <label className="grid cursor-pointer place-items-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center">
              {uploading ? (
                <Loader2 className="size-6 animate-spin text-primary" />
              ) : (
                <UploadCloud className="size-6 text-muted-foreground" />
              )}
              <span className="text-[13px] text-muted-foreground">اضغط لاختيار الملفات</span>
              <input type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
            </label>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {(attachments.data ?? []).map((file) => (
                <li key={file.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => openAttachment(file.file_path)}
                    className="truncate text-[12.5px] font-semibold text-primary"
                  >
                    {file.file_name || file.file_path}
                  </button>
                  <button
                    type="button"
                    aria-label="حذف المرفق"
                    onClick={() => removeAttachment.mutate(file.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
              {!attachments.data?.length ? (
                <li className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
                  لا توجد مرفقات
                </li>
              ) : null}
            </ul>
          </div>
        )}
      </SectionCard>

      <div className="flex flex-wrap items-center justify-center gap-3 pb-4">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-[13.5px] font-bold text-primary-foreground disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {id ? "حفظ التعديلات" : "حفظ المهمة"}
        </button>
        {id ? (
          <button
            type="button"
            onClick={() => sendTask.mutate()}
            disabled={sendTask.isPending || assignees.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-[13.5px] font-bold text-primary disabled:opacity-60"
          >
            {sendTask.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            إرسال المهمة على واتساب
          </button>
        ) : null}
        <Link
          to="/tasks"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-[13.5px] font-semibold"
        >
          <ArrowRight className="size-4" />
          رجوع
        </Link>
      </div>
    </>
  );
}
