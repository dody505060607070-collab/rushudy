import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** حفظ بيانات ربط الشات المشترك للموظف الحالي (مرة واحدة). */
export const saveMithraaLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().email(), password: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptSecret } = await import("@/lib/mithraa-link.server");
    const { error } = await supabaseAdmin.from("mithraa_links").upsert(
      {
        user_id: context.userId,
        email: data.email,
        secret: encryptSecret(data.password),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** استرجاع بيانات الربط المحفوظة للموظف الحالي لتسجيل دخول الشات تلقائيًا. */
export const getMithraaLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptSecret } = await import("@/lib/mithraa-link.server");
    const { data } = await supabaseAdmin
      .from("mithraa_links")
      .select("email, secret")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data) return { linked: false as const };
    try {
      return { linked: true as const, email: data.email, password: decryptSecret(data.secret) };
    } catch {
      return { linked: false as const };
    }
  });

/** إلغاء الربط المحفوظ للموظف الحالي. */
export const clearMithraaLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("mithraa_links").delete().eq("user_id", context.userId);
    return { ok: true };
  });
