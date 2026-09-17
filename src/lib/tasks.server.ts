/**
 * إرسال تفاصيل المهمة على واتساب.
 * الإرسال يحدث فقط عند تكليف موظف جديد بالمهمة أو ضغط زر الإرسال،
 * ثم تتكرر الرسالة حسب أولوية المهمة إلى أن تُغلق المهمة.
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

/** فترة تكرار رسالة المهمة حسب الأولوية. */
export function taskIntervalHours(priority: string | null | undefined): number {
  if (priority === "urgent") return 12;
  if (priority === "high") return 24;
  return 72;
}

export const CLOSED_TASK_STATUSES = ["approved", "done", "cancelled", "rejected"];

export async function notifyTaskAssigneesNow(
  taskId: string,
  onlyUserIds?: string[],
  options?: { schedule?: boolean },
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
  if (CLOSED_TASK_STATUSES.includes(task.status)) return result;

  let q = supabaseAdmin
    .from("task_assignees")
    .select("user_id, profile:user_id(full_name,phone,whatsapp,whatsapp_notify,is_active)")
    .eq("task_id", taskId);
  if (onlyUserIds?.length) q = q.in("user_id", onlyUserIds);
  const { data: rows } = await q;

  const now = new Date();
  const nowIso = now.toISOString();
  const stepHours = taskIntervalHours(task.priority);
  const nextIso = new Date(now.getTime() + stepHours * 3600_000).toISOString();

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

    if (options?.schedule) {
      const { data: state } = await supabaseAdmin
        .from("task_reminder_state")
        .select("id, sent_count")
        .eq("task_id", taskId)
        .eq("user_id", row.user_id)
        .maybeSingle();
      const patch = {
        task_id: taskId,
        user_id: row.user_id,
        last_sent_at: sendResult.ok ? nowIso : null,
        last_error: sendResult.ok ? null : sendResult.error,
        next_send_at: sendResult.ok ? nextIso : new Date(now.getTime() + 6 * 3600_000).toISOString(),
        sent_count: (state?.sent_count ?? 0) + (sendResult.ok ? 1 : 0),
      };
      if (state?.id) await supabaseAdmin.from("task_reminder_state").update(patch).eq("id", state.id);
      else await supabaseAdmin.from("task_reminder_state").insert(patch);
    }
  }

  result.ok = result.failed === 0;
  return result;
}

/** يوقف كل رسائل واتساب المتكررة الخاصة بمهمة. */
export async function stopTaskReminders(taskId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("task_reminder_state").delete().eq("task_id", taskId);
  return { ok: true };
}
