import { buildMeetingMessage, nextMeetingSend, type MeetingRole } from "./meeting-reminders";

type Row = Record<string, any>;

/** يرسل رسالة لكل طرف في الموعد ويسجلها. */
export async function sendMeetingNow(row: Row, now = new Date()) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { whatsappSend } = await import("./whatsapp.functions");
  const targets: [MeetingRole, string | null, string | null][] = [
    ["owner", row.owner_name, row.owner_phone],
    ["visitor", row.visitor_name, row.visitor_phone],
    ["agent", row.agent_name, row.agent_phone],
  ];
  const results: { role: MeetingRole; ok: boolean; error?: string }[] = [];
  for (const [role, name, phone] of targets) {
    if (!phone?.trim()) continue;
    const body = buildMeetingMessage(role, row as never);
    const r = await whatsappSend({ to: phone, body });
    results.push({ role, ok: r.ok, error: r.ok ? undefined : r.error });
    await supabaseAdmin.from("message_log").insert({
      kind: "meeting_reminder", recipient_name: name ?? "", recipient_phone: phone, body,
      channel: "whatsapp", result: r.ok ? "sent" : "failed", failure_reason: r.ok ? null : r.error,
      sent_by_system: true,
    } as never);
  }
  const next = row.auto_enabled ? nextMeetingSend(now, row.interval_hours, row.meeting_at) : null;
  await supabaseAdmin.from("meeting_reminders").update({
    last_sent_at: now.toISOString(), sent_count: (row.sent_count ?? 0) + 1, next_send_at: next, updated_at: now.toISOString(),
  }).eq("id", row.id);
  return results;
}

/** يُستدعى من التشغيل الدوري كل ساعة. */
export async function runMeetingReminders(now = new Date()) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const due = await supabaseAdmin.from("meeting_reminders").select("*")
    .eq("status", "active").eq("auto_enabled", true).not("next_send_at", "is", null)
    .lte("next_send_at", now.toISOString()).limit(20);
  if (due.error) throw due.error;
  let sent = 0;
  for (const row of due.data ?? []) {
    if (new Date(row.meeting_at) <= now) {
      await supabaseAdmin.from("meeting_reminders").update({ next_send_at: null }).eq("id", row.id);
      continue;
    }
    // احجز الصف أولاً حتى لا يُرسل مرتين
    const claim = await supabaseAdmin.from("meeting_reminders").update({ next_send_at: null })
      .eq("id", row.id).eq("next_send_at", row.next_send_at).select("id");
    if (claim.error || !claim.data?.length) continue;
    await sendMeetingNow(row, now);
    sent++;
  }
  return { sent };
}
