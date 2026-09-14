import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureClientAccountForContact } from "./client-account.server";
import { CLIENT_EMAIL_DOMAIN, clientUsername, localPhone } from "./client-credentials";

export { clientUsername, localPhone } from "./client-credentials";

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

    return ensureClientAccountForContact(data.contactId);
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

    const loginEmail = existing.data?.login_email ?? `${username}@${CLIENT_EMAIL_DOMAIN}`;

    if (existing.data) {
      const upd = await db.auth.admin.updateUserById(existing.data.user_id, {
        password,
        user_metadata: { full_name: contact.full_name, client_contact_id: contact.id, portal: true, portal_role: (contact.roles ?? []).includes("owner") ? "owner" : "client" },
      });
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
      user_metadata: { full_name: contact.full_name, client_contact_id: contact.id, portal: true, portal_role: (contact.roles ?? []).includes("owner") ? "owner" : "client" },
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
  .inputValidator((input: { username: string; password?: string }) => input)
  .handler(async ({ data }) => {
    const username = clientUsername(data.username);
    if (!username) return { email: null as string | null };
    const db = await admin();
    const row = await db
      .from("client_accounts")
      .select("login_email")
      .eq("username", username)
      .maybeSingle();
    if (row.data?.login_email) return { email: row.data.login_email };

    // إصلاح آمن للحسابات القديمة: لا ننشئ الحساب إلا إذا طابقت كلمة المرور جوال
    // مالك موجود بالفعل وله عقد مسجل في النظام.
    const suppliedPassword = localPhone(data.password);
    if (!suppliedPassword) return { email: null as string | null };
    const contact = await db
      .from("contacts")
      .select("id, phone, whatsapp, roles")
      .eq("national_id", username)
      .maybeSingle();
    const isOwner = (contact.data?.roles ?? []).includes("owner");
    const expectedPassword = localPhone(contact.data?.phone ?? contact.data?.whatsapp);
    if (!contact.data || !isOwner || suppliedPassword !== expectedPassword) {
      return { email: null as string | null };
    }
    const contract = await db.from("contracts").select("id").eq("owner_id", contact.data.id).limit(1);
    if (!contract.data?.length) return { email: null as string | null };
    const repaired = await ensureClientAccountForContact(contact.data.id);
    return { email: repaired.ok ? `${repaired.username}@${CLIENT_EMAIL_DOMAIN}` : null };
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

/** لوحة تحكم المالك: المباني والوحدات والعقود والدفعات الخاصة به فقط. */
export const getOwnerDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, contactId } = await currentClient(context.userId);
    const contact = await db
      .from("contacts")
      .select("id, full_name, national_id, phone, roles")
      .eq("id", contactId)
      .single();
    if (!(contact.data?.roles ?? []).includes("owner")) throw new Error("هذه اللوحة متاحة للملاك فقط.");

    const [buildings, units, properties, contracts] = await Promise.all([
      db.from("buildings").select("id, name, city, district, address").eq("owner_id", contactId).order("name"),
      db
        .from("units")
        .select("id, building_id, unit_number, unit_type, status, floor, area")
        .eq("owner_id", contactId)
        .order("unit_number"),
      db.from("properties").select("id, code, name, purpose, status, city, district").eq("owner_id", contactId),
      db
        .from("contracts")
        .select(
          "id, contract_number, status, start_date, end_date, annual_rent, total_value, created_at, tenant:tenant_id(full_name, phone), property:property_id(name), unit:unit_id(id, unit_number, unit_type)",
        )
        .eq("owner_id", contactId)
        .order("start_date", { ascending: false }),
    ]);

    const contractIds = (contracts.data ?? []).map((c) => c.id);
    const payments = contractIds.length
      ? await db
          .from("contract_payments")
          .select("id, contract_id, payment_number, due_date, amount_due, amount_paid, status, updated_at")
          .in("contract_id", contractIds)
          .order("due_date", { ascending: true })
      : { data: [] as never[] };

    return {
      contact: contact.data,
      buildings: buildings.data ?? [],
      units: units.data ?? [],
      properties: properties.data ?? [],
      contracts: (contracts.data ?? []) as unknown as {
        id: string;
        contract_number: string;
        status: string;
        start_date: string | null;
        end_date: string | null;
        annual_rent: number | null;
        total_value: number | null;
        created_at: string;
        tenant: { full_name: string; phone: string | null } | null;
        property: { name: string } | null;
        unit: { id: string; unit_number: string | null; unit_type: string | null } | null;
      }[],
      payments: (payments.data ?? []) as {
        id: string;
        contract_id: string;
        payment_number: number;
        due_date: string;
        amount_due: number;
        amount_paid: number;
        status: string;
        updated_at: string;
      }[],
    };
  });

/** يسمح للمالك بتسجيل سداد دفعة على أحد عقوده فقط. */
export const markOwnerPaymentPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paymentId: string; amount?: number; note?: string }) => input)
  .handler(async ({ data, context }) => {
    const { db, contactId } = await currentClient(context.userId);
    const payment = await db
      .from("contract_payments")
      .select("id, contract_id, amount_due, amount_paid, notes")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!payment.data) throw new Error("الدفعة غير موجودة.");

    const contract = await db
      .from("contracts")
      .select("id, owner_id")
      .eq("id", payment.data.contract_id)
      .maybeSingle();
    if (!contract.data || contract.data.owner_id !== contactId) throw new Error("غير مصرّح بتعديل هذه الدفعة.");

    const due = Number(payment.data.amount_due ?? 0);
    const amount = data.amount != null ? Math.max(0, Number(data.amount)) : due;
    const status = amount >= due && due > 0 ? "paid" : amount > 0 ? "partial" : "pending";
    const note = String(data.note ?? "").trim();

    const upd = await db
      .from("contract_payments")
      .update({
        amount_paid: amount,
        status,
        notes: note ? `${payment.data.notes ? `${payment.data.notes}\n` : ""}${note}` : payment.data.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.paymentId);
    if (upd.error) throw new Error(upd.error.message);
    return { ok: true as const, status, amount };
  });

/* ============================================================
 * أدوات المالك العشرة: تنبيهات، كشوف، سجل سداد، صيانة، تذكير،
 * تسويق الشاغر، مرفقات، مصروفات، مقارنة شهرية، تفويض وكيل.
 * ========================================================== */

/** يتحقق أن المستخدم الحالي مالك ويعيد اتصال قاعدة البيانات ومعرّفه. */
async function ownerContext(userId: string) {
  const { db, contactId } = await currentClient(userId);
  const contact = await db.from("contacts").select("id, full_name, roles").eq("id", contactId).single();
  if (!(contact.data?.roles ?? []).includes("owner")) throw new Error("هذه الخدمة متاحة للملاك فقط.");
  return { db, contactId, contact: contact.data };
}

/** يتأكد أن الوحدة/العقار/العقد يخص هذا المالك. */
async function assertOwned(
  db: Awaited<ReturnType<typeof admin>>,
  contactId: string,
  ref: { unitId?: string | null; propertyId?: string | null; contractId?: string | null },
) {
  if (ref.unitId) {
    const r = await db.from("units").select("id").eq("id", ref.unitId).eq("owner_id", contactId).maybeSingle();
    if (!r.data) throw new Error("الوحدة غير تابعة لك.");
  }
  if (ref.propertyId) {
    const r = await db.from("properties").select("id").eq("id", ref.propertyId).eq("owner_id", contactId).maybeSingle();
    if (!r.data) throw new Error("العقار غير تابع لك.");
  }
  if (ref.contractId) {
    const r = await db.from("contracts").select("id").eq("id", ref.contractId).eq("owner_id", contactId).maybeSingle();
    if (!r.data) throw new Error("العقد غير تابع لك.");
  }
}

/** كل بيانات أدوات المالك: الطلبات والمصروفات والمرفقات والمفوَّضين. */
export const getOwnerTools = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, contactId } = await ownerContext(context.userId);
    const [requests, expenses, documents, delegates] = await Promise.all([
      db.from("owner_requests").select("*").eq("owner_id", contactId).order("created_at", { ascending: false }).limit(100),
      db.from("unit_expenses").select("*").eq("owner_id", contactId).order("spent_on", { ascending: false }).limit(300),
      db.from("unit_documents").select("*").eq("owner_id", contactId).order("created_at", { ascending: false }).limit(200),
      db
        .from("owner_delegates")
        .select("id, access_level, is_active, created_at, delegate:delegate_contact_id(id, full_name, phone, national_id)")
        .eq("owner_id", contactId)
        .order("created_at", { ascending: false }),
    ]);

    const docs = await Promise.all(
      (documents.data ?? []).map(async (d) => {
        const signed = await db.storage.from("owner-documents").createSignedUrl(d.storage_path, 3600);
        return { ...d, url: signed.data?.signedUrl ?? null };
      }),
    );

    return {
      requests: requests.data ?? [],
      expenses: expenses.data ?? [],
      documents: docs,
      delegates: (delegates.data ?? []) as unknown as {
        id: string;
        access_level: string;
        is_active: boolean;
        created_at: string;
        delegate: { id: string; full_name: string; phone: string | null; national_id: string | null } | null;
      }[],
    };
  });

/** طلب من المالك: صيانة / تجديد عقد / تسويق وحدة شاغرة. */
export const createOwnerRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      kind: "maintenance" | "renewal" | "marketing" | "other";
      title: string;
      details?: string;
      unitId?: string | null;
      propertyId?: string | null;
      contractId?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { db, contactId, contact } = await ownerContext(context.userId);
    const title = String(data.title ?? "").trim();
    if (title.length < 3) throw new Error("اكتب عنوانًا واضحًا للطلب.");
    await assertOwned(db, contactId, data);

    const ins = await db
      .from("owner_requests")
      .insert({
        owner_id: contactId,
        kind: data.kind,
        title,
        details: String(data.details ?? "").trim() || null,
        unit_id: data.unitId ?? null,
        property_id: data.propertyId ?? null,
        contract_id: data.contractId ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (ins.error) throw new Error(ins.error.message);

    const staffRoles = await db.from("user_roles").select("user_id").in("role", ["super_admin", "employee"]);
    const targets = [...new Set((staffRoles.data ?? []).map((r) => r.user_id))];
    if (targets.length) {
      await db.from("notifications").insert(
        targets.map((user_id) => ({
          user_id,
          title: "طلب جديد من مالك",
          body: `${contact?.full_name ?? "مالك"}: ${title}`,
          link: "/owners",
        })),
      );
    }

    return { ok: true as const, id: ins.data.id };
  });

/** كشف حساب المالك لفترة محددة (للتصدير Excel/PDF من الواجهة). */
export const getOwnerStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { from: string; to: string }) => input)
  .handler(async ({ data, context }) => {
    const { db, contactId, contact } = await ownerContext(context.userId);
    const contracts = await db
      .from("contracts")
      .select("id, contract_number, tenant:tenant_id(full_name), unit:unit_id(unit_number), property:property_id(name)")
      .eq("owner_id", contactId);
    const ids = (contracts.data ?? []).map((c) => c.id);

    const payments = ids.length
      ? await db
          .from("contract_payments")
          .select("id, contract_id, payment_number, due_date, amount_due, amount_paid, status")
          .in("contract_id", ids)
          .gte("due_date", data.from)
          .lte("due_date", data.to)
          .order("due_date")
      : { data: [] as never[] };

    const expenses = await db
      .from("unit_expenses")
      .select("id, category, description, amount, spent_on")
      .eq("owner_id", contactId)
      .gte("spent_on", data.from)
      .lte("spent_on", data.to)
      .order("spent_on");

    const map = new Map((contracts.data ?? []).map((c) => [c.id, c] as const));
    const rows = ((payments.data ?? []) as {
      id: string;
      contract_id: string;
      payment_number: number;
      due_date: string;
      amount_due: number;
      amount_paid: number;
      status: string;
    }[]).map((p) => {
      const c = map.get(p.contract_id) as unknown as
        | { contract_number: string; tenant: { full_name: string } | null; unit: { unit_number: string | null } | null; property: { name: string } | null }
        | undefined;
      return {
        contractNumber: c?.contract_number ?? "—",
        tenant: c?.tenant?.full_name ?? "—",
        unit: c?.unit?.unit_number ?? c?.property?.name ?? "—",
        paymentNumber: p.payment_number,
        dueDate: p.due_date,
        amountDue: Number(p.amount_due ?? 0),
        amountPaid: Number(p.amount_paid ?? 0),
        remaining: Math.max(0, Number(p.amount_due ?? 0) - Number(p.amount_paid ?? 0)),
        status: p.status,
      };
    });

    return {
      ownerName: contact?.full_name ?? "",
      from: data.from,
      to: data.to,
      rows,
      expenses: expenses.data ?? [],
    };
  });

/** تذكير المستأجر بالدفعة عبر واتساب. */
export const remindTenantWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paymentId: string; message?: string }) => input)
  .handler(async ({ data, context }) => {
    const { db, contactId, contact } = await ownerContext(context.userId);
    const payment = await db
      .from("contract_payments")
      .select("id, contract_id, payment_number, due_date, amount_due, amount_paid")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!payment.data) throw new Error("الدفعة غير موجودة.");

    const contract = await db
      .from("contracts")
      .select("id, contract_number, owner_id, tenant:tenant_id(full_name, phone, whatsapp), unit:unit_id(unit_number)")
      .eq("id", payment.data.contract_id)
      .maybeSingle();
    const row = contract.data as unknown as
      | { id: string; contract_number: string; owner_id: string; tenant: { full_name: string; phone: string | null; whatsapp: string | null } | null; unit: { unit_number: string | null } | null }
      | null;
    if (!row || row.owner_id !== contactId) throw new Error("غير مصرّح بهذا الإجراء.");

    const to = row.tenant?.whatsapp ?? row.tenant?.phone ?? "";
    if (!to) throw new Error("لا يوجد رقم جوال للمستأجر.");

    const remaining = Math.max(0, Number(payment.data.amount_due ?? 0) - Number(payment.data.amount_paid ?? 0));
    const body =
      String(data.message ?? "").trim() ||
      `مرحبًا ${row.tenant?.full_name ?? ""}، تذكير بدفعة رقم ${payment.data.payment_number} بمبلغ ${remaining.toLocaleString("en-US")} ر.س المستحقة بتاريخ ${payment.data.due_date}${row.unit?.unit_number ? ` للوحدة ${row.unit.unit_number}` : ""}. شكرًا لتعاونكم — ${contact?.full_name ?? "المالك"}.`;

    const { twilioSend } = await import("./whatsapp.functions");
    const result = await twilioSend({ to, body });

    await db.from("message_log").insert({
      body,
      channel: "whatsapp",
      contract_id: row.id,
      payment_id: payment.data.id,
      recipient_name: row.tenant?.full_name ?? null,
      recipient_phone: to,
      result: result.ok ? "sent" : "failed",
      failure_reason: result.ok ? null : result.error,
      provider_message_id: result.ok ? result.sid : null,
      sent_by: context.userId,
      sent_by_system: false,
    });

    if (!result.ok) throw new Error(result.error);
    return { ok: true as const };
  });

/** إضافة مصروف على وحدة/عقار المالك. */
export const addOwnerExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { category: string; amount: number; description?: string; spentOn?: string; unitId?: string | null; propertyId?: string | null }) => input,
  )
  .handler(async ({ data, context }) => {
    const { db, contactId } = await ownerContext(context.userId);
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("أدخل مبلغًا صحيحًا.");
    await assertOwned(db, contactId, data);
    const ins = await db
      .from("unit_expenses")
      .insert({
        owner_id: contactId,
        category: data.category || "maintenance",
        amount,
        description: String(data.description ?? "").trim() || null,
        spent_on: data.spentOn || new Date().toISOString().slice(0, 10),
        unit_id: data.unitId ?? null,
        property_id: data.propertyId ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (ins.error) throw new Error(ins.error.message);
    return { ok: true as const, id: ins.data.id };
  });

export const deleteOwnerExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { db, contactId } = await ownerContext(context.userId);
    const del = await db.from("unit_expenses").delete().eq("id", data.id).eq("owner_id", contactId);
    if (del.error) throw new Error(del.error.message);
    return { ok: true as const };
  });

const DOC_EXT = /\.(pdf|jpg|jpeg|png|webp|docx?|xlsx)$/i;

/** رفع مرفق للوحدة (صك، عداد، صور تسليم). */
export const addOwnerDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { title: string; docType: string; fileName: string; dataBase64: string; unitId?: string | null; propertyId?: string | null }) => input,
  )
  .handler(async ({ data, context }) => {
    const { db, contactId } = await ownerContext(context.userId);
    const title = String(data.title ?? "").trim();
    if (!title) throw new Error("اكتب اسم المرفق.");
    if (!DOC_EXT.test(data.fileName)) throw new Error("نوع الملف غير مسموح.");
    await assertOwned(db, contactId, data);

    const base64 = data.dataBase64.includes(",") ? data.dataBase64.slice(data.dataBase64.indexOf(",") + 1) : data.dataBase64;
    const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
    if (bytes.byteLength > 25 * 1024 * 1024) throw new Error("حجم الملف يتجاوز 25 ميجابايت.");

    const ext = (data.fileName.split(".").pop() ?? "bin").toLowerCase();
    const path = `${contactId}/${crypto.randomUUID()}.${ext}`;
    const { mimeFor } = await import("./storage.server");
    const up = await db.storage.from("owner-documents").upload(path, bytes, { contentType: mimeFor(data.fileName) });
    if (up.error) throw new Error(up.error.message);

    const ins = await db
      .from("unit_documents")
      .insert({
        owner_id: contactId,
        title,
        doc_type: data.docType || "other",
        storage_path: path,
        mime_type: mimeFor(data.fileName),
        unit_id: data.unitId ?? null,
        property_id: data.propertyId ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (ins.error) throw new Error(ins.error.message);
    return { ok: true as const, id: ins.data.id };
  });

export const deleteOwnerDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { db, contactId } = await ownerContext(context.userId);
    const doc = await db.from("unit_documents").select("id, storage_path").eq("id", data.id).eq("owner_id", contactId).maybeSingle();
    if (!doc.data) throw new Error("المرفق غير موجود.");
    await db.storage.from("owner-documents").remove([doc.data.storage_path]);
    await db.from("unit_documents").delete().eq("id", doc.data.id);
    return { ok: true as const };
  });

/** تفويض شخص بصلاحية عرض أو تسجيل سداد. */
export const addOwnerDelegate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fullName: string; phone: string; nationalId?: string; accessLevel: "view" | "collect" }) => input)
  .handler(async ({ data, context }) => {
    const { db, contactId } = await ownerContext(context.userId);
    const fullName = String(data.fullName ?? "").trim();
    const phone = localPhone(data.phone);
    const nationalId = clientUsername(data.nationalId);
    if (fullName.length < 3) throw new Error("اكتب اسم المفوَّض.");
    if (phone.length < 10) throw new Error("أدخل رقم جوال صحيح.");

    let delegateId: string | null = null;
    if (nationalId) {
      const found = await db.from("contacts").select("id").eq("national_id", nationalId).maybeSingle();
      delegateId = found.data?.id ?? null;
    }
    if (!delegateId) {
      const found = await db.from("contacts").select("id").eq("phone", phone).maybeSingle();
      delegateId = found.data?.id ?? null;
    }
    if (!delegateId) {
      const created = await db
        .from("contacts")
        .insert({ full_name: fullName, phone, national_id: nationalId || null, kind: "individual", roles: ["delegate"] })
        .select("id")
        .single();
      if (created.error) throw new Error(created.error.message);
      delegateId = created.data.id;
    }

    const up = await db
      .from("owner_delegates")
      .upsert(
        { owner_id: contactId, delegate_contact_id: delegateId, access_level: data.accessLevel, is_active: true },
        { onConflict: "owner_id,delegate_contact_id" },
      );
    if (up.error) throw new Error(up.error.message);
    return { ok: true as const };
  });

export const removeOwnerDelegate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { db, contactId } = await ownerContext(context.userId);
    const del = await db.from("owner_delegates").delete().eq("id", data.id).eq("owner_id", contactId);
    if (del.error) throw new Error(del.error.message);
    return { ok: true as const };
  });
