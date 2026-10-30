import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type ConfigFields = { rent_enabled: boolean; rent_template: string | null; rent_next_at: string | null };
type QueueFields = { followup_kind: string; claimed_at: string | null };
type ConfigTable = Database["public"]["Tables"]["owner_followup_config"];
type QueueTable = Database["public"]["Tables"]["owner_followup_queue"];
type FollowupDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Omit<Database["public"]["Tables"], "owner_followup_config" | "owner_followup_queue"> & {
      owner_followup_config: Omit<ConfigTable, "Row" | "Insert" | "Update"> & { Row: ConfigTable["Row"] & ConfigFields; Insert: ConfigTable["Insert"] & Partial<ConfigFields>; Update: ConfigTable["Update"] & Partial<ConfigFields> };
      owner_followup_queue: Omit<QueueTable, "Row" | "Insert" | "Update"> & { Row: QueueTable["Row"] & QueueFields; Insert: QueueTable["Insert"] & Partial<QueueFields>; Update: QueueTable["Update"] & Partial<QueueFields> };
    };
  };
};
// Additive draft schema: remove this extension after generated types include the accepted migration.
export function followupDatabase(client: SupabaseClient<Database>) {
  return client as unknown as SupabaseClient<FollowupDatabase>;
}