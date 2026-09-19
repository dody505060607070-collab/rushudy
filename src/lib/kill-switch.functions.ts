import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type AuthedSupabase = SupabaseClient<Database>;

/** لوحة الإيقاف الكلي متاحة لمدير النظام فقط. */
async function assertSuperAdmin(supabase: AuthedSupabase, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("غير مصرّح");
}

/** تحديد محاولات إدخال الكود لكل مستخدم. */
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;

function tooManyAttempts(userId: string) {
  const now = Date.now();
  const entry = attempts.get(userId);
  if (!entry || now - entry.first > WINDOW_MS) {
    attempts.set(userId, { count: 0, first: now });
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(userId: string) {
  const entry = attempts.get(userId) ?? { count: 0, first: Date.now() };
  entry.count += 1;
  attempts.set(userId, entry);
}

async function audit(event: string, payload: Record<string, unknown>, status: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("automation_events").insert({
      event,
      direction: "in",
      payload: payload as never,
      status,
    });
  } catch {
    // لا نُفشل العملية بسبب فشل السجل
  }
}

/** يتحقق من صلاحية فتح لوحة التحكم ويعيد الحالة الحالية. */
export const killSwitchAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("site_kill_switch")
      .select("locked,message,updated_at")
      .eq("id", 1)
      .maybeSingle();
    return {
      locked: Boolean(data?.locked),
      message: data?.message ?? "",
      updatedAt: data?.updated_at ?? null,
    };
  });

export const setKillSwitch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string; locked: boolean; message?: string }) => data)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);

    if (tooManyAttempts(context.userId)) {
      await audit("kill_switch.locked_out", { user_id: context.userId }, "failed");
      return { ok: false as const, error: "تم إيقاف المحاولات مؤقتًا. حاول بعد 10 دقائق." };
    }

    const { killSwitchCodeMatches } = await import("./kill-switch.server");
    const expected = process.env["KILL_SWITCH_SECRET"];
    if (!expected) {
      return { ok: false as const, error: "الإعداد غير مكتمل على الخادم" };
    }
    if (!killSwitchCodeMatches(data.code, expected)) {
      recordFailure(context.userId);
      await audit("kill_switch.bad_code", { user_id: context.userId }, "failed");
      await new Promise((r) => setTimeout(r, 800));
      return { ok: false as const, error: "الكود غير صحيح" };
    }
    attempts.delete(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const trimmed = typeof data.message === "string" ? data.message.trim().slice(0, 300) : "";
    const patch =
      trimmed.length > 0
        ? { locked: data.locked, updated_at: new Date().toISOString(), message: trimmed }
        : { locked: data.locked, updated_at: new Date().toISOString() };
    const { error } = await supabaseAdmin
      .from("site_kill_switch")
      .update(patch)
      .eq("id", 1);
    if (error) return { ok: false as const, error: error.message };
    await audit("kill_switch.changed", { user_id: context.userId, locked: data.locked }, "sent");
    return { ok: true as const, locked: data.locked };
  });
