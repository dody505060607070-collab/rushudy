import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ============================================================
 * بوابة المالك الموسّعة: تحليلات مالية وتشغيلية، تحويلات،
 * اعتمادات، رسائل، إشعارات، مستندات وتوقيع، تفضيلات ومشاركة.
 * ========================================================== */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Db = Awaited<ReturnType<typeof admin>>;

async function ownerContext(userId: string) {
  const db = await admin();
  const account = await db.from("client_accounts").select("contact_id").eq("user_id", userId).maybeSingle();
  if (!account.data) throw new Error("لا توجد بوابة عميل مرتبطة بهذا الحساب.");
  const contactId = account.data.contact_id;
  const contact = await db.from("contacts").select("id, full_name, phone, email, roles").eq("id", contactId).single();
  if (!(contact.data?.roles ?? []).includes("owner")) throw new Error("هذه الخدمة متاحة للملاك فقط.");
  return { db, contactId, contact: contact.data };
}

/** نسخة لا ترمي خطأ: تُرجع null لغير الملاك (مستأجرين مثلًا). */
async function ownerContextOrNull(userId: string) {
  try {
    return await ownerContext(userId);
  } catch {
    return null;
  }
}

const n = (v: unknown) => Number(v ?? 0) || 0;
const monthKey = (iso: string) => iso.slice(0, 7);
const todayISO = () => new Date().toISOString().slice(0, 10);

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** كل بيانات المالك التحليلية في نداء واحد. */
async function buildOwnerReport(db: Db, contactId: string) {
  const today = todayISO();

  const [contactRow, units, properties, buildings, contracts, expenses, documents, visits, conditions, maintenance] =
    await Promise.all([
      db.from("contacts").select("id, full_name, phone, email").eq("id", contactId).single(),
      db.from("units").select("id, building_id, unit_number, unit_type, status, floor, area").eq("owner_id", contactId),
      db
        .from("properties")
        .select("id, code, name, purpose, status, city, district, price_value, latitude, longitude")
        .eq("owner_id", contactId),
      db.from("buildings").select("id, name, city, district, address").eq("owner_id", contactId),
      db
        .from("contracts")
        .select(
          "id, contract_number, status, start_date, end_date, annual_rent, total_value, created_at, tenant:tenant_id(full_name, phone), property:property_id(id, name, latitude, longitude), unit:unit_id(id, unit_number, unit_type)",
        )
        .eq("owner_id", contactId),
      db.from("unit_expenses").select("id, category, description, amount, spent_on, unit_id, property_id").eq("owner_id", contactId),
      db.from("unit_documents").select("id, title, doc_type, storage_path, mime_type, expires_at, created_at").eq("owner_id", contactId),
      db.from("unit_visits").select("*").eq("owner_id", contactId).order("visit_date", { ascending: false }).limit(200),
      db.from("unit_condition_reports").select("*").eq("owner_id", contactId).order("reported_on", { ascending: false }).limit(100),
      db
        .from("maintenance_requests")
        .select("id, category, priority, status, description, cost, rating, created_at, property_id")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

  const contractRows = (contracts.data ?? []) as unknown as {
    id: string;
    contract_number: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    annual_rent: number | null;
    total_value: number | null;
    created_at: string;
    tenant: { full_name: string; phone: string | null } | null;
    property: { id: string; name: string; latitude: number | null; longitude: number | null } | null;
    unit: { id: string; unit_number: string | null; unit_type: string | null } | null;
  }[];

  const ids = contractRows.map((c) => c.id);
  const payments = ids.length
    ? await db
        .from("contract_payments")
        .select("id, contract_id, payment_number, due_date, amount_due, amount_paid, status, updated_at")
        .in("contract_id", ids)
        .order("due_date")
    : { data: [] as never[] };

  const paymentRows = (payments.data ?? []) as {
    id: string;
    contract_id: string;
    payment_number: number;
    due_date: string;
    amount_due: number;
    amount_paid: number;
    status: string;
    updated_at: string;
  }[];

  const expenseRows = (expenses.data ?? []) as { id: string; category: string; description: string | null; amount: number; spent_on: string; unit_id: string | null; property_id: string | null }[];
  const propertyIds = new Set((properties.data ?? []).map((p) => p.id));
  const ownerMaintenance = (maintenance.data ?? []).filter((m) => m.property_id && propertyIds.has(m.property_id));

  /* ---------- مالي ---------- */
  const collected = paymentRows.reduce((s, p) => s + n(p.amount_paid), 0);
  const due = paymentRows.reduce((s, p) => s + n(p.amount_due), 0);
  const outstanding = paymentRows.reduce((s, p) => s + Math.max(0, n(p.amount_due) - n(p.amount_paid)), 0);
  const arrears = paymentRows
    .filter((p) => p.status !== "paid" && p.due_date < today)
    .reduce((s, p) => s + Math.max(0, n(p.amount_due) - n(p.amount_paid)), 0);
  const totalExpenses = expenseRows.reduce((s, e) => s + n(e.amount), 0);
  const commissionRate = 0.05;
  const officeCommission = collected * commissionRate;
  const netIncome = collected - totalExpenses - officeCommission;

  /* ---------- شهريًا (٢٤ شهرًا) ---------- */
  const months: { key: string; label: string; collected: number; expenses: number; net: number }[] = [];
  const base = new Date();
  for (let i = 23; i >= 0; i -= 1) {
    const d = addMonths(base, -i);
    const key = d.toISOString().slice(0, 7);
    months.push({
      key,
      label: d.toLocaleDateString("ar-SA-u-ca-gregory", { month: "short", year: "numeric" }),
      collected: 0,
      expenses: 0,
      net: 0,
    });
  }
  const monthIndex = new Map(months.map((m, i) => [m.key, i] as const));
  for (const p of paymentRows) {
    if (n(p.amount_paid) <= 0) continue;
    const idx = monthIndex.get(monthKey(p.updated_at ?? p.due_date));
    if (idx != null) months[idx]!.collected += n(p.amount_paid);
  }
  for (const e of expenseRows) {
    const idx = monthIndex.get(monthKey(e.spent_on));
    if (idx != null) months[idx]!.expenses += n(e.amount);
  }
  for (const m of months) m.net = m.collected - m.expenses - m.collected * commissionRate;

  /* ---------- توقّع ١٢ شهرًا ---------- */
  const forecast: { key: string; label: string; expected: number }[] = [];
  for (let i = 0; i < 12; i += 1) {
    const d = addMonths(base, i);
    forecast.push({
      key: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString("ar-SA-u-ca-gregory", { month: "short", year: "numeric" }),
      expected: 0,
    });
  }
  const forecastIndex = new Map(forecast.map((m, i) => [m.key, i] as const));
  for (const p of paymentRows) {
    if (p.status === "paid") continue;
    const idx = forecastIndex.get(monthKey(p.due_date));
    if (idx != null) forecast[idx]!.expected += Math.max(0, n(p.amount_due) - n(p.amount_paid));
  }

  /* ---------- إشغال ---------- */
  const unitRows = (units.data ?? []) as { id: string; unit_number: string; unit_type: string | null; status: string; floor: string | null; area: number | null; building_id: string | null }[];
  const activeContracts = contractRows.filter((c) => ["active", "approved"].includes(c.status));
  const occupiedUnitIds = new Set(activeContracts.map((c) => c.unit?.id).filter(Boolean) as string[]);
  const occupancyRate = unitRows.length ? (occupiedUnitIds.size / unitRows.length) * 100 : 0;
  const vacantUnits = unitRows.filter((u) => !occupiedUnitIds.has(u.id));

  /* ---------- عائد لكل عقار ---------- */
  const propertyRows = (properties.data ?? []) as { id: string; code: string; name: string; purpose: string; status: string; city: string | null; district: string | null; price_value: number | null; latitude: number | null; longitude: number | null }[];
  const roi = propertyRows.map((p) => {
    const rent = contractRows
      .filter((c) => c.property?.id === p.id && ["active", "approved"].includes(c.status))
      .reduce((s, c) => s + n(c.annual_rent), 0);
    const cost = expenseRows.filter((e) => e.property_id === p.id).reduce((s, e) => s + n(e.amount), 0);
    const value = n(p.price_value);
    return {
      id: p.id,
      name: p.name,
      code: p.code,
      city: p.city,
      district: p.district,
      value,
      annualRent: rent,
      expenses: cost,
      netAnnual: rent - cost,
      capRate: value > 0 ? ((rent - cost) / value) * 100 : 0,
      latitude: p.latitude,
      longitude: p.longitude,
      status: p.status,
    };
  });

  /* ---------- تجديدات ---------- */
  const renewals = contractRows
    .filter((c) => c.end_date && !["cancelled", "closed"].includes(c.status))
    .map((c) => ({
      ...c,
      daysLeft: Math.round((new Date(c.end_date!).getTime() - new Date(today).getTime()) / 86400000),
    }))
    .filter((c) => c.daysLeft <= 90)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  /* ---------- مستندات قاربت على الانتهاء ---------- */
  const docs = (documents.data ?? []) as { id: string; title: string; doc_type: string; storage_path: string; mime_type: string | null; expires_at: string | null; created_at: string }[];
  const expiringDocs = docs
    .filter((d) => d.expires_at)
    .map((d) => ({ ...d, daysLeft: Math.round((new Date(d.expires_at!).getTime() - new Date(today).getTime()) / 86400000) }))
    .filter((d) => d.daysLeft <= 120)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  /* ---------- ضريبي / زكوي مبسّط ---------- */
  const year = today.slice(0, 4);
  const yearCollected = paymentRows
    .filter((p) => (p.updated_at ?? p.due_date).slice(0, 4) === year && n(p.amount_paid) > 0)
    .reduce((s, p) => s + n(p.amount_paid), 0);
  const yearExpenses = expenseRows.filter((e) => e.spent_on.slice(0, 4) === year).reduce((s, e) => s + n(e.amount), 0);
  const taxReport = {
    year,
    collected: yearCollected,
    expenses: yearExpenses,
    commission: yearCollected * commissionRate,
    net: yearCollected - yearExpenses - yearCollected * commissionRate,
    zakatEstimate: Math.max(0, (yearCollected - yearExpenses - yearCollected * commissionRate) * 0.025),
  };

  return {
    contact: contactRow.data,
    generatedAt: new Date().toISOString(),
    summary: {
      collected,
      due,
      outstanding,
      arrears,
      expenses: totalExpenses,
      officeCommission,
      netIncome,
      commissionRate,
      unitsCount: unitRows.length,
      occupiedUnits: occupiedUnitIds.size,
      vacantUnits: vacantUnits.length,
      occupancyRate,
      propertiesCount: propertyRows.length,
      buildingsCount: (buildings.data ?? []).length,
      activeContracts: activeContracts.length,
      portfolioValue: propertyRows.reduce((s, p) => s + n(p.price_value), 0),
      annualRentRoll: activeContracts.reduce((s, c) => s + n(c.annual_rent), 0),
    },
    months,
    forecast,
    roi,
    renewals,
    payments: paymentRows,
    contracts: contractRows,
    units: unitRows,
    properties: propertyRows,
    buildings: buildings.data ?? [],
    expenses: expenseRows,
    documents: docs,
    expiringDocs,
    visits: visits.data ?? [],
    conditionReports: conditions.data ?? [],
    maintenance: ownerMaintenance,
    taxReport,
  };
}

/** التحليلات الكاملة لبوابة المالك. */
export const getOwnerInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, contactId } = await ownerContext(context.userId);
    return buildOwnerReport(db, contactId);
  });

/** مساحة عمل المالك: التحويلات، الاعتمادات، الرسائل، الإشعارات، التفضيلات، الروابط، سجل الدخول. */
export const getOwnerWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, contactId } = await ownerContext(context.userId);
    const [payouts, approvals, messages, notifications, prefs, links, logins, signatures, delegates, documents] =
      await Promise.all([
        db.from("owner_payout_requests").select("*").eq("owner_id", contactId).order("created_at", { ascending: false }).limit(100),
        db.from("owner_approvals").select("*").eq("owner_id", contactId).order("created_at", { ascending: false }).limit(100),
        db.from("owner_messages").select("*").eq("owner_id", contactId).order("created_at", { ascending: true }).limit(200),
        db.from("owner_notifications").select("*").eq("owner_id", contactId).order("created_at", { ascending: false }).limit(60),
        db.from("owner_preferences").select("*").eq("owner_id", contactId).maybeSingle(),
        db.from("owner_share_links").select("*").eq("owner_id", contactId).order("created_at", { ascending: false }).limit(30),
        db.from("owner_login_events").select("*").eq("owner_id", contactId).order("created_at", { ascending: false }).limit(20),
        db.from("owner_signatures").select("*").eq("owner_id", contactId).order("created_at", { ascending: false }).limit(50),
        db
          .from("owner_delegates")
          .select("id, access_level, is_active, created_at, delegate:delegate_contact_id(id, full_name, phone, national_id)")
          .eq("owner_id", contactId)
          .order("created_at", { ascending: false }),
        db.from("unit_documents").select("id, title, doc_type, storage_path, expires_at, created_at").eq("owner_id", contactId).order("created_at", { ascending: false }).limit(200),
      ]);

    const docs = await Promise.all(
      (documents.data ?? []).map(async (d) => {
        const signed = await db.storage.from("owner-documents").createSignedUrl(d.storage_path, 3600);
        return { ...d, url: signed.data?.signedUrl ?? null };
      }),
    );

    return {
      payouts: payouts.data ?? [],
      approvals: approvals.data ?? [],
      messages: messages.data ?? [],
      notifications: notifications.data ?? [],
      preferences:
        prefs.data ?? {
          owner_id: contactId,
          language: "ar",
          currency: "SAR",
          report_frequency: "monthly",
          expense_approval_limit: 1000,
          notify_whatsapp: true,
          notify_email: false,
          updated_at: new Date().toISOString(),
        },
      shareLinks: links.data ?? [],
      loginEvents: logins.data ?? [],
      signatures: signatures.data ?? [],
      delegates: (delegates.data ?? []) as unknown as {
        id: string;
        access_level: string;
        is_active: boolean;
        created_at: string;
        delegate: { id: string; full_name: string; phone: string | null; national_id: string | null } | null;
      }[],
      documents: docs,
    };
  });

/** طلب تحويل مستحقات. */
export const requestOwnerPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount: number; method?: string; ibanLast4?: string; note?: string }) => input)
  .handler(async ({ data, context }) => {
    const { db, contactId, contact } = await ownerContext(context.userId);
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("أدخل مبلغًا صحيحًا.");
    const ins = await db
      .from("owner_payout_requests")
      .insert({
        owner_id: contactId,
        amount,
        method: data.method || "bank",
        iban_last4: String(data.ibanLast4 ?? "").slice(-4) || null,
        note: String(data.note ?? "").trim() || null,
      })
      .select("id")
      .single();
    if (ins.error) throw new Error(ins.error.message);

    const staff = await db.from("user_roles").select("user_id").in("role", ["super_admin", "employee"]);
    const targets = [...new Set((staff.data ?? []).map((r) => r.user_id))];
    if (targets.length) {
      await db.from("notifications").insert(
        targets.map((user_id) => ({
          user_id,
          title: "طلب تحويل مستحقات",
          body: `${contact?.full_name ?? "مالك"} طلب تحويل ${amount.toLocaleString("en-US")} ر.س`,
          link: "/owners",
        })),
      );
    }
    return { ok: true as const, id: ins.data.id };
  });

/** قرار المالك على اعتماد (مصروف/مستأجر/تجديد). */
export const decideOwnerApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; decision: "approved" | "rejected"; note?: string }) => input)
  .handler(async ({ data, context }) => {
    const { db, contactId } = await ownerContext(context.userId);
    const upd = await db
      .from("owner_approvals")
      .update({
        status: data.decision,
        decision_note: String(data.note ?? "").trim() || null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("owner_id", contactId);
    if (upd.error) throw new Error(upd.error.message);
    return { ok: true as const };
  });

/** رسالة من المالك إلى المكتب (بدون أي إرسال واتساب تلقائي). */
export const sendOwnerMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { body: string }) => input)
  .handler(async ({ data, context }) => {
    const { db, contactId, contact } = await ownerContext(context.userId);
    const body = String(data.body ?? "").trim();
    if (body.length < 2) throw new Error("اكتب رسالتك أولًا.");
    const ins = await db.from("owner_messages").insert({ owner_id: contactId, sender: "owner", body, created_by: context.userId });
    if (ins.error) throw new Error(ins.error.message);

    const staff = await db.from("user_roles").select("user_id").in("role", ["super_admin", "employee"]);
    const targets = [...new Set((staff.data ?? []).map((r) => r.user_id))];
    if (targets.length) {
      await db.from("notifications").insert(
        targets.map((user_id) => ({
          user_id,
          title: "رسالة جديدة من مالك",
          body: `${contact?.full_name ?? "مالك"}: ${body.slice(0, 120)}`,
          link: "/owners",
        })),
      );
    }
    return { ok: true as const };
  });

export const markOwnerNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id?: string }) => input)
  .handler(async ({ data, context }) => {
    const { db, contactId } = await ownerContext(context.userId);
    let q = db.from("owner_notifications").update({ is_read: true }).eq("owner_id", contactId);
    if (data.id) q = q.eq("id", data.id);
    const upd = await q;
    if (upd.error) throw new Error(upd.error.message);
    return { ok: true as const };
  });

export const saveOwnerPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      language?: string;
      currency?: string;
      reportFrequency?: string;
      expenseApprovalLimit?: number;
      notifyWhatsapp?: boolean;
      notifyEmail?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { db, contactId } = await ownerContext(context.userId);
    const up = await db.from("owner_preferences").upsert(
      {
        owner_id: contactId,
        language: data.language ?? "ar",
        currency: data.currency ?? "SAR",
        report_frequency: data.reportFrequency ?? "monthly",
        expense_approval_limit: Math.max(0, Number(data.expenseApprovalLimit ?? 1000)),
        notify_whatsapp: data.notifyWhatsapp ?? true,
        notify_email: data.notifyEmail ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_id" },
    );
    if (up.error) throw new Error(up.error.message);
    return { ok: true as const };
  });

/** رابط مؤقت لمشاركة تقرير الأداء مع المحاسب أو الشريك. */
export const createOwnerShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { label?: string; days?: number }) => input)
  .handler(async ({ data, context }) => {
    const { db, contactId } = await ownerContext(context.userId);
    const days = Math.min(90, Math.max(1, Number(data.days ?? 7)));
    const token = crypto.randomUUID().replace(/-/g, "");
    const ins = await db
      .from("owner_share_links")
      .insert({
        owner_id: contactId,
        token,
        label: String(data.label ?? "").trim() || null,
        expires_at: new Date(Date.now() + days * 86400000).toISOString(),
      })
      .select("token")
      .single();
    if (ins.error) throw new Error(ins.error.message);
    return { ok: true as const, token: ins.data.token };
  });

export const revokeOwnerShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { db, contactId } = await ownerContext(context.userId);
    const upd = await db.from("owner_share_links").update({ revoked: true }).eq("id", data.id).eq("owner_id", contactId);
    if (upd.error) throw new Error(upd.error.message);
    return { ok: true as const };
  });

/** تقرير مشترك عبر رابط مؤقت (بدون تسجيل دخول، بيانات مختصرة فقط). */
export const getSharedOwnerReport = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const db = await admin();
    const link = await db.from("owner_share_links").select("*").eq("token", data.token).maybeSingle();
    if (!link.data || link.data.revoked) throw new Error("الرابط غير صالح.");
    if (new Date(link.data.expires_at).getTime() < Date.now()) throw new Error("انتهت صلاحية الرابط.");
    await db.from("owner_share_links").update({ views: Number(link.data.views ?? 0) + 1 }).eq("id", link.data.id);

    const report = await buildOwnerReport(db, link.data.owner_id);
    return {
      ownerName: report.contact?.full_name ?? "مالك",
      label: link.data.label,
      expiresAt: link.data.expires_at,
      summary: report.summary,
      months: report.months,
      roi: report.roi.map((r) => ({ name: r.name, annualRent: r.annualRent, expenses: r.expenses, capRate: r.capRate })),
      taxReport: report.taxReport,
    };
  });

/** إصدار رمز تحقق لتوقيع مستند إلكترونيًا. */
export const requestOwnerSignatureOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { docTitle: string; documentId?: string | null; contractId?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { db, contactId, contact } = await ownerContext(context.userId);
    const title = String(data.docTitle ?? "").trim();
    if (!title) throw new Error("حدد المستند المطلوب توقيعه.");
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const ins = await db
      .from("owner_signatures")
      .insert({
        owner_id: contactId,
        doc_title: title,
        document_id: data.documentId ?? null,
        contract_id: data.contractId ?? null,
        signer_name: contact?.full_name ?? "المالك",
        otp_code: code,
        otp_expires_at: new Date(Date.now() + 10 * 60000).toISOString(),
      })
      .select("id")
      .single();
    if (ins.error) throw new Error(ins.error.message);
    return { ok: true as const, id: ins.data.id, code };
  });

export const signOwnerDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; code: string; signatureText: string }) => input)
  .handler(async ({ data, context }) => {
    const { db, contactId } = await ownerContext(context.userId);
    const row = await db.from("owner_signatures").select("*").eq("id", data.id).eq("owner_id", contactId).maybeSingle();
    if (!row.data) throw new Error("طلب التوقيع غير موجود.");
    if (row.data.status === "signed") throw new Error("تم التوقيع مسبقًا.");
    if (!row.data.otp_expires_at || new Date(row.data.otp_expires_at).getTime() < Date.now())
      throw new Error("انتهت صلاحية رمز التحقق، أصدر رمزًا جديدًا.");
    if (String(data.code).trim() !== row.data.otp_code) throw new Error("رمز التحقق غير صحيح.");
    const signature = String(data.signatureText ?? "").trim();
    if (signature.length < 3) throw new Error("اكتب اسمك كتوقيع.");

    const upd = await db
      .from("owner_signatures")
      .update({ status: "signed", signed_at: new Date().toISOString(), signature_text: signature, otp_code: null })
      .eq("id", data.id);
    if (upd.error) throw new Error(upd.error.message);
    return { ok: true as const };
  });

/** تحديث تاريخ انتهاء صلاحية مستند (صك/رخصة). */
export const setOwnerDocumentExpiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; expiresAt: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { db, contactId } = await ownerContext(context.userId);
    const upd = await db
      .from("unit_documents")
      .update({ expires_at: data.expiresAt || null })
      .eq("id", data.id)
      .eq("owner_id", contactId);
    if (upd.error) throw new Error(upd.error.message);
    return { ok: true as const };
  });

/** تسجيل دخول المالك للبوابة (سجل أمني). */
export const recordOwnerLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userAgent?: string; path?: string }) => input)
  .handler(async ({ data, context }) => {
    const { db, contactId } = await ownerContext(context.userId);
    const recent = await db
      .from("owner_login_events")
      .select("id, created_at")
      .eq("owner_id", contactId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent.data && Date.now() - new Date(recent.data.created_at).getTime() < 30 * 60000) {
      return { ok: true as const, skipped: true };
    }
    await db.from("owner_login_events").insert({
      owner_id: contactId,
      user_agent: String(data.userAgent ?? "").slice(0, 300) || null,
      path: String(data.path ?? "").slice(0, 200) || null,
    });
    return { ok: true as const, skipped: false };
  });
