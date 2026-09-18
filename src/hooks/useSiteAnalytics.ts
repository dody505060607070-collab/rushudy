import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

const VISITOR_KEY = "rashoudi_analytics_visitor";

function getVisitorId() {
  const stored = window.localStorage.getItem(VISITOR_KEY);
  if (stored) return stored;
  const created = crypto.randomUUID();
  window.localStorage.setItem(VISITOR_KEY, created);
  return created;
}

export function useSiteAnalytics() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    if (pathname.startsWith("/api/")) return;
    const timer = window.setTimeout(async () => {
      // getSession reads the already-verified local session and avoids an extra
      // auth network request on every public page navigation.
      const { data } = await supabase.auth.getSession();
      const referrerHost = document.referrer
        ? (() => {
            try {
              return new URL(document.referrer).host;
            } catch {
              return null;
            }
          })()
        : null;
      await supabase.from("site_page_views").insert({
        visitor_id: getVisitorId(),
        path: pathname,
        referrer_host: referrerHost,
        user_id: data.session?.user.id ?? null,
      });
    }, 1_500);
    return () => window.clearTimeout(timer);
  }, [pathname]);
}