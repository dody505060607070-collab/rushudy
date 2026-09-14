import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "employee" | "owner";

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  is_active: boolean;
};

type AuthValue = {
  session: Session | null;
  loading: boolean;
};

const AuthContext = createContext<AuthValue>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        await supabase.rpc("bootstrap_current_user");
        await queryClient.invalidateQueries({ queryKey: ["me"] });
      } catch {
        /* تجاهل */
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
      if (data.session) void bootstrap();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setSession(next);
      if (event === "SIGNED_IN") void bootstrap();
      if (event === "SIGNED_OUT") {
        queryClient.clear();
      } else {
        queryClient.invalidateQueries();
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export function useSession() {
  return useContext(AuthContext);
}

/** الملف الشخصي + الدور + الصلاحيات للمستخدم الحالي */
export function useCurrentUser() {
  const { session, loading } = useSession();
  const userId = session?.user.id;

  const query = useQuery({
    queryKey: ["me", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [profileRes, rolesRes, permsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId!).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId!),
        supabase.from("user_permissions").select("module, action").eq("user_id", userId!),
      ]);

      const roles = (rolesRes.data ?? []).map((r) => r.role as AppRole);
      const perms = new Set((permsRes.data ?? []).map((p) => `${p.module}:${p.action}`));

      return {
        profile: (profileRes.data as Profile | null) ?? null,
        roles,
        perms,
      };
    },
  });

  const isSuperAdmin = query.data?.roles.includes("super_admin") ?? false;

  const can = (module: string, action: string) =>
    isSuperAdmin || (query.data?.perms.has(`${module}:${action}`) ?? false);

  return {
    session,
    userId,
    loading: loading || query.isLoading,
    profile: query.data?.profile ?? null,
    roles: query.data?.roles ?? [],
    isSuperAdmin,
    can,
  };
}

export async function signOut() {
  const sessionId = window.sessionStorage.getItem("rashoudi_employee_session");
  if (sessionId) {
    await supabase.rpc("close_employee_session", { _session_id: sessionId });
    window.sessionStorage.removeItem("rashoudi_employee_session");
  }
  await supabase.auth.signOut();
}
