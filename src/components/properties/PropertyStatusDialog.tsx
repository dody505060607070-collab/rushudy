import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Field, GhostButton, Modal, PrimaryButton, inputClass, textareaClass } from "@/components/kit/Modal";
import { supabase } from "@/integrations/supabase/client";

export type StatusTarget = { id: string; name: string; status: string; purpose: string };

export function PropertyStatusDialog({ target, onClose, onSaved }: { target: StatusTarget | null; onClose: () => void; onSaved: () => void }) {
  const next = target?.status === "available" ? (target.purpose === "sale" ? "sold" : "rented") : "available";
  const [employeeId, setEmployeeId] = useState("");
  const [contactId, setContactId] = useState("");
  const [amount, setAmount] = useState("");
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const employees = useQuery({ queryKey: ["status-employees"], enabled: Boolean(target), queryFn: async () => { const r = await supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"); if (r.error) throw r.error; return r.data ?? []; } });
  const contacts = useQuery({ queryKey: ["status-contacts"], enabled: Boolean(target), queryFn: async () => { const r = await supabase.from("contacts").select("id, full_name").eq("is_active", true).order("full_name").limit(500); if (r.error) throw r.error; return r.data ?? []; } });
  const save = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const result = await supabase.rpc("record_property_status_change", { _property_id: target.id, _status: next, _employee_id: employeeId || undefined, _contact_id: contactId || undefined, _amount: amount ? Number(amount) : undefined, _event_date: eventDate, _notes: notes || undefined });
      if (result.error) throw result.error;
      onSaved();
      onClose();
    } finally { setBusy(false); }
  };
  return <Modal open={Boolean(target)} onClose={onClose} title={`تغيير حالة ${target?.name ?? "العقار"}`} subtitle={`الحالة الجديدة: ${next === "available" ? "متاح" : next === "sold" ? "مباع" : "مؤجر"}. كل البيانات التالية اختيارية.`} footer={<><PrimaryButton onClick={() => void save()} disabled={busy}>{busy ? "جاري الحفظ…" : "تأكيد وحفظ"}</PrimaryButton><GhostButton onClick={onClose}>إلغاء</GhostButton></>}>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="الموظف المنفذ"><select className={inputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}><option value="">بدون تحديد</option>{employees.data?.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></Field>
      <Field label="العميل"><select className={inputClass} value={contactId} onChange={(e) => setContactId(e.target.value)}><option value="">بدون تحديد</option>{contacts.data?.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}</select></Field>
      <Field label="قيمة العملية"><input type="number" min="0" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <Field label="تاريخ العملية"><input type="date" className={inputClass} value={eventDate} onChange={(e) => setEventDate(e.target.value)} /></Field>
      <Field label="تفاصيل" className="sm:col-span-2"><textarea className={textareaClass} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
    </div>
  </Modal>;
}