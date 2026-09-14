import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHero } from "@/components/kit/PageHero";
import { EmptyState } from "@/components/kit/LiveTable";
import { actionLabels, permissionModules } from "@/data/nav";
import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { setStaffSuperAdmin } from "@/lib/staff.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/roles")({
  head: () => ({
    meta: [
      { title: "الأدوار والصلاحيات | الرشودي للعقارات" },
      { name: "description", content: "تحديد صلاحيات كل موظف على مستوى كل قسم وإجراء." },
      { property: "og:title", content: "الأدوار والصلاحيات | الرشودي للعقارات" },
      { property: "og:description", content: "تحديد صلاحيات كل موظف على مستوى كل قسم وإجراء." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RolesPage,
});

function RolesPage() {
  const { isSuperAdmin, loading } = useCurrentUser();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const staff = useQuery({
    queryKey: ["staff-with-roles"],
    queryFn: async () => {
      const [profiles, roles, perms] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, is_active").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("user_permissions").select("user_id, module, action"),
      ]);
      if (profiles.error) throw profiles.error;
      return {
        profiles: profiles.data ?? [],
        roles: roles.data ?? [],
        perms: perms.data ?? [],
      };
    },
  });

  const userId = selected ?? staff.data?.profiles[0]?.id ?? null;
  const userPerms = new Set(
    (staff.data?.perms ?? [])
      .filter((p) => p.user_id === userId)
      .map((p) => `${p.module}:${p.action}`),
  );
  const isTargetAdmin = (staff.data?.roles ?? []).some(
    (r) => r.user_id === userId && r.role === "super_admin",
  );

  const grantAdmin = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!userId) throw new Error("لم يتم اختيار موظف");
      return setStaffSuperAdmin({ data: { userId, enabled } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("تم تحديث صلاحية المدير العام");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر التحديث"),
  });

  const toggle = useMutation({
    mutationFn: async ({
      module,
      action,
      enabled,
    }: {
      module: string;
      action: string;
      enabled: boolean;
    }) => {
      if (!userId) throw new Error("لم يتم اختيار موظف");
      if (enabled) {
        const { error } = await supabase
          .from("user_permissions")
          .insert({ user_id: userId, module, action });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_permissions")
          .delete()
          .eq("user_id", userId)
          .eq("module", module)
          .eq("action", action);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("تم تحديث الصلاحية");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر التحديث"),
  });

  if (loading || staff.isLoading) {
    return (
      <div className="surface-card grid place-items-center gap-2 px-6 py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <PageHero
        title="الأدوار والصلاحيات"
        subtitle="الصلاحيات تُطبّق داخل قاعدة البيانات، فلا يستطيع أي موظف قراءة أو تعديل ما ليس مخوّلًا له."
        icon={ShieldCheck}
      />

      {!isSuperAdmin ? (
        <div className="surface-card">
          <EmptyState
            text="هذه الصفحة للمدير العام فقط"
            hint="تواصل مع المدير العام لتعديل صلاحياتك."
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="surface-card p-3">
            <p className="px-2 pb-2 text-[12.5px] font-semibold text-muted-foreground">الموظفون</p>
            <ul className="space-y-1">
              {(staff.data?.profiles ?? []).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(p.id)}
                    className={cn(
                      "w-full rounded-lg px-3 py-2 text-start text-[13.5px] transition-colors",
                      p.id === userId
                        ? "bg-accent font-semibold text-accent-foreground"
                        : "hover:bg-muted",
                    )}
                  >
                    {p.full_name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="surface-card p-5">
            {isTargetAdmin ? (
              <p className="rounded-lg border border-primary/25 bg-primary/8 px-4 py-3 text-[13px] text-primary">
                هذا الحساب مدير عام ولديه كل الصلاحيات تلقائيًا.
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
              <div>
                <p className="text-[13.5px] font-bold text-foreground">صلاحية المدير العام</p>
                <p className="text-[12.5px] text-muted-foreground">
                  منح هذا الموظف نفس صلاحيات المدير العام بالكامل.
                </p>
              </div>
              <button
                type="button"
                disabled={!userId || grantAdmin.isPending}
                onClick={() => grantAdmin.mutate(!isTargetAdmin)}
                className={cn(
                  "rounded-lg border px-4 py-2 text-[12.5px] font-bold transition-colors disabled:opacity-60",
                  isTargetAdmin
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-primary/30 bg-primary/10 text-primary",
                )}
              >
                {isTargetAdmin ? "سحب صلاحية المدير العام" : "منح صلاحية المدير العام"}
              </button>
            </div>


            <div className="mt-4 space-y-5">
              {permissionModules.map((mod) => (
                <div key={mod.key}>
                  <p className="text-[13.5px] font-bold text-foreground">{mod.label}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {mod.actions.map((action) => {
                      const key = `${mod.key}:${action}`;
                      const on = isTargetAdmin || userPerms.has(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={isTargetAdmin || toggle.isPending}
                          onClick={() =>
                            toggle.mutate({ module: mod.key, action, enabled: !on })
                          }
                          className={cn(
                            "rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-60",
                            on
                              ? "border-success/30 bg-success/12 text-success"
                              : "border-border text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {actionLabels[action] ?? action}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
