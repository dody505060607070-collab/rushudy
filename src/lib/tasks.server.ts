/**
 * إرسال فوري لتفاصيل المهمة على واتساب عند ضغط المستخدم زر الإرسال فقط.
 * لا ينشئ هذا المسار أي تذكير دوري لاحق.
 * server-only.
 */
import { taskMessage } from "@/lib/automation-runner.server";

export type NotifyResult = {
  ok: boolean;
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
};

export async function notifyTaskAssigneesNow(
  taskId: string,
  onlyUserIds?: string[],
): Promise<NotifyResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { whatsappSend } = await import("@/lib/whatsapp.functions");

  const result: NotifyResult = { ok: true, sent: 0, failed: 0, skipped: 0, errors: [] };

  const { data: task } = await supabaseAdmin
    .from("tasks")
    .select("id, title, details, priority, status, due_date, due_time")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return { ...result, ok: false, errors: ["المهمة غير موجودة"] };
  if (["approved", "done", "cancelled"].includes(task.status)) return result;

  let q = supabaseAdmin
    .from("task_assignees")
    .select("user_id, profile:user_id(full_name,phone,whatsapp,whatsapp_notify,is_active)")
    .eq("task_id", taskId);
  if (onlyUserIds?.length) q = q.in("user_id", onlyUserIds);
  const { data: rows } = await q;

  const now = new Date();
  const nowIso = now.toISOString();

  for (const row of rows ?? []) {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    const phone = profile?.whatsapp ?? profile?.phone ?? "";
    if (!profile?.is_active || !profile.whatsapp_notify || !phone) {
      result.skipped += 1;
      continue;
    }
    const body = taskMessage({
      employeeName: profile.full_name || "زميلنا",
      title: task.title,
      details: task.details,
      priority: task.priority,
      dueDate: task.due_date,
      dueTime: task.due_time,
    });
    const sendResult = await whatsappSend({ to: phone, body });
    if (sendResult.ok) result.sent += 1;
    else {
      result.failed += 1;
      result.errors.push(sendResult.error);
    }

    await supabaseAdmin.from("message_log").upsert(
      {
        task_id: taskId,
        recipient_name: profile.full_name,
        recipient_phone: phone,
        body,
        channel: "whatsapp",
        result: sendResult.ok ? "sent" : "failed",
        failure_reason: sendResult.ok ? null : sendResult.error,
        provider_message_id: sendResult.ok ? sendResult.sid : null,
        sent_by_system: true,
        idempotency_key: `task-now:${taskId}:${row.user_id}:${nowIso.slice(0, 13)}`,
      },
      { onConflict: "idempotency_key" },
    );

  }

  result.ok = result.failed === 0;
  return result;
}
