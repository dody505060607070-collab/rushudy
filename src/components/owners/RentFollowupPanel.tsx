import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { textareaClass } from "@/components/kit/Modal";
import { getRentFollowup, saveRentFollowup } from "@/lib/rent-followup.functions";
import { useCurrentUser } from "@/hooks/useAuth";
import { formatDate } from "@/components/kit/LiveTable";

export function RentFollowupPanel() {
  const get = useServerFn(getRentFollowup); const save = useServerFn(saveRentFollowup);
  const { isSuperAdmin } = useCurrentUser(); const qc = useQueryClient(); const [draft,setDraft] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["rent-followup"], queryFn: () => get() });
  const mutation = useMutation({ mutationFn: (data: { enabled?: boolean; template?: string }) => save({ data }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["rent-followup"] }); setDraft(null); toast.success("تم حفظ إعدادات المتابعة"); }, onError: (e: Error) => toast.error(e.message) });
  return <section className="space-y-4 border-y border-border py-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-bold"><CalendarClock className="size-5 text-primary" />متابعة ملاك الإيجار — كل 30 يومًا</h2>{query.data && isSuperAdmin ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={query.data.enabled} disabled={mutation.isPending} onChange={e => { if (!e.target.checked || window.confirm("تفعيل رسائل واتساب الدورية لملاك الإيجار كل 30 يومًا؟")) mutation.mutate({ enabled: e.target.checked }); }} />الإرسال الدوري</label> : null}</div>
    {query.isError ? <p role="alert" className="text-sm text-warning">تعذّر تحميل إعدادات المتابعة الشهرية: {query.error.message}</p> : query.isPending ? <p>جارٍ التحميل…</p> : <>
      <p className="text-sm text-muted-foreground">المتابعة القادمة: {query.data.nextAt ? formatDate(query.data.nextAt) : "غير مفعّلة"}</p>
      <textarea aria-label="رسالة ملاك الإيجار" className={textareaClass} rows={7} value={draft ?? query.data.template} onChange={e => setDraft(e.target.value)} disabled={!isSuperAdmin} />
      {isSuperAdmin ? <Button disabled={mutation.isPending || draft === null} onClick={() => mutation.mutate({ template: draft ?? query.data.template })}><Save />حفظ الرسالة</Button> : null}
      <h3 className="font-semibold">سجل الإرسال</h3><div className="max-h-64 space-y-2 overflow-y-auto">{query.data.logs.length ? query.data.logs.map(log => <div key={log.id} className="flex flex-wrap justify-between gap-2 border-b border-border py-2 text-sm"><span>{log.recipient_name}</span><span>{log.result === "read" ? "مقروءة" : log.result === "delivered" ? "تم التوصيل" : log.result === "failed" ? `تعذّر الإرسال: ${log.failure_reason}` : "قُبلت للإرسال — التوصيل غير مؤكد"}</span><time className="text-muted-foreground">{formatDate(log.created_at)}</time></div>) : <p className="text-sm text-muted-foreground">لا توجد رسائل مسجلة.</p>}</div>
    </>}
  </section>;
}