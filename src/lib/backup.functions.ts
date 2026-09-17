import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TABLES = ["activity_log", "activity_messages", "app_settings", "buildings", "cities", "client_accounts", "contacts", "contract_payments", "contract_signatures", "contracts", "crm_activities", "districts", "employee_activities", "invoice_items", "invoice_payments", "invoices", "listing_requests", "message_log", "message_templates", "notifications", "opportunities", "opportunity_properties", "opportunity_stage_history", "owner_delegates", "owner_requests", "partners", "payment_transactions", "profiles", "properties", "property_guarantees", "property_images", "property_types", "property_videos", "reminder_followups", "request_status_history", "reservations", "sale_guarantees", "services", "supply_requests", "task_assignees", "task_attachments", "task_history", "tasks", "unit_documents", "unit_expenses", "units", "user_permissions", "user_roles"] as const;

export const createSystemBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "super_admin").maybeSingle();
    if (!role.data) throw new Error("النسخ الاحتياطي متاح للمدير العام فقط");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const run = await supabaseAdmin.from("backup_runs").insert({ requested_by: context.userId, status: "processing" }).select("id").single();
    if (run.error) throw new Error(run.error.message);
    try {
      const entries = await Promise.all(TABLES.map(async (table) => {
        const result = await supabaseAdmin.from(table).select("*");
        if (result.error) throw result.error;
        return [table, result.data ?? []] as const;
      }));
      const payload = JSON.stringify({ version: 1, created_at: new Date().toISOString(), tables: Object.fromEntries(entries) });
      await supabaseAdmin.from("backup_runs").update({ status: "completed", size_bytes: new TextEncoder().encode(payload).byteLength, tables_count: TABLES.length, completed_at: new Date().toISOString() }).eq("id", run.data.id);
      return { fileName: `rashoudi-backup-${new Date().toISOString().slice(0, 10)}.json`, payload };
    } catch (error) {
      await supabaseAdmin.from("backup_runs").update({ status: "failed", error_message: error instanceof Error ? error.message : "خطأ غير معروف", completed_at: new Date().toISOString() }).eq("id", run.data.id);
      throw error;
    }
  });