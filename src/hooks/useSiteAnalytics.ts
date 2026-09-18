import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { MARKETING_REFERRAL_KEY, type StoredReferral } from "@/lib/marketing";

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

      const referralCode = new URLSearchParams(window.location.search).get("ref")?.trim().toLowerCase();
      if (referralCode) {
        const propertyCode = pathname.startsWith("/properties/")
          ? decodeURIComponent(pathname.slice("/properties/".length))
          : null;
        const { data: referral } = await supabase.rpc("record_marketer_referral", {
          _referral_code: referralCode,
          _visitor_id: getVisitorId(),
          _landing_path: `${pathname}${window.location.search}`,
          ...(propertyCode ? { _property_code: propertyCode } : {}),
          ...(referrerHost ? { _referrer_host: referrerHost } : {}),
        });
        const result = referral as { ok?: boolean; marketer_id?: string; code?: string; days?: number } | null;
        if (result?.ok && result.marketer_id && result.code) {
          const stored: StoredReferral = {
            code: result.code,
            marketerId: result.marketer_id,
            expiresAt: Date.now() + (result.days ?? 30) * 86_400_000,
          };
          window.localStorage.setItem(MARKETING_REFERRAL_KEY, JSON.stringify(stored));
        }
      }
    }, 1_500);
    return () => window.clearTimeout(timer);
  }, [pathname]);
}