import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RENT_FOLLOWUP_MESSAGE, nextRentFollowup } from "./rent-followup";
import { followupDatabase } from "./followup-database";

export type RentConfig = { rent_enabled: boolean; rent_template: string | null; rent_next_at: string | null };
export const getRentFollowup = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const config = await followupDatabase(context.supabase).from("owner_followup_config").select("rent_enabled,rent_template,rent_next_at").eq("id", true).single();
  if (config.error) throw config.error;
  const logs = await context.supabase.from("message_log").select("id,contact_id,recipient_name,result,failure_reason,created_at").eq("kind", "owner_monthly_rent").order("created_at", { ascending: false }).limit(1000);
  if (logs.error) throw logs.error;
  const cfg = config.data as unknown as RentConfig;
  return { enabled: cfg.rent_enabled, template: cfg.rent_template || RENT_FOLLOWUP_MESSAGE, nextAt: cfg.rent_next_at, logs: logs.data ?? [] };
});
export const saveRentFollowup = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ enabled: z.boolean().optional(), template: z.string().trim().min(1).max(4000).optional() }).parse(input))
  .handler(async ({ context, data }) => {
    const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (role.error || !role.data) throw new Error("إعداد المتابعة متاح للمدير فقط");
    const patch = { id: true, updated_by: context.userId, updated_at: new Date().toISOString(), ...(data.enabled !== undefined ? { rent_enabled: data.enabled, rent_next_at: data.enabled ? nextRentFollowup(new Date()) : null } : {}), ...(data.template ? { rent_template: data.template } : {}) };
    const saved = await followupDatabase(context.supabase).from("owner_followup_config").upsert(patch);
    if (saved.error) throw saved.error;
    return { ok: true };
  });