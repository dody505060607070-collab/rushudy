import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type AuthedSupabase = SupabaseClient<Database>;

async function assertSuperAdmin(supabase: AuthedSupabase, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("هذه العملية متاحة لمدير النظام فقط.");
}

/** إنشاء حساب موظف جديد (بريد + كلمة مرور) وربط ملفه الشخصي. */
export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      email: string;
      password: string;
      fullName: string;
      phone?: string;
      whatsapp?: string;
      jobTitle?: string;
      hireDate?: string;
      adminNotes?: string;
      isSuperAdmin?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    if (!data.email.trim() || data.password.length < 8) {
      throw new Error("البريد مطلوب وكلمة المرور 8 أحرف على الأقل.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email.trim(),
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, phone: data.phone ?? "" },
    });
    if (created.error) throw new Error(created.error.message);
    const newId = created.data.user?.id;
    if (!newId) throw new Error("تعذّر إنشاء الحساب.");

    const profile = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: newId,
        full_name: data.fullName.trim() || data.email.trim(),
        email: data.email.trim(),
        phone: data.phone?.trim() || null,
        whatsapp: data.whatsapp?.trim() || null,
        job_title: data.jobTitle?.trim() || null,
        hire_date: data.hireDate?.trim() || null,
        admin_notes: data.adminNotes?.trim() || null,
        is_active: true,
        org: "rashoudi",
      })
      .select("id")
      .single();
    if (profile.error) throw new Error(profile.error.message);

    if (data.isSuperAdmin) {
      const role = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: newId, role: "super_admin" }, { onConflict: "user_id,role" });
      if (role.error) throw new Error(role.error.message);
    } else {
      const role = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: newId, role: "employee" }, { onConflict: "user_id,role" });
      if (role.error) throw new Error(role.error.message);
    }

    return { id: newId };
  });

/** تعيين كلمة مرور جديدة لموظف قائم. */
export const resetStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; password: string }) => input)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    if (data.password.length < 8) throw new Error("كلمة المرور 8 أحرف على الأقل.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });

/** منح أو سحب صلاحية المدير العام لموظف آخر. */
export const setStaffSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; enabled: boolean }) => input)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    if (!data.userId) throw new Error("لم يتم تحديد الموظف.");
    if (data.userId === context.userId && !data.enabled) {
      throw new Error("لا يمكنك سحب صلاحية المدير العام من حسابك.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.enabled) {
      const res = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "super_admin" }, { onConflict: "user_id,role" });
      if (res.error) throw new Error(res.error.message);
    } else {
      const res = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "super_admin");
      if (res.error) throw new Error(res.error.message);
      const keep = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "employee" }, { onConflict: "user_id,role" });
      if (keep.error) throw new Error(keep.error.message);
    }

    return { ok: true };
  });

/** حذف حساب موظف نهائيًا أو إيقافه فقط. */
export const deleteStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; mode?: "disable" | "delete" }) => input)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    if (!data.userId) throw new Error("لم يتم تحديد الموظف.");
    if (data.userId === context.userId) throw new Error("لا يمكنك حذف حسابك الحالي.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.mode === "disable") {
      const res = await supabaseAdmin
        .from("profiles")
        .update({ is_active: false })
        .eq("id", data.userId);
      if (res.error) throw new Error(res.error.message);
      return { ok: true, mode: "disable" as const };
    }

    await supabaseAdmin.from("user_permissions").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    const del = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (del.error) throw new Error(del.error.message);
    return { ok: true, mode: "delete" as const };
  });
