import { RENT_FOLLOWUP_MESSAGE, nextRentFollowup } from "./rent-followup";
import type { RentConfig } from "./rent-followup.functions";

export async function runRentFollowup(now = new Date()) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cfg = await supabaseAdmin.from("owner_followup_config").select("rent_enabled,rent_template,rent_next_at").eq("id", true).single();
  if (cfg.error) throw cfg.error;
  const config = cfg.data as unknown as RentConfig;
  if (!config.rent_enabled || !config.rent_next_at || new Date(config.rent_next_at) > now) return { ran: false };
  const lease = await supabaseAdmin.rpc("acquire_automation_lease", { _job_name: "rent_owner_monthly_enqueue", _lease_seconds: 300 });
  if (lease.error) throw lease.error;
  if (!lease.data) return { ran: false };
  try {
    const owners = await supabaseAdmin.from("contacts").select("id,full_name,phone,whatsapp").contains("roles", ["rent_owner"]).eq("is_active", true);
    if (owners.error) throw owners.error;
    const body = config.rent_template || RENT_FOLLOWUP_MESSAGE;
    const seen = new Set<string>(); const rows = [];
    const runId = crypto.randomUUID();
    for (const owner of owners.data ?? []) {
      const phone = (owner.whatsapp || owner.phone || "").replace(/\D/g, "").replace(/^0/, "966");
      if (!phone) {
        const log = await supabaseAdmin.from("message_log").insert({ kind: "owner_monthly_rent", contact_id: owner.id, recipient_name: owner.full_name, recipient_phone: "", body, channel: "whatsapp", result: "failed", failure_reason: "لا يوجد رقم جوال", sent_by_system: true });
        if (log.error) throw log.error;
        continue;
      }
      if (seen.has(phone)) continue;
      seen.add(phone);
      rows.push({ run_id: runId, contact_id: owner.id, recipient_name: owner.full_name, recipient_phone: phone, body, followup_kind: "owner_monthly_rent" });
    }
    if (rows.length) {
      const queued = await supabaseAdmin.from("owner_followup_queue").insert(rows);
      if (queued.error) throw queued.error;
    }
    const patch = { updated_at: now.toISOString(), rent_next_at: nextRentFollowup(now) };
    const saved = await supabaseAdmin.from("owner_followup_config").update(patch).eq("id", true);
    if (saved.error) throw saved.error;
    const { sendOwnerFollowupBatch } = await import("./owner-biweekly.server");
    return { ran: true, queued: rows.length, ...await sendOwnerFollowupBatch() };
  } finally {
    const finish = await supabaseAdmin.rpc("finish_automation_lease", { _job_name: "rent_owner_monthly_enqueue", _error: null });
    if (finish.error) throw finish.error;
  }
}