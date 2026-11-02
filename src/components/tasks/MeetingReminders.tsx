import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, CalendarClock, Loader2, MapPin, Plus, Send, XCircle } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
const LocationPicker = lazy(() => import("@/components/kit/LocationPicker").then((m) => ({ default: m.LocationPicker })));
import { toast } from "sonner";

import { Field, GhostButton, Modal, PrimaryButton, inputClass, textareaClass } from "@/components/kit/Modal";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { formatMeetingTime } from "@/lib/meeting-reminders";
import { sendMeetingReminderNow } from "@/lib/meeting-reminders.functions";

const empty = {
  title: "موعد معاينة", property_name: "", meeting_at: "", location_text: "", location_url: "", notes: "",
  owner_name: "", owner_phone: "", visitor_name: "", visitor_phone: "", agent_name: "", agent_phone: "",
  auto_enabled: true, interval_hours: 12,
  latitude: null as number | null, longitude: null as number | null,
};

export function MeetingReminders({ mode = "list", onCreated }: { mode?: "list" | "create"; onCreated?: () => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(empty);
  const [image, setImage] = useState<File | null>(null);
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
      let image_path: string | null = null;
      if (image) {
        if (!image.type.startsWith("image/")) throw new Error("الملف يجب أن يكون صورة");
        image_path = `${Date.now()}-${image.name.replace(/[^\w.-]/g, "_")}`;
        const up = await supabase.storage.from("meeting-media").upload(image_path, image, { contentType: image.type });
        if (up.error) throw up.error;
      }
      const r = await supabase.from("meeting_reminders").insert({
        ...f, image_path, meeting_at: at.toISOString(), ...(u.user ? { created_by: u.user.id } : {}),
        interval_hours: Math.min(168, Math.max(0, Number(f.interval_hours) || 0)),
        next_send_at: null,
      }).select("id").single();
      if (r.error) throw r.error;
      // أول تذكير يُرسل فورًا عند الحفظ، والباقي حسب المدة المحددة
      return sendNow({ data: { id: r.data.id } });
    },
    onSuccess: (res) => {
      const failed = (res ?? []).filter((x) => !x.ok);
      failed.length ? toast.error(`تم الحفظ، لكن لم تصل الرسالة لـ ${failed.length} طرف: ${failed[0]?.error ?? ""}`) : toast.success("تم حفظ طلب المعاينة وإرسال الرسائل");
      setOpen(false); setF(empty); setImage(null); qc.invalidateQueries({ queryKey: ["meeting_reminders"] }); onCreated?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (p: { id: string; patch: Database["public"]["Tables"]["meeting_reminders"]["Update"] }) => {
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
      failed.length ? toast.error(`لم تصل لـ ${failed.length} طرف: ${failed[0]?.error ?? ""}`) : toast.success("تم إرسال التذكير");
      qc.invalidateQueries({ queryKey: ["meeting_reminders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fields = (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="عنوان الموعد"><input className={inputClass} value={f.title} onChange={(e) => set("title", e.target.value)} /></Field>
      <Field label="اسم العقار" required><input className={inputClass} value={f.property_name} onChange={(e) => set("property_name", e.target.value)} /></Field>
      <Field label="تاريخ ووقت الموعد" required><input type="datetime-local" className={inputClass} value={f.meeting_at} onChange={(e) => set("meeting_at", e.target.value)} /></Field>
      <Field label="المكان"><input className={inputClass} value={f.location_text} onChange={(e) => set("location_text", e.target.value)} /></Field>
      <Field label="رابط الموقع على الخريطة (الصقه أو حدّد من الخريطة)" className="sm:col-span-2"><input dir="ltr" type="url" className={inputClass} value={f.location_url} onChange={(e) => set("location_url", e.target.value)} placeholder="https://maps.google.com/..." /></Field>
      <div className="sm:col-span-2">
        <ClientOnly fallback={<div className="h-72 rounded-xl bg-muted" />}>
          <Suspense fallback={<div className="h-72 rounded-xl bg-muted" />}>
            <LocationPicker latitude={f.latitude} longitude={f.longitude} onChange={(lat, lng) => setF((p) => ({ ...p, latitude: lat, longitude: lng, location_url: `https://maps.google.com/?q=${lat},${lng}` }))} />
          </Suspense>
        </ClientOnly>
      </div>
      <Field label="صورة (تصل مع رسالة الواتساب)" className="sm:col-span-2">
        <input type="file" accept="image/*" className={inputClass} onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
        {image ? <img src={URL.createObjectURL(image)} alt="معاينة الصورة" className="mt-2 h-32 rounded-lg object-cover" /> : null}
      </Field>
      <Field label="ملاحظات الموعد (تصل للوسيط فقط)" className="sm:col-span-2"><textarea className={textareaClass} rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      <Field label="اسم المالك"><input className={inputClass} value={f.owner_name} onChange={(e) => set("owner_name", e.target.value)} /></Field>
      <Field label="جوال المالك"><input dir="ltr" type="tel" className={inputClass} value={f.owner_phone} onChange={(e) => set("owner_phone", e.target.value)} placeholder="05xxxxxxxx" /></Field>
      <Field label="اسم الزائر"><input className={inputClass} value={f.visitor_name} onChange={(e) => set("visitor_name", e.target.value)} /></Field>
      <Field label="جوال الزائر"><input dir="ltr" type="tel" className={inputClass} value={f.visitor_phone} onChange={(e) => set("visitor_phone", e.target.value)} placeholder="05xxxxxxxx" /></Field>
      <Field label="اسم الوسيط / الموظف"><input className={inputClass} value={f.agent_name} onChange={(e) => set("agent_name", e.target.value)} /></Field>
      <Field label="جوال الوسيط"><input dir="ltr" type="tel" className={inputClass} value={f.agent_phone} onChange={(e) => set("agent_phone", e.target.value)} placeholder="05xxxxxxxx" /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.auto_enabled} onChange={(e) => set("auto_enabled", e.target.checked)} /> تذكير تلقائي</label>
      <Field label="كم مرة ترسل الرسالة؟">
        <select className={inputClass} value={f.interval_hours} onChange={(e) => set("interval_hours", Number(e.target.value))}>
          <option value={0}>تلقائي من النظام (يزيد كلما قرب الموعد)</option>
          <option value={6}>كل 6 ساعات</option>
          <option value={12}>كل 12 ساعة</option>
          <option value={24}>كل 24 ساعة</option>
          <option value={48}>كل يومين</option>
        </select>
      </Field>
    </div>
  );
  const saveButton = <PrimaryButton onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}حفظ طلب المعاينة</PrimaryButton>;
  if (mode === "create") return <section className="space-y-5 border-t border-border py-5"><h2 className="flex items-center gap-2 text-lg font-bold"><CalendarClock className="size-5 text-primary" />بيانات طلب المعاينة</h2>{fields}<div className="flex justify-end border-t border-border pt-4">{saveButton}</div></section>;

  const rows = list.data ?? [];
  return (
    <section className="py-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarClock className="size-5 text-primary" /> طلبات المعاينة</h2>
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
                    {m.auto_enabled && !closed ? (m.interval_hours ? `تذكير تلقائي كل ${m.interval_hours} ساعة` : "تذكير تلقائي يزيد كلما قرب الموعد") : "التذكير التلقائي متوقف"}
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

      <Modal open={open} onClose={() => setOpen(false)} title="طلب معاينة جديد" wide
        footer={<><GhostButton onClick={() => setOpen(false)}>إلغاء</GhostButton>{saveButton}</>}>
        {fields}
      </Modal>
    </section>
  );
}
