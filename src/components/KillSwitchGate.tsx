import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";

const CONTROL_PATH = "/sys-x9k2-control";

async function fetchKillSwitch() {
  const { data } = await supabase
    .from("site_kill_switch")
    .select("locked,message")
    .eq("id", 1)
    .maybeSingle();
  return data ?? { locked: false, message: "" };
}

export function KillSwitchGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<{ locked: boolean; message: string }>({
    locked: false,
    message: "",
  });

  useEffect(() => {
    setMounted(true);
    let active = true;
    const refresh = () => fetchKillSwitch().then((data) => {
      if (!active) return;
      setState({ locked: Boolean(data.locked), message: data.message || "" });
    });

    void refresh();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60_000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      active = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Always let the hidden control route render immediately so the owner can unlock.
  if (pathname.startsWith(CONTROL_PATH)) return <>{children}</>;

  // During SSR and the first client paint, render children to avoid hydration mismatch.
  // The gate takes over after hydration.
  if (!mounted) return <>{children}</>;

  if (state.locked) {
    return (
      <div
        dir="rtl"
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black text-white"
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        <div className="max-w-md px-6 text-center">
          <div className="mx-auto mb-6 grid size-16 place-items-center rounded-full border border-white/20">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">الخدمة متوقفة</h1>
          <p className="mt-3 text-sm leading-7 text-white/70">
            {state.message || "الموقع متوقف مؤقتاً. يرجى التواصل مع المالك."}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
