import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const moveSchema = z.object({
  ownerId: z.string().uuid(),
  buildingId: z.string().uuid().nullable(),
  itemId: z.string().uuid(),
  itemType: z.enum(["unit", "property"]),
});

export const moveOwnerAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => moveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const allowed = await context.supabase.rpc("has_perm", {
      _user_id: context.userId,
      _module: "owners",
      _action: "edit",
    });
    if (!allowed.data) throw new Error("غير مصرّح بنقل وحدات المالك.");
    if (data.buildingId) {
      const target = await context.supabase
        .from("buildings")
        .select("id")
        .eq("id", data.buildingId)
        .eq("owner_id", data.ownerId)
        .maybeSingle();
      if (!target.data) throw new Error("المبنى لا يتبع هذا المالك.");
    }
    const table = data.itemType === "unit" ? "units" : "properties";
    const result = await context.supabase
      .from(table)
      .update({ building_id: data.buildingId })
      .eq("id", data.itemId)
      .eq("owner_id", data.ownerId);
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });

export const assignOwnerContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ownerId: z.string().uuid(), contractId: z.string().uuid(), unitId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const allowed = await context.supabase.rpc("has_perm", { _user_id: context.userId, _module: "contracts", _action: "edit" });
    if (!allowed.data) throw new Error("غير مصرّح بنقل العقود.");
    const [contract, unit, conflict] = await Promise.all([
      context.supabase.from("contracts").select("id").eq("id", data.contractId).eq("owner_id", data.ownerId).eq("status", "active").maybeSingle(),
      context.supabase.from("units").select("id, building_id").eq("id", data.unitId).eq("owner_id", data.ownerId).maybeSingle(),
      context.supabase.from("contracts").select("id").eq("unit_id", data.unitId).eq("status", "active").neq("id", data.contractId).maybeSingle(),
    ]);
    if (!contract.data) throw new Error("العقد النشط لا يتبع هذا المالك.");
    if (!unit.data) throw new Error("الوحدة لا تتبع هذا المالك.");
    if (conflict.data) throw new Error("هذه الوحدة مرتبطة بعقد نشط آخر.");
    const updated = await context.supabase.from("contracts").update({ unit_id: data.unitId, building_id: unit.data.building_id, property_id: null }).eq("id", data.contractId).eq("owner_id", data.ownerId);
    if (updated.error) throw new Error(updated.error.message);
    return { ok: true };
  });