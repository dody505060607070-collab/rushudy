import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** اعتماد طلب عرض عقار: إنشاء العقار في النظام + إشعار المالك عبر واتساب. */
export const approveListingRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        notifyWhatsapp: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const { data: req, error } = await supabase
      .from("listing_requests")
      .select("*")
      .eq("id", data.requestId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!req) throw new Error("الطلب غير موجود");

    let propertyId = req.property_id as string | null;

    if (!propertyId) {
      const code = `LR-${Date.now().toString(36).toUpperCase()}`;
      const { data: created, error: createError } = await supabase
        .from("properties")
        .insert({
          code,
          name: `${req.property_type ?? "عقار"} - ${req.district ?? req.city ?? "بريدة"}`,
          purpose: req.purpose === "sale" ? "sale" : "rent",
          property_type: req.property_type,
          city: req.city,
          district: req.district,
          description: req.description,
          map_url: req.map_url,
          price_text: req.asking_price,
          rent_period: req.rent_period,
          owner_name: req.full_name,
          owner_phone: req.phone,
          owner_id: req.contact_id,
          is_visible: true,
          needs_review: false,
          status: "available",
        })
        .select("id")
        .single();
      if (createError) throw new Error(createError.message);
      propertyId = created.id;
    } else {
      await supabase
        .from("properties")
        .update({ is_visible: true, needs_review: false })
        .eq("id", propertyId);
    }

    const { error: updateError } = await supabase
      .from("listing_requests")
      .update({ status: "approved", property_id: propertyId, updated_at: new Date().toISOString() })
      .eq("id", data.requestId);
    if (updateError) throw new Error(updateError.message);

    let whatsapp: { ok: boolean; error?: string } = { ok: false, error: "لم يُرسل" };
    if (data.notifyWhatsapp && req.phone) {
      try {
        const { whatsappSend } = await import("@/lib/whatsapp.functions");
        const result = await whatsappSend({
          to: req.phone,
          body: `مرحباً ${req.full_name}، تم اعتماد عقارك لدى الرشودي للعقارات وأصبح معروضاً الآن. شكراً لثقتك.`,
        });
        whatsapp = result.ok ? { ok: true } : { ok: false, error: result.error };
      } catch (err) {
        whatsapp = { ok: false, error: err instanceof Error ? err.message : "تعذّر الإرسال" };
      }
    }

    return { propertyId, whatsapp };
  });
