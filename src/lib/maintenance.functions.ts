import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { MAINTENANCE_CATEGORIES, MAINTENANCE_PRIORITIES } from "./maintenance-notify";

const input = z.object({
  reporter_name: z.string().trim().min(2).max(120),
  reporter_phone: z.string().trim().min(8).max(20),
  category: z.string().max(30),
  priority: z.string().max(20),
  description: z.string().trim().min(3).max(2000),
});

/** بلاغ صيانة من صفحة الموقع العامة: يُحفظ في النظام ويصل واتساب للمكتب وموظف الصيانة. */
export const submitPublicMaintenance = createServerFn({ method: "POST" })
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const key = data.reporter_phone.replace(/\D/g, "").slice(-9);
    if (key.length < 8) return { ok: false as const, error: "رقم الجوال غير صحيح." };

    // حد بسيط ضد التكرار: 3 بلاغات لنفس الرقم في الساعة
    const recent = await db
      .from("maintenance_requests")
      .select("id", { count: "exact", head: true })
      .ilike("reporter_phone", `%${key}`)
      .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
    if ((recent.count ?? 0) >= 3) {
      return { ok: false as const, error: "استلمنا بلاغاتك، سيتواصل معك الفريق قريبًا." };
    }

    // لو الرقم لمستأجر عنده عقد، نربط البلاغ بعقده ووحدته تلقائيًا
    let contractId: string | null = null;
    let unitId: string | null = null;
    let propertyId: string | null = null;
    const contacts = await db
      .from("contacts")
      .select("id, phone, whatsapp, phone_alt")
      .or(`phone.ilike.%${key},whatsapp.ilike.%${key},phone_alt.ilike.%${key}`)
      .limit(5);
    const ids = (contacts.data ?? []).map((c) => c.id);
    if (ids.length) {
      const contract = await db
        .from("contracts")
        .select("id, unit_id, property_id")
        .in("tenant_id", ids)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (contract.data) {
        contractId = contract.data.id;
        unitId = contract.data.unit_id;
        propertyId = contract.data.property_id;
      }
    }

    const ins = await db
      .from("maintenance_requests")
      .insert({
        reporter_name: data.reporter_name,
        reporter_phone: data.reporter_phone,
        category: MAINTENANCE_CATEGORIES[data.category] ? data.category : "other",
        priority: MAINTENANCE_PRIORITIES[data.priority] ? data.priority : "normal",
        description: data.description,
        status: "new",
        cost: 0,
        contract_id: contractId,
        unit_id: unitId,
        property_id: propertyId,
      })
      .select("id")
      .single();
    if (ins.error) return { ok: false as const, error: "تعذّر إرسال البلاغ، حاول مرة أخرى." };

    const staffRoles = await db.from("user_roles").select("user_id").in("role", ["super_admin", "employee"]);
    const targets = [...new Set((staffRoles.data ?? []).map((r) => r.user_id))];
    if (targets.length) {
      await db.from("notifications").insert(
        targets.map((user_id) => ({
          user_id,
          title: "بلاغ صيانة جديد",
          body: `${data.reporter_name}: ${data.description.slice(0, 120)}`,
          link: `/requests/maintenance/${ins.data.id}`,
        })),
      );
    }
    const { notifyMaintenanceStaff } = await import("./maintenance-notify.server");
    await notifyMaintenanceStaff(ins.data.id).catch(() => undefined);
    return { ok: true as const };
  });
