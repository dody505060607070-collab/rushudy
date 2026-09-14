import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";

import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const KEY = "rashoudi_employee_session";

export function useActivityPresence() {
  const { userId, roles } = useCurrentUser();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const sessionId = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !roles.some((role) => role === "employee" || role === "super_admin")) return;
    let active = true;
    const device = `${navigator.platform || "جهاز"} · ${/Mobi/i.test(navigator.userAgent) ? "جوال" : "كمبيوتر"}`;

    const start = async () => {
      const stored = window.sessionStorage.getItem(KEY);
      if (stored) {
        sessionId.current = stored;
        await supabase.rpc("touch_employee_session", { _session_id: stored, _path: pathname, _device: device });
        return;
      }
      const { data } = await supabase
        .from("employee_sessions")
        .insert({ user_id: userId, current_path: pathname, device_label: device })
        .select("id")
        .single();
      if (active && data?.id) {
        sessionId.current = data.id;
        window.sessionStorage.setItem(KEY, data.id);
      }
    };
    void start();

    const heartbeat = window.setInterval(() => {
      if (!sessionId.current || document.visibilityState === "hidden") return;
      void supabase.rpc("touch_employee_session", {
        _session_id: sessionId.current,
        _path: window.location.pathname,
        _device: device,
      });
    }, 60_000);
    return () => {
      active = false;
      window.clearInterval(heartbeat);
    };
  }, [userId, roles]);

  useEffect(() => {
    if (!sessionId.current) return;
    void supabase.rpc("touch_employee_session", {
      _session_id: sessionId.current,
      _path: pathname,
      _device: undefined,
    });
  }, [pathname]);
}