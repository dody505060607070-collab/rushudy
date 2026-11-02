/** إشعار واتساب لأرقام المكتب وموظفي الصيانة عند وصول بلاغ صيانة جديد (بفعل صريح من المستأجر/المالك). */
import { buildMaintenanceMessage, type MaintenanceNotice } from "./maintenance-notify";

export async function notifyMaintenanceStaff(requestId: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { whatsappSend } = await import("./whatsapp.functions");

  const req = await db
    .from("maintenance_requests")
    .select(
      "id, reporter_name, reporter_phone, category, priority, description, created_at, unit_id, contract_id, property:property_id(name), unit:unit_id(unit_number, building:building_id(name))",
    )
    .eq("id", requestId)
    .maybeSingle();
  if (!req.data) return { sent: 0, failed: 0 };
  const row = req.data as unknown as {
    id: string;
    reporter_name: string | null;
    reporter_phone: string | null;
    category: string | null;
    priority: string | null;
    description: string | null;
    unit_id: string | null;
    contract_id: string | null;
    property: { name: string | null } | null;
    unit: { unit_number: string | null; building: { name: string | null } | null } | null;
  };

  const notice: MaintenanceNotice = {
    reporterName: row.reporter_name,
    reporterPhone: row.reporter_phone,
    category: row.category,
    priority: row.priority,
    description: row.description,
    place: row.property?.name ?? row.unit?.building?.name ?? null,
    unitNumber: row.unit?.unit_number ?? null,
  };
  const body = buildMaintenanceMessage(notice);

  const recipients = await db
    .from("maintenance_notify_recipients")
    .select("label, phone")
    .eq("is_active", true);

  let sent = 0;
  let failed = 0;
  const seen = new Set<string>();
  for (const r of recipients.data ?? []) {
    const key = String(r.phone ?? "").replace(/\D/g, "").slice(-9);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    let ok = false;
    let reason: string | null = null;
    let sid: string | null = null;
    try {
      const res = await whatsappSend({ to: r.phone, body });
      ok = res.ok;
      if (res.ok) sid = res.sid;
      else reason = res.error;
    } catch (e) {
      reason = e instanceof Error ? e.message : "تعذّر الإرسال";
    }
    if (ok) sent += 1;
    else failed += 1;
    await db.from("message_log").insert({
      kind: "maintenance_alert",
      contract_id: row.contract_id,
      unit_id: row.unit_id,
      recipient_name: r.label,
      recipient_phone: r.phone,
      body,
      channel: "whatsapp",
      result: ok ? "sent" : "failed",
      failure_reason: reason,
      provider_message_id: sid,
      sent_by_system: true,
      idempotency_key: `maintenance:${row.id}:${key}`,
    });
  }
  return { sent, failed };
}
