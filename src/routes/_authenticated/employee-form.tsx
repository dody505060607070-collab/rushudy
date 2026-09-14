import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, KeyRound, Loader2, NotebookPen, ShieldCheck, UserCog } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Field, inputClass, textareaClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { actionLabels, permissionModules } from "@/data/nav";
import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { createStaffAccount, resetStaffPassword } from "@/lib/staff.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/employee-form")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search["id"] === "string" ? (search["id"] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "بيانات الموظف والصلاحيات | الرشودي للعقارات" },
      {
        name: "description",
        content: "نموذج الموظف الكامل: البيانات الأساسية، بيانات الدخول، الصلاحيات والملاحظات الإدارية.",
      },
      { property: "og:title", content: "بيانات الموظف والصلاحيات | الرشودي للعقارات" },
      { property: "og:description", content: "إضافة موظف وتحديد صلاحياته على كل قسم بدقة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmployeeFormPage,
});

const tabs = [
  { key: "basic", label: "البيانات الأساسية", icon: UserCog },
  { key: "security", label: "بيانات الدخول", icon: KeyRound },
  { key: "perms", label: "الصلاحيات", icon: ShieldCheck },
  { key: "notes", label: "ملاحظات إدارية", icon: NotebookPen },
] as const;

const emptyForm = {
  full_name: "",
  email: "",
  phone: "",
  whatsapp: "",
  job_title: "",
  hire_date: "",
  admin_notes: "",
  is_active: true,
  whatsapp_notify: true,
  is_super_admin: false,
};

function EmployeeFormPage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useCurrentUser();
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("basic");
  const [form, setForm] = useState({ ...emptyForm });
  const [password, setPassword] = useState("");
  const [perms, setPerms] = useState<Set<string>>(new Set());

  const existing = useQuery({
    queryKey: ["employee", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const [profile, roles, permissions] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, full_name, email, phone, whatsapp, job_title, hire_date, admin_notes, is_active, whatsapp_notify",
          )
          .eq("id", id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", id),
        supabase.from("user_permissions").select("module, action").eq("user_id", id),
      ]);
      if (profile.error) throw profile.error;
      return {
        profile: profile.data,
        isAdmin: (roles.data ?? []).some((r) => r.role === "super_admin"),
        perms: permissions.data ?? [],
      };
    },
  });

  useEffect(() => {
    const data = existing.data;
    if (!data?.profile) return;
    setForm({
      full_name: data.profile.full_name ?? "",
      email: data.profile.email ?? "",
      phone: data.profile.phone ?? "",
      whatsapp: data.profile.whatsapp ?? "",
      job_title: data.profile.job_title ?? "",
      hire_date: data.profile.hire_date ?? "",
      admin_notes: data.profile.admin_notes ?? "",
      is_active: data.profile.is_active ?? true,
      whatsapp_notify: data.profile.whatsapp_notify ?? true,
      is_super_admin: data.isAdmin,
    });
    setPerms(new Set(data.perms.map((p) => `${p.module}:${p.action}`)));
  }, [existing.data]);

  const savePerms = async (userId: string) => {
    const rows = [...perms].map((key) => {
      const [module = "", action = ""] = key.split(":");
      return { user_id: userId, module, action };
    });
    const del = await supabase.from("user_permissions").delete().eq("user_id", userId);
    if (del.error) throw del.error;
    if (rows.length) {
      const ins = await supabase.from("user_permissions").insert(rows);
      if (ins.error) throw ins.error;
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim()) throw new Error("اسم الموظف مطلوب");

      if (!id) {
        if (!form.email.trim() || password.length < 8)
          throw new Error("البريد وكلمة مرور (8 أحرف على الأقل) مطلوبان لإنشاء الحساب");
        const res = await createStaffAccount({
          data: {
            email: form.email.trim(),
            password,
            fullName: form.full_name.trim(),
            phone: form.phone,
            whatsapp: form.whatsapp,
            jobTitle: form.job_title,
            hireDate: form.hire_date,
            adminNotes: form.admin_notes,
            isSuperAdmin: form.is_super_admin,
          },
        });
        await savePerms(res.id);
        return res.id;
      }

      const upd = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
          whatsapp: form.whatsapp.trim() || null,
          job_title: form.job_title.trim() || null,
          hire_date: form.hire_date || null,
          admin_notes: form.admin_notes.trim() || null,
          is_active: form.is_active,
          whatsapp_notify: form.whatsapp_notify,
        })
        .eq("id", id);
      if (upd.error) throw upd.error;
      await savePerms(id);
      if (password) await resetStaffPassword({ data: { userId: id, password } });
      if (form.is_super_admin !== Boolean(existing.data?.isAdmin)) {
        await setStaffSuperAdmin({ data: { userId: id, enabled: form.is_super_admin } });
      }
      return id;
    },
    onSuccess: () => {
      toast.success(id ? "تم حفظ بيانات الموظف" : "تم إنشاء حساب الموظف");
      setPassword("");
      queryClient.invalidateQueries({ queryKey: ["employee", id] });
      queryClient.invalidateQueries({ queryKey: ["staff-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["live", "profiles"] });
      navigate({ to: "/employees" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الحفظ"),
  });

  const togglePerm = (key: string) =>
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (!isSuperAdmin) {
    return (
      <>
        <PageHero
          title="بيانات الموظف"
          subtitle="هذه الشاشة متاحة لمدير النظام فقط."
          icon={UserCog}
        />
        <div className="surface-card p-6 text-[13px] text-muted-foreground">
          لا تملك صلاحية إدارة الموظفين. تواصل مع مدير النظام.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHero
        title={id ? "تعديل موظف" : "إضافة موظف"}
        subtitle="بيانات الموظف وحساب الدخول والصلاحيات والملاحظات في نموذج واحد."
        icon={UserCog}
        stats={[{ label: "الصلاحيات المفعّلة", value: String(perms.size) }]}
      />

      <div className="surface-card overflow-hidden">
        <div className="flex flex-wrap gap-1 border-b border-border bg-muted/40 px-3 py-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition-colors",
                tab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-card",
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {existing.isLoading ? (
            <p className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              جارٍ تحميل بيانات الموظف…
            </p>
          ) : null}

          {tab === "basic" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="الاسم الكامل">
                <input
                  className={inputClass}
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </Field>
              <Field label="المسمى الوظيفي">
                <input
                  className={inputClass}
                  value={form.job_title}
                  onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                />
              </Field>
              <Field label="الجوال">
                <input
                  dir="ltr"
                  className={inputClass}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
              <Field label="رقم الواتساب">
                <input
                  dir="ltr"
                  className={inputClass}
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                />
              </Field>
              <Field label="تاريخ التعيين">
                <input
                  type="date"
                  className={inputClass}
                  value={form.hire_date}
                  onChange={(e) => setForm({ ...form, hire_date: e.target.value })}
                />
              </Field>
              <div className="flex flex-col justify-center gap-2">
                <label className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />
                  الحساب نشط
                </label>
                <label className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={form.whatsapp_notify}
                    onChange={(e) => setForm({ ...form, whatsapp_notify: e.target.checked })}
                  />
                  إشعارات واتساب للمهام والتذكيرات
                </label>
              </div>
            </div>
          ) : null}

          {tab === "security" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="البريد الإلكتروني">
                <input
                  dir="ltr"
                  disabled={Boolean(id)}
                  className={cn(inputClass, id && "opacity-60")}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field label={id ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور"}>
                <input
                  dir="ltr"
                  type="password"
                  className={inputClass}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <label className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={form.is_super_admin}
                  disabled={Boolean(id)}
                  onChange={(e) => setForm({ ...form, is_super_admin: e.target.checked })}
                />
                مدير نظام (كل الصلاحيات)
              </label>
              <p className="text-[12px] leading-6 text-muted-foreground md:col-span-2">
                {id
                  ? "تغيير الدور لمدير نظام يتم من صفحة الأدوار والصلاحيات. اكتب كلمة مرور جديدة فقط إذا رغبت في تغييرها."
                  : "يُنشأ الحساب مباشرة ويمكن للموظف الدخول بالبريد وكلمة المرور بعد الحفظ."}
              </p>
            </div>
          ) : null}

          {tab === "perms" ? (
            <div className="space-y-3">
              {form.is_super_admin ? (
                <p className="rounded-lg bg-muted px-3 py-2 text-[12.5px] text-muted-foreground">
                  مدير النظام يملك كل الصلاحيات تلقائيًا.
                </p>
              ) : null}
              {permissionModules.map((module) => (
                <div key={module.key} className="rounded-xl border border-border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-[13px] font-bold text-foreground">{module.label}</h3>
                    <button
                      type="button"
                      onClick={() =>
                        setPerms((prev) => {
                          const next = new Set(prev);
                          const all = module.actions.every((a) => next.has(`${module.key}:${a}`));
                          module.actions.forEach((a) =>
                            all ? next.delete(`${module.key}:${a}`) : next.add(`${module.key}:${a}`),
                          );
                          return next;
                        })
                      }
                      className="text-[12px] font-semibold text-primary"
                    >
                      تحديد الكل
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {module.actions.map((action) => {
                      const key = `${module.key}:${action}`;
                      const on = perms.has(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => togglePerm(key)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                            on
                              ? "border-primary bg-primary text-primary-foreground"
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
          ) : null}

          {tab === "notes" ? (
            <Field label="ملاحظات إدارية (داخلية)">
              <textarea
                className={textareaClass}
                value={form.admin_notes}
                onChange={(e) => setForm({ ...form, admin_notes: e.target.value })}
              />
            </Field>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <Link
            to="/employees"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground hover:bg-muted"
          >
            <ArrowRight className="size-4" />
            رجوع للموظفين
          </Link>
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {id ? "حفظ التعديلات" : "إنشاء الموظف"}
          </button>
        </div>
      </div>
    </>
  );
}
