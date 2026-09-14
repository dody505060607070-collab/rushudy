import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EMAIL_DOMAIN = "client.mithraa.sa";

export function localPhone(raw: string | null | undefined): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("966")) return `0${digits.slice(3)}`;
  if (digits.startsWith("00966")) return `0${digits.slice(5)}`;
  if (digits.startsWith("5")) return `0${digits}`;
  return digits;
}

export function clientUsername(nationalId: string | null | undefined): string {
  return String(nationalId ?? "").replace(/\D/g, "");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** ينشئ (أو يحدّث) حساب دخول للعميل: اسم المستخدم = رقم الهوية، كلمة المرور = الجوال المحلي 05… */
export const ensureClientAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contactId: string }) => input)
  .handler(async ({ data, context }) => {
    const staff = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff.data) throw new Error("غير مصرّح.");

    const db = await admin();
    const { data: contact, error } = await db
      .from("contacts")
      .select("id, full_name, national_id, phone, whatsapp, email, roles")
      .eq("id", data.contactId)
      .single();
    if (error || !contact) throw new Error("العميل غير موجود.");

    const username = clientUsername(contact.national_id);
    const password = localPhone(contact.phone ?? contact.whatsapp);
    if (!username) return { ok: false as const, reason: "لا يوجد رقم هوية لهذا العميل." };
    if (password.length < 6) return { ok: false as const, reason: "لا يوجد رقم جوال صالح لهذا العميل." };

    const loginEmail = `${username}@${EMAIL_DOMAIN}`;

    const existing = await db
      .from("client_accounts")
      .select("id, user_id")
      .eq("contact_id", contact.id)
      .maybeSingle();

    if (existing.data) {
      await db.auth.admin.updateUserById(existing.data.user_id, { password });
      return { ok: true as const, username, password, created: false };
    }

    const created = await db.auth.admin.createUser({
      email: loginEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: contact.full_name, client_contact_id: contact.id, portal: true },
    });

    let userId = created.data.user?.id;
    if (!userId) {
      // قد يكون الحساب موجودًا مسبقًا بنفس البريد
      const list = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
      userId = list.data.users.find((u) => u.email === loginEmail)?.id;
      if (userId) await db.auth.admin.updateUserById(userId, { password });
    }
    if (!userId) throw new Error(created.error?.message ?? "تعذّر إنشاء حساب العميل.");

    await db
      .from("client_accounts")
      .upsert(
        { contact_id: contact.id, user_id: userId, username, login_email: loginEmail },
        { onConflict: "contact_id" },
      );

    if ((contact.roles ?? []).includes("owner")) {
      await db.from("user_roles").upsert({ user_id: userId, role: "owner" }, { onConflict: "user_id,role" });
    }

    return { ok: true as const, username, password, created: true };
  });

function randomDigits(length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += String(Math.floor(Math.random() * 10));
  return out;
}

/** يعرض بيانات دخول العميل الحالية للموظف (اسم المستخدم فقط — كلمة المرور تُعاد بإصدار جديد). */
export const getClientAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contactId: string }) => input)
  .handler(async ({ data, context }) => {
    const staff = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff.data) throw new Error("غير مصرّح.");
    const db = await admin();
    const [account, contact] = await Promise.all([
      db
        .from("client_accounts")
        .select("username, login_email, created_at")
        .eq("contact_id", data.contactId)
        .maybeSingle(),
      db
        .from("contacts")
        .select("national_id, phone, whatsapp")
        .eq("id", data.contactId)
        .maybeSingle(),
    ]);
    return {
      account: account.data ?? null,
      suggestedUsername: clientUsername(contact.data?.national_id),
      suggestedPassword: localPhone(contact.data?.phone ?? contact.data?.whatsapp),
    };
  });

/**
 * ينشئ أو يُعيد إصدار بيانات دخول العميل ويُرجعها للموظف.
 * لو العقد/الملف ما فيهش رقم هوية أو جوال، النظام يولّد اسم مستخدم وكلمة مرور تلقائيًا.
 */
export const issueClientAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contactId: string; username?: string; password?: string }) => input)
  .handler(async ({ data, context }) => {
    const staff = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff.data) throw new Error("غير مصرّح.");

    const db = await admin();
    const { data: contact, error } = await db
      .from("contacts")
      .select("id, full_name, national_id, phone, whatsapp, roles")
      .eq("id", data.contactId)
      .single();
    if (error || !contact) throw new Error("العميل غير موجود.");

    const existing = await db
      .from("client_accounts")
      .select("id, user_id, username, login_email")
      .eq("contact_id", contact.id)
      .maybeSingle();

    // اسم المستخدم: المُدخل يدويًا → الحساب الحالي → رقم الهوية → رقم تلقائي فريد
    let username = clientUsername(data.username) || existing.data?.username || clientUsername(contact.national_id);
    if (!username) {
      for (let i = 0; i < 12; i += 1) {
        const candidate = `9${randomDigits(9)}`;
        const taken = await db
          .from("client_accounts")
          .select("id")
          .eq("username", candidate)
          .maybeSingle();
        if (!taken.data) {
          username = candidate;
          break;
        }
      }
    }
    if (!username) throw new Error("تعذّر توليد اسم مستخدم.");

    const manualPassword = String(data.password ?? "").trim();
    let password = manualPassword || localPhone(contact.phone ?? contact.whatsapp);
    let generated = false;
    if (password.length < 6) {
      password = `05${randomDigits(8)}`;
      generated = true;
    }

    const loginEmail = existing.data?.login_email ?? `${username}@${EMAIL_DOMAIN}`;

    if (existing.data) {
      const upd = await db.auth.admin.updateUserById(existing.data.user_id, { password });
      if (upd.error) throw new Error(upd.error.message);
      if (existing.data.username !== username) {
        await db.from("client_accounts").update({ username }).eq("id", existing.data.id);
      }
      if ((contact.roles ?? []).includes("owner")) {
        await db.from("user_roles").upsert({ user_id: existing.data.user_id, role: "owner" }, { onConflict: "user_id,role" });
      }
      return { username, password, loginEmail, created: false, generated };
    }

    const created = await db.auth.admin.createUser({
      email: loginEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: contact.full_name, client_contact_id: contact.id, portal: true },
    });

    let userId = created.data.user?.id;
    if (!userId) {
      const list = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
      userId = list.data.users.find((u) => u.email === loginEmail)?.id;
      if (userId) await db.auth.admin.updateUserById(userId, { password });
    }
    if (!userId) throw new Error(created.error?.message ?? "تعذّر إنشاء حساب العميل.");

    const up = await db
      .from("client_accounts")
      .upsert(
        { contact_id: contact.id, user_id: userId, username, login_email: loginEmail },
        { onConflict: "contact_id" },
      );
    if (up.error) throw new Error(up.error.message);

    if ((contact.roles ?? []).includes("owner")) {
      await db.from("user_roles").upsert({ user_id: userId, role: "owner" }, { onConflict: "user_id,role" });
    }

    return { username, password, loginEmail, created: true, generated };
  });

/** يحوّل اسم المستخدم (رقم الهوية) إلى بريد الدخول الداخلي. */
export const resolveClientLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { username: string }) => input)
  .handler(async ({ data }) => {
    const username = clientUsername(data.username);
    if (!username) return { email: null as string | null };
    const db = await admin();
    const row = await db
      .from("client_accounts")
      .select("login_email")
      .eq("username", username)
      .maybeSingle();
    return { email: row.data?.login_email ?? null };
  });

async function currentClient(userId: string) {
  const db = await admin();
  const account = await db
    .from("client_accounts")
    .select("contact_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!account.data) throw new Error("لا توجد بوابة عميل مرتبطة بهذا الحساب.");
  return { db, contactId: account.data.contact_id };
}

/** كل عقود العميل: سواء كان مستأجرًا أو مالكًا أو وسيطًا في العقد. */
const partyFilter = (id: string) => `tenant_id.eq.${id},owner_id.eq.${id},broker_id.eq.${id}`;

export const getPortalOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, contactId } = await currentClient(context.userId);
    const [contact, contracts, buildings, units, properties] = await Promise.all([
      db.from("contacts").select("id, full_name, national_id, phone, email, roles").eq("id", contactId).single(),
      db
        .from("contracts")
        .select(
          "id, contract_number, contract_type, start_date, end_date, annual_rent, total_value, payment_cycle, payments_count, status, tenant:tenant_id(full_name), property:property_id(name, city, district), unit:unit_id(unit_number, unit_type)",
        )
        .or(partyFilter(contactId))
        .order("start_date", { ascending: false }),
      db.from("buildings").select("id, name, city, district, address").eq("owner_id", contactId).order("name"),
      db.from("units").select("id, building_id, unit_number, unit_type, status, floor, area").eq("owner_id", contactId).order("unit_number"),
      db.from("properties").select("id, building_id, code, name, purpose, status, city, district").eq("owner_id", contactId).order("name"),
    ]);

    const contractIds = (contracts.data ?? []).map((c) => c.id);

    // الفواتير: الصادرة باسم العميل أو المرتبطة بأي من عقوده
    const invoiceFilter = contractIds.length
      ? `contact_id.eq.${contactId},contract_id.in.(${contractIds.join(",")})`
      : `contact_id.eq.${contactId}`;

    const [invoices, payments] = await Promise.all([
      db
        .from("invoices")
        .select("id, invoice_number, issue_date, due_date, total, status, items:invoice_items(count)")
        .or(invoiceFilter)
        .order("issue_date", { ascending: false }),
      contractIds.length
        ? db
            .from("contract_payments")
            .select("id, contract_id, payment_number, due_date, amount_due, amount_paid, status")
            .in("contract_id", contractIds)
            .order("due_date", { ascending: true })
        : Promise.resolve({ data: [] as never[] }),
    ]);

    return {
      contact: contact.data,
      contracts: contracts.data ?? [],
      invoices: invoices.data ?? [],
      payments: (payments.data ?? []) as {
        id: string;
        contract_id: string;
        payment_number: number;
        due_date: string;
        amount_due: number;
        amount_paid: number;
        status: string;
      }[],
      buildings: buildings.data ?? [],
      units: units.data ?? [],
      properties: properties.data ?? [],
      isOwner: (contact.data?.roles ?? []).includes("owner"),
    };
  });

export const getPortalContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contractId: string }) => input)
  .handler(async ({ data, context }) => {
    const { db, contactId } = await currentClient(context.userId);
    const contract = await db
      .from("contracts")
      .select(
        "id, contract_number, contract_type, start_date, end_date, annual_rent, total_value, deposit, payment_cycle, payments_count, status, tenant:tenant_id(full_name), property:property_id(name, city, district), unit:unit_id(unit_number, unit_type)",
      )
      .eq("id", data.contractId)
      .or(partyFilter(contactId))
      .maybeSingle();
    if (!contract.data) throw new Error("العقد غير متاح.");

    const payments = await db
      .from("contract_payments")
      .select("id, payment_number, due_date, amount_due, amount_paid, status, notes")
      .eq("contract_id", data.contractId)
      .order("payment_number", { ascending: true });

    return { contract: contract.data, payments: payments.data ?? [] };
  });


export const getPortalInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { invoiceId: string }) => input)
  .handler(async ({ data, context }) => {
    const { db, contactId } = await currentClient(context.userId);
    const mine = await db.from("contracts").select("id").or(partyFilter(contactId));
    const contractIds = (mine.data ?? []).map((c) => c.id);
    const filter = contractIds.length
      ? `contact_id.eq.${contactId},contract_id.in.(${contractIds.join(",")})`
      : `contact_id.eq.${contactId}`;
    const invoice = await db
      .from("invoices")
      .select("id, invoice_number, issue_date, due_date, status, subtotal, vat_amount, total, notes, contact:contact_id(full_name, national_id, phone)")
      .eq("id", data.invoiceId)
      .or(filter)
      .maybeSingle();
    if (!invoice.data) throw new Error("الفاتورة غير متاحة.");

    const items = await db
      .from("invoice_items")
      .select("id, description, quantity, unit_price, total, sort_order")
      .eq("invoice_id", data.invoiceId)
      .order("sort_order", { ascending: true });
    return { invoice: invoice.data, items: items.data ?? [] };
  });
