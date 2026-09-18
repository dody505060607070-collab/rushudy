import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendPropertyToMarketer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ marketerId: z.string().uuid(), propertyId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("has_perm", {
      _user_id: context.userId,
      _module: "marketing",
      _action: "send",
    });
    if (!allowed) throw new Error("ليس لديك صلاحية الإرسال للمسوقين");

    const [marketerResult, propertyResult] = await Promise.all([
      context.supabase.from("marketers").select("id, full_name, phone, referral_code, status").eq("id", data.marketerId).single(),
      context.supabase.from("properties").select("id, code, name, purpose, price_text, city, district, is_visible").eq("id", data.propertyId).single(),
    ]);
    if (marketerResult.error || !marketerResult.data) throw new Error("المسوق غير موجود");
    if (propertyResult.error || !propertyResult.data) throw new Error("العقار غير موجود");
    if (marketerResult.data.status !== "active") throw new Error("المسوق غير نشط");
    if (!propertyResult.data.is_visible) throw new Error("انشر العقار أولًا قبل إرساله للمسوق");

    const url = `https://alrashudi.sa/properties/${encodeURIComponent(propertyResult.data.code ?? propertyResult.data.id)}?ref=${encodeURIComponent(marketerResult.data.referral_code)}`;
    const body = [
      `مرحبًا ${marketerResult.data.full_name}،`,
      `عقار جديد متاح للتسويق: ${propertyResult.data.name}`,
      propertyResult.data.price_text ? `السعر: ${propertyResult.data.price_text}` : null,
      [propertyResult.data.district, propertyResult.data.city].filter(Boolean).join("، "),
      `رابطك الخاص: ${url}`,
      "أي طلب يصل من هذا الرابط سيُنسب لك داخل نظام الرشودي.",
    ].filter(Boolean).join("\n");

    const { whatsappSend } = await import("@/lib/whatsapp.functions");
    const result = await whatsappSend({ to: marketerResult.data.phone, body });
    if (!result.ok) throw new Error(result.error);

    const { error: logError } = await context.supabase.from("marketer_property_shares").insert({
      marketer_id: data.marketerId,
      property_id: data.propertyId,
      channel: "whatsapp",
      sent_to: marketerResult.data.phone,
      sent_by: context.userId,
    });
    if (logError) throw new Error(logError.message);
    return { ok: true, url };
  });