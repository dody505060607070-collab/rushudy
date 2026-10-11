import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Next Friday 16:00 Riyadh (UTC+3) at or after `from`, returned as ISO. */
export function nextFriday4pm(from: Date) {
  const r = new Date(from.getTime() + 3 * 3600_000);
  const d = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth(), r.getUTCDate(), 16));
  const add = (5 - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + add);
  if (d.getTime() < r.getTime()) d.setUTCDate(d.getUTCDate() + 7);
  return new Date(d.getTime() - 3 * 3600_000).toISOString();
}

/** Status for the sale-owners page: config, next scheduled run, last result per owner. */
export const getOwnerFollowupStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const { OWNER_BIWEEKLY_MESSAGE_SALE, OWNER_FOLLOWUP_JOB } = await import("@/lib/owner-biweekly.server");
    const [{ data: cfg }, { data: logs }] = await Promise.all([
      db.from("owner_followup_config").select("enabled, template, updated_at").eq("id", true).maybeSingle(),
      db
        .from("message_log")
        .select("contact_id, result, failure_reason, created_at, sent_by_system")
        .eq("kind", "owner_biweekly")
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: job } = await supabaseAdmin
      .from("automation_job_state")
      .select("last_started_at, lease_until, status")
      .eq("job_name", OWNER_FOLLOWUP_JOB)
      .maybeSingle();
    const now = new Date();
    const lease = job?.lease_until ? new Date(job.lease_until) : null;
    const nextRun = nextFriday4pm(lease && lease > now ? lease : now);
    const last: Record<string, { result: string; reason: string | null; at: string; auto: boolean }> = {};
    for (const l of logs ?? []) {
      if (l.contact_id && !last[l.contact_id])
        last[l.contact_id] = { result: l.result ?? "", reason: l.failure_reason, at: l.created_at, auto: !!l.sent_by_system };
    }
    return {
      enabled: cfg?.enabled ?? true,
      template: (cfg?.template || "").trim() || OWNER_BIWEEKLY_MESSAGE_SALE,
      defaultTemplate: OWNER_BIWEEKLY_MESSAGE_SALE,
      lastRunAt: job?.last_started_at ?? null,
      nextRun,
      last,
    };
  });

export const saveOwnerFollowupConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ enabled: z.boolean().optional(), template: z.string().max(4000).nullable().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const patch: { id: boolean; updated_at: string; updated_by: string; enabled?: boolean; template?: string | null } = {
      id: true,
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    };
    if (data.enabled !== undefined) patch.enabled = data.enabled;
    if (data.template !== undefined) patch.template = data.template?.trim() || null;
    const { error } = await context.supabase.from("owner_followup_config").upsert(patch);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Explicit user action: send the follow-up now to all sale owners or one owner. */
export const sendOwnerFollowupNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ contactId: z.string().uuid().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("has_perm", {
      _user_id: context.userId,
      _module: "owners",
      _action: "edit",
    });
    if (!allowed) throw new Error("ليست لديك صلاحية إرسال رسائل الملاك");
    const { requireUnlocked } = await import("@/lib/kill-switch.server");
    await requireUnlocked();
    const { sendOwnerFollowup } = await import("@/lib/owner-biweekly.server");
    return sendOwnerFollowup({ contactId: data.contactId, sentBy: context.userId });
  });
