import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import { useChatAlerts } from "@/hooks/useChatAlerts";
import { useActivityPresence } from "@/hooks/useActivityPresence";
import { supabase } from "@/integrations/supabase/client";

function AuthedLayout() {
  useChatAlerts();
  useActivityPresence();
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});
