export type MeetingRole = "owner" | "visitor" | "agent";

export type MeetingInfo = {
  title: string;
  property_name: string;
  meeting_at: string;
  location_text?: string | null;
  location_url?: string | null;
  notes?: string | null;
  owner_name?: string | null;
  visitor_name?: string | null;
  agent_name?: string | null;
};

export function formatMeetingTime(iso: string) {
  return new Date(iso).toLocaleString("ar-SA", {
    timeZone: "Asia/Riyadh",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** رسالة مختلفة لكل طرف: المالك، الزائر، الوسيط. */
export function buildMeetingMessage(role: MeetingRole, m: MeetingInfo): string {
  const when = formatMeetingTime(m.meeting_at);
  const place = [m.location_text, m.location_url].filter(Boolean).join("\n");
  const lines: string[] = [];
  if (role === "owner") {
    lines.push(`مرحبًا ${m.owner_name || ""}`.trim() + "،", `تذكير بموعد معاينة عقارك «${m.property_name}»${m.visitor_name ? ` مع ${m.visitor_name}` : ""}.`);
  } else if (role === "visitor") {
    lines.push(`مرحبًا ${m.visitor_name || ""}`.trim() + "،", `لا تنسَ موعد زيارة ومعاينة «${m.property_name}».`);
  } else {
    lines.push(`مرحبًا ${m.agent_name || ""}`.trim() + "،", `لديك موعد: ${m.title} — «${m.property_name}»${m.owner_name ? ` بين المالك ${m.owner_name}` : ""}${m.visitor_name ? ` والزائر ${m.visitor_name}` : ""}.`);
  }
  lines.push(`🗓️ الموعد: ${when}`);
  if (place) lines.push(`📍 المكان: ${place}`);
  if (role === "agent" && m.notes) lines.push(`📝 ملاحظات: ${m.notes}`);
  lines.push("الرشودي للعقارات");
  return lines.join("\n");
}

/** موعد التذكير التالي، أو null إذا كان بعد وقت الموعد (تتوقف الرسائل). */
export function nextMeetingSend(from: Date, intervalHours: number, meetingAt: string): string | null {
  const next = new Date(from.getTime() + intervalHours * 3_600_000);
  return next.getTime() >= new Date(meetingAt).getTime() ? null : next.toISOString();
}
