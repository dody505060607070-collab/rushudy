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

const ALL_ACTIONS = Array.from(new Set(permissionModules.flatMap((m) => m.actions as readonly string[])));

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
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="surface-card p-4">
            <h2 className="px-1 text-[17px] font-bold text-foreground">قائمة الموظفين</h2>
            <p className="px-1 pb-3 text-[12px] text-muted-foreground">اختر موظفًا لعرض أو تعديل صلاحياته</p>
            <ul className="space-y-2">
              {(staff.data?.profiles ?? []).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(p.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-start text-[13.5px] transition-colors",
                      p.id === userId
                        ? "border-primary/50 bg-primary/[0.06] font-bold text-foreground"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color:var(--warning)]/12 text-[color:var(--warning)]"><UserRound className="size-5" /></span>
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


            <h2 className="mt-5 text-[17px] font-bold text-foreground">صلاحيات الموظف</h2>
            <p className="text-[12px] text-muted-foreground">اضغط على المربع لتفعيل أو إلغاء الصلاحية — تُحفظ فورًا</p>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-[13px]">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-4 py-3 text-start font-bold">الوحدة</th>
                    {ALL_ACTIONS.map((a) => <th key={a} className="px-3 py-3 text-center font-bold">{actionLabels[a] ?? a}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {permissionModules.map((mod) => (
                    <tr key={mod.key}>
                      <td className="px-4 py-3 font-semibold">{mod.label}</td>
                      {ALL_ACTIONS.map((action) => {
                        if (!(mod.actions as readonly string[]).includes(action)) return <td key={action} className="text-center text-muted-foreground">—</td>;
                        const key = `${mod.key}:${action}`;
                        const on = isTargetAdmin || userPerms.has(key);
                        return (
                          <td key={action} className="px-3 py-3 text-center">
                            <button
                              type="button"
                              aria-label={`${mod.label} - ${actionLabels[action] ?? action}`}
                              disabled={isTargetAdmin || toggle.isPending}
                              onClick={() => toggle.mutate({ module: mod.key, action, enabled: !on })}
                              className={cn("inline-grid size-7 place-items-center rounded-md border-2 transition-colors disabled:opacity-60", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50")}
                            >
                              {on ? <Check className="size-4" /> : null}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 rounded-xl bg-[color:var(--warning)]/10 px-4 py-3 text-[12.5px] text-muted-foreground">الصلاحيات تُطبّق فورًا على هذا الموظف داخل النظام.</p>
          </div>
        </div>
      )}
    </>
  );
}
