import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, CalendarClock, Loader2, MapPin, Plus, Send, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Field, GhostButton, Modal, PrimaryButton, inputClass, textareaClass } from "@/components/kit/Modal";
import { supabase } from "@/integrations/supabase/client";
import { formatMeetingTime } from "@/lib/meeting-reminders";
import { sendMeetingReminderNow } from "@/lib/meeting-reminders.functions";

const empty = {
  title: "موعد معاينة", property_name: "", meeting_at: "", location_text: "", location_url: "", notes: "",
  owner_name: "", owner_phone: "", visitor_name: "", visitor_phone: "", agent_name: "", agent_phone: "",
  auto_enabled: true, interval_hours: 12,
};

export function MeetingReminders() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(empty);
  const sendNow = useServerFn(sendMeetingReminderNow);
  const set = (k: keyof typeof empty, v: string | boolean | number) => setF((p) => ({ ...p, [k]: v }));

  const list = useQuery({
    queryKey: ["meeting_reminders"],
    queryFn: async () => {
      const r = await supabase.from("meeting_reminders").select("*").order("meeting_at", { ascending: true }).limit(100);
      if (r.error) throw r.error;
      return r.data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!f.property_name.trim() || !f.meeting_at) throw new Error("اسم العقار ووقت الموعد مطلوبان");
      if (!f.owner_phone.trim() && !f.visitor_phone.trim() && !f.agent_phone.trim()) throw new Error("أضف رقمًا واحدًا على الأقل");
      const at = new Date(f.meeting_at);
      if (at <= new Date()) throw new Error("وقت الموعد يجب أن يكون في المستقبل");
      const { data: u } = await supabase.auth.getUser();
      const r = await supabase.from("meeting_reminders").insert({
        ...f, meeting_at: at.toISOString(), created_by: u.user?.id,
        interval_hours: Math.min(168, Math.max(1, Number(f.interval_hours) || 12)),
        next_send_at: f.auto_enabled ? new Date().toISOString() : null,
      });
      if (r.error) throw r.error;
    },
    onSuccess: () => { toast.success("تم حفظ الموعد"); setOpen(false); setF(empty); qc.invalidateQueries({ queryKey: ["meeting_reminders"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (p: { id: string; patch: Record<string, unknown> }) => {
      const r = await supabase.from("meeting_reminders").update(p.patch).eq("id", p.id);
      if (r.error) throw r.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting_reminders"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const push = useMutation({
    mutationFn: (id: string) => sendNow({ data: { id } }),
    onSuccess: (res) => {
      const failed = res.filter((x) => !x.ok);
      failed.length ? toast.error(`لم تصل لـ ${failed.length} طرف: ${failed[0].error}`) : toast.success("تم إرسال التذكير");
      qc.invalidateQueries({ queryKey: ["meeting_reminders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = list.data ?? [];
  return (
    <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarClock className="size-5 text-primary" /> مواعيد المعاينة والتذكير</h2>
          <p className="text-sm text-muted-foreground">موعد بين المالك والزائر والوسيط، ويصل لكل واحد تذكير واتساب برسالة خاصة به حتى يُغلق الموعد.</p>
        </div>
        <PrimaryButton onClick={() => setOpen(true)}><Plus className="size-4" /> موعد جديد</PrimaryButton>
      </div>

      {list.isLoading ? <Loader2 className="mx-auto size-5 animate-spin" /> : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">لا توجد مواعيد بعد.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((m) => {
            const closed = m.status === "closed";
            return (
              <div key={m.id} className={`rounded-xl border border-border p-3 ${closed ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{m.title} — {m.property_name}</p>
                    <p className="text-sm text-primary">{formatMeetingTime(m.meeting_at)}</p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{closed ? "مغلق" : "نشط"}</span>
                </div>
                {m.location_text || m.location_url ? (
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3.5" />
                    {m.location_text}{m.location_url ? <a href={m.location_url} target="_blank" rel="noreferrer" className="ms-1 underline">الخريطة</a> : null}
                  </p>
                ) : null}
                {m.notes ? <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/50 p-2 text-sm">{m.notes}</p> : null}
                <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {m.owner_phone ? <li>المالك: {m.owner_name} {m.owner_phone}</li> : null}
                  {m.visitor_phone ? <li>الزائر: {m.visitor_name} {m.visitor_phone}</li> : null}
                  {m.agent_phone ? <li>الوسيط: {m.agent_name} {m.agent_phone}</li> : null}
                  <li>
                    {m.auto_enabled && !closed ? `تذكير تلقائي كل ${m.interval_hours} ساعة` : "التذكير التلقائي متوقف"}
                    {" · "}أُرسل {m.sent_count} مرة
                  </li>
                </ul>
                {!closed ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <GhostButton onClick={() => push.mutate(m.id)} disabled={push.isPending}><Send className="size-3.5" /> أرسل الآن</GhostButton>
                    <GhostButton onClick={() => update.mutate({ id: m.id, patch: m.auto_enabled ? { auto_enabled: false, next_send_at: null } : { auto_enabled: true, next_send_at: new Date().toISOString() } })}>
                      <BellRing className="size-3.5" /> {m.auto_enabled ? "إيقاف التلقائي" : "تشغيل التلقائي"}
                    </GhostButton>
                    <GhostButton onClick={() => confirm("إغلاق الموعد وإيقاف كل الرسائل؟") && update.mutate({ id: m.id, patch: { status: "closed", next_send_at: null } })}>
                      <XCircle className="size-3.5" /> إغلاق
                    </GhostButton>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="موعد جديد" subtitle="وقت الموعد واسم العقار مطلوبان، والباقي اختياري."
        footer={<><GhostButton onClick={() => setOpen(false)}>إلغاء</GhostButton><PrimaryButton onClick={() => create.mutate()} disabled={create.isPending}>حفظ الموعد</PrimaryButton></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="عنوان الموعد"><input className={inputClass} value={f.title} onChange={(e) => set("title", e.target.value)} /></Field>
          <Field label="اسم العقار" required><input className={inputClass} value={f.property_name} onChange={(e) => set("property_name", e.target.value)} /></Field>
          <Field label="تاريخ ووقت الموعد" required><input type="datetime-local" className={inputClass} value={f.meeting_at} onChange={(e) => set("meeting_at", e.target.value)} /></Field>
          <Field label="المكان"><input className={inputClass} value={f.location_text} onChange={(e) => set("location_text", e.target.value)} /></Field>
          <Field label="رابط الموقع على الخريطة" className="sm:col-span-2"><input dir="ltr" className={inputClass} value={f.location_url} onChange={(e) => set("location_url", e.target.value)} /></Field>
          <Field label="ملاحظات الموعد (تصل للوسيط فقط)" className="sm:col-span-2"><textarea className={textareaClass} rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
          <Field label="اسم المالك"><input className={inputClass} value={f.owner_name} onChange={(e) => set("owner_name", e.target.value)} /></Field>
          <Field label="جوال المالك"><input dir="ltr" className={inputClass} value={f.owner_phone} onChange={(e) => set("owner_phone", e.target.value)} placeholder="05xxxxxxxx" /></Field>
          <Field label="اسم الزائر"><input className={inputClass} value={f.visitor_name} onChange={(e) => set("visitor_name", e.target.value)} /></Field>
          <Field label="جوال الزائر"><input dir="ltr" className={inputClass} value={f.visitor_phone} onChange={(e) => set("visitor_phone", e.target.value)} placeholder="05xxxxxxxx" /></Field>
          <Field label="اسم الوسيط / الموظف"><input className={inputClass} value={f.agent_name} onChange={(e) => set("agent_name", e.target.value)} /></Field>
          <Field label="جوال الوسيط"><input dir="ltr" className={inputClass} value={f.agent_phone} onChange={(e) => set("agent_phone", e.target.value)} placeholder="05xxxxxxxx" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.auto_enabled} onChange={(e) => set("auto_enabled", e.target.checked)} /> تذكير تلقائي</label>
          <Field label="كل كم ساعة؟"><input type="number" min={1} max={168} className={inputClass} value={f.interval_hours} onChange={(e) => set("interval_hours", Number(e.target.value))} /></Field>
        </div>
      </Modal>
    </section>
  );
}
