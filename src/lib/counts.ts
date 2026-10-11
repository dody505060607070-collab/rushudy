import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

async function count(table: string, apply?: (q: any) => any) {
  let q: any = supabase.from(table as any).select("*", { count: "exact", head: true });
  if (apply) q = apply(q);
  const { count: c, error } = await q;
  if (error) throw error;
  return c ?? 0;
}

export const navCountsQuery = queryOptions({
  queryKey: ["nav-counts"],
  staleTime: 30_000,
  queryFn: async () => {
    const [
      properties,
      listingRequests,
      supplyRequests,
      reservations,
      owners,
      contracts,
      imports,
      invoices,
      followups,
      tasks,
      contacts,
      opportunities,
    ] = await Promise.all([
      count("properties"),
      count("listing_requests", (q) => q.eq("status", "new")),
      count("supply_requests", (q) => q.eq("status", "new")),
      count("reservations", (q) => q.in("status", ["hold", "active"])),
      count("contacts", (q) => q.contains("roles", ["owner"]).not("roles", "ov", "{sale_owner,rent_owner}")),
      count("contracts", (q) => q.eq("status", "active")),
      count("contract_imports", (q) => q.eq("status", "pending")),
      count("invoices", (q) => q.neq("status", "paid")),
      count("reminder_followups", (q) => q.eq("status", "pending")),
      count("tasks", (q) => q.not("status", "in", '("done","cancelled")')),
      count("contacts"),
      count("opportunities", (q) => q.not("stage", "in", '("won","lost")')),
    ]);

    return {
      properties,
      listingRequests,
      supplyRequests,
      reservations,
      owners,
      contracts,
      imports,
      invoices,
      followups,
      tasks,
      contacts,
      opportunities,
    } as Record<string, number>;
  },
});
