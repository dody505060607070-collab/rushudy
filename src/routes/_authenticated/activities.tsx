import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Loader2, MessageSquare, Plus, Send, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { Field, GhostButton, Modal, PrimaryButton, inputClass, textareaClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { sendWhatsAppMessage } from "@/lib/whatsapp.functions";
import { sendPushToUsers } from "@/lib/push.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/activities")({
  head: () => ({
    meta: [
      { title: "المتابعات والأنشطة | الرشودي للعقارات" },
      { name: "description", content: "إسناد الأنشطة للموظفين ومحادثة خاصة لمتابعة النتيجة." },
      { property: "og:title", content: "المتابعات والأنشطة | الرشودي للعقارات" },
      { property: "og:description", content: "إسناد الأنشطة للموظفين ومحادثة خاصة لمتابعة النتيجة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ActivitiesPage,
});

const typeLabels: Record<string, string> = {
  task: "مهمة متابعة",
  call: "مكالمة",
  whatsapp: "واتساب",
  meeting: "اجتماع",
  visit: "معاينة",
  collection: "تحصيل",
  note: "ملاحظة",
};

type FormState = {
  employee_id: string;
  activity_type: string;
  subject: string;
  details: string;
  related_contact_id: string;
  notes: string;
};

type Activity = {
  id: string;
  employee_id: string;
  created_by: string | null;
  activity_type: string;
  subject: string;
  details: string | null;
  notes: string | null;
  related_contact_id: string | null;
  status: string;
  outcome: string | null;
  closed_at: string | null;
  created_at: string;
  employee: { full_name: string; job_title: string | null } | null;
  contact: { full_name: string } | null;
};

const SELECT =
  "id, employee_id, created_by, activity_type, subject, details, notes, related_contact_id, status, outcome, closed_at, created_at, employee:employee_id(full_name, job_title), contact:related_contact_id(full_name)";

export function ActivitiesPage() {
  const qc = useQueryClient();
  const { userId, isSuperAdmin } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"open" | "closed">("open");

  const activities = useQuery({
    queryKey: ["employee-activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_activities")
        .select(SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Activity[];
    },
  });

  const employees = useQuery({
    queryKey: ["staff-profiles"],
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

  const contacts = useQuery({
    queryKey: ["contacts-mini"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, full_name")
        .order("full_name")
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(
    () => (activities.data ?? []).filter((a) => (tab === "open" ? a.status !== "closed" : a.status === "closed")),
    [activities.data, tab],
  );

  const active = (activities.data ?? []).find((a) => a.id === selected) ?? null;

  const create = useMutation({
    mutationFn: async (form: FormState) => {
      if (!form.employee_id || !form.subject.trim()) throw new Error("اختر الموظف واكتب الموضوع");
      const { data, error } = await supabase
        .from("employee_activities")
        .insert({
          employee_id: form.employee_id,
          created_by: userId ?? null,
          activity_type: form.activity_type || "task",
          subject: form.subject.trim(),
          details: form.details || null,
          notes: form.notes || null,
          related_contact_id: form.related_contact_id || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: form.employee_id,
        title: "نشاط جديد مُسند إليك",
        body: form.subject.trim(),
        link: "/activities",
      });
      // إرسال النشاط للموظف على واتساب (بفعل صريح من المستخدم عند الإسناد)
      let whatsapp: "sent" | "no-phone" | "failed" = "no-phone";
      const { data: emp } = await supabase
        .from("profiles")
        .select("full_name, phone, whatsapp")
        .eq("id", form.employee_id)
        .maybeSingle();
      const to = (emp?.whatsapp || emp?.phone || "").trim();
      if (to) {
        const lines = [
          `مرحبًا ${emp?.full_name ?? ""}، تم إسناد متابعة جديدة لك:`,
          `الموضوع: ${form.subject.trim()}`,
          form.details ? `التفاصيل: ${form.details}` : "",
          `أسندها: ${(employees.data ?? []).find((e) => e.id === userId)?.full_name ?? "الإدارة"}`,
          `${window.location.origin}/activities`,
        ].filter(Boolean);
        try {
          const res = await sendWhatsAppMessage({ data: { to, body: lines.join("\n") } });
          whatsapp = res.ok ? "sent" : "failed";
        } catch {
          whatsapp = "failed";
        }
      }
      return { ...data, whatsapp };
    },
    onSuccess: (d) => {
      toast.success("تم إسناد النشاط للموظف");
      if (d?.whatsapp === "sent") toast.success("تم إرسال المتابعة للموظف على واتساب");
      else if (d?.whatsapp === "no-phone") toast.warning("لم يُرسل واتساب: لا يوجد رقم جوال لهذا الموظف");
      else toast.error("تعذّر إرسال المتابعة على واتساب");
      setOpen(false);
      setSelected(d?.id ?? null);
      qc.invalidateQueries({ queryKey: ["employee-activities"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const close = useMutation({
    mutationFn: async ({ id, outcome }: { id: string; outcome: string }) => {
      const { error } = await supabase
        .from("employee_activities")
        .update({ status: "closed", outcome: outcome || null, closed_by: userId ?? null, closed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إغلاق النشاط");
      qc.invalidateQueries({ queryKey: ["employee-activities"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHero
        title="المتابعات والأنشطة"
        subtitle="يختار المدير العام الموظف ونوع النشاط، وتبقى المحادثة مفتوحة بينهما حتى إغلاقها."
        icon={Users}
        stats={[
          { value: String((activities.data ?? []).filter((a) => a.status !== "closed").length), label: "أنشطة مفتوحة" },
          { value: String((activities.data ?? []).filter((a) => a.status === "closed").length), label: "منتهية" },
        ]}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <div className="flex min-w-0 gap-2">
          {(["open", "closed"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-colors",
                tab === t ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
              )}
            >
              {t === "open" ? "مفتوحة" : "منتهية"}
            </button>
          ))}
        </div>
        <PrimaryButton onClick={() => setOpen(true)}>
          <Plus className="size-4" /> تسجيل نشاط
        </PrimaryButton>
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-2">
          {activities.isLoading ? (
            <div className="surface-card grid h-32 place-items-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="surface-card p-6 text-center text-[13px] text-muted-foreground">لا توجد أنشطة.</div>
          ) : (
            rows.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelected(a.id)}
                className={cn(
                  "w-full rounded-xl border bg-card p-3 text-start transition-colors",
                  selected === a.id ? "border-primary shadow-card" : "border-border hover:bg-accent/40",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <Chip tone={a.status === "closed" ? "neutral" : "success"}>
                    {a.status === "closed" ? "منتهٍ" : "مفتوح"}
                  </Chip>
                  <span className="truncate text-[13.5px] font-bold text-foreground">{a.subject}</span>
                </div>
                <p className="mt-1 text-end text-[12px] text-muted-foreground">
                  المكلَّف: {a.employee?.full_name ?? "—"} • أسندها: {(employees.data ?? []).find((e) => e.id === a.created_by)?.full_name ?? "—"} • {typeLabels[a.activity_type] ?? a.activity_type}
                </p>
              </button>
            ))
          )}
        </div>

        <div className="min-w-0">
          {active ? (
            <ActivityPanel
              activity={active}
              canClose={isSuperAdmin}
              onClose={(outcome) => close.mutate({ id: active.id, outcome })}
              closing={close.isPending}
            />
          ) : (
            <div className="surface-card grid h-full min-h-56 place-items-center p-8 text-center text-[13px] text-muted-foreground">
              اختر نشاطًا لعرض المحادثة الخاصة بينك وبين الموظف.
            </div>
          )}
        </div>
      </div>

      {open ? (
        <CreateModal
          employees={employees.data ?? []}
          contacts={contacts.data ?? []}
          onClose={() => setOpen(false)}
          onSubmit={(f) => create.mutate(f)}
          saving={create.isPending}
        />
      ) : null}
    </>
  );
}

function CreateModal({
  employees,
  contacts,
  onClose,
  onSubmit,
  saving,
}: {
  employees: { id: string; full_name: string; job_title: string | null }[];
  contacts: { id: string; full_name: string }[];
  onClose: () => void;
  onSubmit: (f: FormState) => void;
  saving: boolean;
}) {
  const [f, setF] = useState<FormState>({
    employee_id: "",
    activity_type: "task",
    subject: "",
    details: "",
    related_contact_id: "",
    notes: "",
  });
  const set = (k: keyof FormState, v: string) => setF((p) => ({ ...p, [k]: v }));

  return (
    <Modal open title="تسجيل نشاط لموظف" onClose={onClose}>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="الموظف">
          <select className={inputClass} value={f.employee_id} onChange={(e) => set("employee_id", e.target.value)}>
            <option value="">اختر الموظف…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name} {e.job_title ? `— ${e.job_title}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="نوع النشاط">
          <select className={inputClass} value={f.activity_type} onChange={(e) => set("activity_type", e.target.value)}>
            {Object.entries(typeLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="موضوع النشاط">
          <input className={inputClass} value={f.subject} onChange={(e) => set("subject", e.target.value)} />
        </Field>
        <Field label="الجهة المرتبطة (اختياري)">
          <select
            className={inputClass}
            value={f.related_contact_id}
            onChange={(e) => set("related_contact_id", e.target.value)}
          >
            <option value="">بدون</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        </Field>
        <div className="md:col-span-2">
          <Field label="تفاصيل النشاط">
            <textarea className={textareaClass} value={f.details} onChange={(e) => set("details", e.target.value)} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="ملاحظات إضافية">
            <textarea className={textareaClass} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="mt-4 flex justify-start gap-2">
        <PrimaryButton onClick={() => onSubmit(f)} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null} إسناد النشاط
        </PrimaryButton>
        <GhostButton onClick={onClose}>إلغاء</GhostButton>
      </div>
    </Modal>
  );
}

function ActivityPanel({
  activity,
  canClose,
  onClose,
  closing,
}: {
  activity: Activity;
  canClose: boolean;
  onClose: (outcome: string) => void;
  closing: boolean;
}) {
  const qc = useQueryClient();
  const { userId } = useCurrentUser();
  const [body, setBody] = useState("");
  const [outcome, setOutcome] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const messages = useQuery({
    queryKey: ["activity-messages", activity.id],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_messages")
        .select("id, body, sender_id, created_at, sender:sender_id(full_name)")
        .eq("activity_id", activity.id)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        body: string;
        sender_id: string;
        created_at: string;
        sender: { full_name: string } | null;
      }[];
    },
  });

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.data?.length]);

  const send = useMutation({
    mutationFn: async () => {
      const text = body.trim();
      if (!text) return;
      const { error } = await supabase
        .from("activity_messages")
        .insert({ activity_id: activity.id, sender_id: userId!, body: text });
      if (error) throw error;
      const target = userId === activity.employee_id ? activity.created_by : activity.employee_id;
      if (target) {
        await supabase.from("notifications").insert({
          user_id: target,
          title: "رسالة جديدة في نشاط",
          body: `${activity.subject}: ${text.slice(0, 80)}`,
          link: "/activities",
        });
        void sendPushToUsers({
          data: {
            userIds: [target],
            title: "رسالة جديدة في نشاط",
            body: `${activity.subject}: ${text.slice(0, 80)}`,
            url: "/activities",
            tag: "mithra-activity",
          },
        }).catch(() => undefined);
      }
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["activity-messages", activity.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closed = activity.status === "closed";

  return (
    <section className="surface-card flex h-full flex-col overflow-hidden">
      <header className="border-b border-border bg-accent/40 px-4 py-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-bold text-foreground">{activity.subject}</h2>
            <p className="text-[12px] text-muted-foreground">
              {activity.employee?.full_name ?? "—"} • {typeLabels[activity.activity_type] ?? activity.activity_type}
              {activity.contact ? ` • ${activity.contact.full_name}` : ""}
            </p>
          </div>
          <Chip tone={closed ? "neutral" : "success"}>{closed ? "منتهٍ" : "مفتوح"}</Chip>
        </div>
        {activity.details ? (
          <p className="mt-2 whitespace-pre-wrap text-[13px] text-foreground/80">{activity.details}</p>
        ) : null}
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-4" style={{ maxHeight: 420 }}>
        {(messages.data ?? []).length === 0 ? (
          <p className="py-8 text-center text-[13px] text-muted-foreground">
            <MessageSquare className="mx-auto mb-2 size-5" />
            لا توجد رسائل بعد.
          </p>
        ) : (
          (messages.data ?? []).map((m) => {
            const mine = m.sender_id === userId;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-start" : "justify-end")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-[13.5px]",
                    mine ? "bg-primary text-primary-foreground" : "bg-accent text-foreground",
                  )}
                >
                  <p className="mb-0.5 text-[11px] opacity-70">{m.sender?.full_name ?? "—"}</p>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className="mt-1 text-[10.5px] opacity-60">
                    {new Date(m.created_at).toLocaleString("ar-SA")}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottom} />
      </div>

      {closed ? (
        <footer className="border-t border-border bg-accent/30 px-4 py-3 text-[13px] text-muted-foreground">
          تم إغلاق النشاط. النتيجة: {activity.outcome || "—"}
        </footer>
      ) : (
        <footer className="space-y-2 border-t border-border p-3">
          <div className="flex gap-2">
            <input
              className={inputClass}
              placeholder="اكتب رسالة…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send.mutate();
                }
              }}
            />
            <PrimaryButton onClick={() => send.mutate()} disabled={send.isPending}>
              <Send className="size-4" />
            </PrimaryButton>
          </div>
          {canClose ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={inputClass}
                placeholder="نتيجة النشاط قبل الإغلاق (اختياري)"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
              />
              <GhostButton onClick={() => onClose(outcome)} disabled={closing}>
                <CheckCircle2 className="size-4" /> إنهاء النشاط
              </GhostButton>
            </div>
          ) : null}
        </footer>
      )}
    </section>
  );
}
