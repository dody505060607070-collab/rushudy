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