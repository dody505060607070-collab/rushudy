import { CLIENT_EMAIL_DOMAIN, clientUsername, localPhone } from "./client-credentials";

export type ClientAccountResult =
  | { ok: true; username: string; password: string; created: boolean }
  | { ok: false; reason: string };

/** Server-only account provisioning shared by contract creation and staff account controls. */
export async function ensureClientAccountForContact(contactId: string): Promise<ClientAccountResult> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: contact, error } = await db
    .from("contacts")
    .select("id, full_name, national_id, phone, whatsapp, roles")
    .eq("id", contactId)
    .single();
  if (error || !contact) return { ok: false, reason: "العميل غير موجود." };

  const username = clientUsername(contact.national_id);
  const password = localPhone(contact.phone ?? contact.whatsapp);
  if (!username) return { ok: false, reason: "لا يوجد رقم هوية لهذا العميل." };
  if (!/^05\d{8}$/.test(password)) {
    return { ok: false, reason: "رقم الجوال غير صالح؛ يجب أن يصبح بصيغة 05xxxxxxxx." };
  }

  const loginEmail = `${username}@${CLIENT_EMAIL_DOMAIN}`;
  const existing = await db
    .from("client_accounts")
    .select("id, user_id, username, login_email")
    .eq("contact_id", contact.id)
    .maybeSingle();
  const metadata = {
    full_name: contact.full_name,
    client_contact_id: contact.id,
    portal: true,
    portal_role: (contact.roles ?? []).includes("owner") ? "owner" : "client",
  };

  if (existing.data) {
    const updated = await db.auth.admin.updateUserById(existing.data.user_id, {
      email: loginEmail,
      password,
      user_metadata: metadata,
    });
    if (updated.error) throw new Error(updated.error.message);
    const accountUpdate = await db
      .from("client_accounts")
      .update({ username, login_email: loginEmail })
      .eq("id", existing.data.id);
    if (accountUpdate.error) throw new Error(accountUpdate.error.message);
    if ((contact.roles ?? []).includes("owner")) {
      const role = await db
        .from("user_roles")
        .upsert({ user_id: existing.data.user_id, role: "owner" }, { onConflict: "user_id,role" });
      if (role.error) throw new Error(role.error.message);
    }
    return { ok: true, username, password, created: false };
  }

  const created = await db.auth.admin.createUser({
    email: loginEmail,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  let userId = created.data.user?.id;
  if (!userId) {
    const users = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = users.data.users.find((user) => user.email === loginEmail)?.id;
    if (userId) {
      const updated = await db.auth.admin.updateUserById(userId, { password, user_metadata: metadata });
      if (updated.error) throw new Error(updated.error.message);
    }
  }
  if (!userId) throw new Error(created.error?.message ?? "تعذّر إنشاء حساب العميل.");

  const account = await db.from("client_accounts").upsert(
    { contact_id: contact.id, user_id: userId, username, login_email: loginEmail },
    { onConflict: "contact_id" },
  );
  if (account.error) throw new Error(account.error.message);
  if ((contact.roles ?? []).includes("owner")) {
    const role = await db
      .from("user_roles")
      .upsert({ user_id: userId, role: "owner" }, { onConflict: "user_id,role" });
    if (role.error) throw new Error(role.error.message);
  }
  return { ok: true, username, password, created: true };
}