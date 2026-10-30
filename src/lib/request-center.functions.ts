import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const requestKinds = ["owner", "maintenance", "listing", "supply", "service"] as const;
export type RequestKind = typeof requestKinds[number];
const tables = { owner: "owner_requests", maintenance: "maintenance_requests", listing: "listing_requests", supply: "supply_requests", service: "service_partner_requests" } as const;
const columns = { owner: "id,title,details,status,created_at,owner_id,unit_id,property_id,contract_id,staff_note", maintenance: "id,description,reporter_name,reporter_phone,status,created_at,unit_id,property_id,contract_id", listing: "id,full_name,phone,description,status,created_at,property_id", supply: "id,full_name,phone,requester_notes,status,created_at", service: "id,request_number,customer_name,customer_phone,details,service_type,status,created_at,contract_id" } as const;
export type CenterRequest = { id: string; kind: RequestKind; title: string; details: string; name: string; phone: string; status: string; createdAt: string; unitId: string | null; propertyId: string | null; contractId: string | null; note: string };

export const getRequestCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ kind: z.enum(requestKinds).optional(), id: z.string().uuid().optional(), page: z.number().int().min(0).max(10000).default(0) }).parse(input))
  .handler(async ({ context, data }) => {
    const role = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (role.error || !role.data) throw new Error("هذه الصفحة مخصصة لفريق العمل");
    const kinds = data.kind ? [data.kind] : [...requestKinds];
    const rows: CenterRequest[] = [];
    let hasMore = false;
    for (const kind of kinds) {
      let query = context.supabase.from(tables[kind]).select(columns[kind]).order("created_at", { ascending: false });
      if (data.id) query = query.eq("id", data.id);
      else query = query.range(data.page * 40, data.page * 40 + 39);
      const result = await query;
      if (result.error) throw result.error;
      if ((result.data?.length ?? 0) === 40) hasMore = true;
      for (const item of result.data ?? []) {
        const row = item as unknown as Record<string, unknown>;
        let name = String(row["full_name"] ?? row["reporter_name"] ?? row["customer_name"] ?? "");
        let phone = String(row["phone"] ?? row["reporter_phone"] ?? row["customer_phone"] ?? "");
        if (kind === "owner" && typeof row["owner_id"] === "string") {
          const owner = await context.supabase.from("contacts").select("full_name,phone").eq("id", row["owner_id"]).maybeSingle();
          if (owner.error) throw owner.error;
          name = owner.data?.full_name ?? "المالك"; phone = owner.data?.phone ?? "";
        }
        rows.push({ id: String(row["id"]), kind, title: String(row["title"] ?? row["service_type"] ?? row["description"] ?? row["full_name"] ?? "طلب").slice(0, 160), details: String(row["details"] ?? row["description"] ?? row["requester_notes"] ?? ""), name, phone, status: String(row["status"]), createdAt: String(row["created_at"]), unitId: typeof row["unit_id"] === "string" ? row["unit_id"] : null, propertyId: typeof row["property_id"] === "string" ? row["property_id"] : null, contractId: typeof row["contract_id"] === "string" ? row["contract_id"] : null, note: String(row["staff_note"] ?? "") });
      }
    }
    return { rows: rows.sort((a,b) => b.createdAt.localeCompare(a.createdAt)), hasMore };
  });

export const updateOwnerRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["new", "in_progress", "done", "cancelled"]), note: z.string().max(4000) }).parse(input))
  .handler(async ({ context, data }) => {
    const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    if (role.error || !role.data) throw new Error("تعديل الطلب متاح للمدير فقط");
    const result = await context.supabase.from("owner_requests").update({ status: data.status, staff_note: data.note || null }).eq("id", data.id).select("id");
    if (result.error) throw result.error;
    if (!result.data?.length) throw new Error("الطلب غير موجود");
    return { ok: true };
  });