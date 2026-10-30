import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { taskTransition, type TaskDecision } from "./task-workflow";

export async function reviewTask(db: SupabaseClient<Database>, userId: string, taskId: string, decision: TaskDecision, note?: string) {
  const [role, task, membership] = await Promise.all([
    db.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
    db.from("tasks").select("id,title,status").eq("id", taskId).single(),
    db.from("task_assignees").select("user_id").eq("task_id", taskId).eq("user_id", userId),
  ]);
  for (const result of [role, task, membership]) if (result.error) throw result.error;
  if (!task.data) throw new Error("المهمة غير موجودة");
  const status = taskTransition(task.data.status, decision, Boolean(role.data), Boolean(membership.data?.length));
  const now = new Date().toISOString();
  const patch = decision === "submit"
    ? { status, submitted_at: now, approved_at: null, approved_by: null, rejection_note: null }
    : decision === "approve"
      ? { status, approved_at: now, approved_by: userId }
      : { status, approved_at: null, approved_by: null, rejection_note: note?.trim() || null };
  const updated = await db.from("tasks").update(patch).eq("id", taskId).eq("status", task.data.status).select("id");
  if (updated.error) throw updated.error;
  if (!updated.data?.length) throw new Error("تغيّرت حالة المهمة؛ حدّث الصفحة");
  const { stopTaskReminders } = await import("./tasks.server");
  await stopTaskReminders(taskId);
  if (decision === "approve") return { ok: true, status, warning: null };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const targets = decision === "submit"
    ? await supabaseAdmin.from("user_roles").select("user_id").eq("role", "super_admin").eq("user_id", "1e44dd3e-f6e2-4372-ab2c-be7ba88d7b8d")
    : await supabaseAdmin.from("task_assignees").select("user_id").eq("task_id", taskId);
  if (targets.error) throw targets.error;
  const ids = [...new Set((targets.data ?? []).map(r => r.user_id))];
  const profiles = ids.length ? await supabaseAdmin.from("profiles").select("id,full_name,phone,whatsapp,is_active").in("id", ids) : { data: [], error: null };
  if (profiles.error) throw profiles.error;
  const actor = await db.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  if (actor.error) throw actor.error;
  const title = decision === "submit" ? "مهمة بانتظار الموافقة" : "مهمة أُعيدت للمراجعة";
  const body = decision === "submit"
    ? `${actor.data?.full_name ?? "الموظف"} أنهى المهمة «${task.data.title}»؛ بانتظار مراجعتك واعتمادك.`
    : `أُعيدت إليك المهمة «${task.data.title}». يرجى مراجعتها وإكمال المطلوب.${note ? `\nملاحظات المدير: ${note}` : ""}`;
  const link = `/task-form?id=${taskId}`;
  if (ids.length) {
    const notification = await supabaseAdmin.from("notifications").insert(ids.map(user_id => ({ user_id, title, body, link })));
    if (notification.error) throw notification.error;
  }
  const { whatsappSend } = await import("./whatsapp.functions");
  const warnings: string[] = [];
  if (!ids.length) warnings.push("تعذّر العثور على حساب المدير المحدد");
  for (const profile of profiles.data ?? []) {
    const phone = profile.whatsapp || profile.phone;
    if (!phone || !profile.is_active) { warnings.push(`لا يوجد رقم مفعّل لـ ${profile.full_name}`); continue; }
    const sent = await whatsappSend({ to: phone, body: `${body}\nhttps://alrashudi.sa${link}` });
    const log = await supabaseAdmin.from("message_log").insert({ task_id: taskId, recipient_name: profile.full_name, recipient_phone: phone, body, kind: `task_${decision}`, channel: "whatsapp", result: sent.ok ? "accepted" : "failed", provider_message_id: sent.ok ? sent.sid : null, failure_reason: sent.ok ? null : sent.error, sent_by: userId, sent_by_system: false });
    if (log.error) throw log.error;
    if (!sent.ok) warnings.push(sent.error);
  }
  return { ok: true, status, warning: warnings.join("؛ ") || null };
}