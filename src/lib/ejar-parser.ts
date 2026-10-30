// استخراج حتمي (بدون ذكاء اصطناعي) لبيانات عقود "إيجار" الرسمية من نص PDF.
// نص pdf.js للعربية يخرج بحروف منفصلة ومعكوسة، لذا نصحّحه أولًا.

const AR = "\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF";

function fixArabicSegment(seg: string): string {
  const words = seg.split(/ {2,}/).filter((w) => w.trim());
  const fixed = words.map((w) => w.split(/ +/).filter(Boolean).reverse().join(""));
  return fixed.reverse().join(" ");
}

/** يصحّح ترتيب الحروف والكلمات العربية القادمة من pdf.js. */
export function normalizeArabicPdfText(raw: string): string {
  if (!raw) return "";
  const t = raw.normalize("NFKC");
  const re = new RegExp(`[${AR}][${AR} \\t\u064B-\u0652]*`, "g");
  return t
    .split("\n")
    .map((line) =>
      line.replace(re, (s) => {
        const lead = /^\s*/.exec(s)![0];
        const trail = /\s*$/.exec(s)![0];
        return lead + fixArabicSegment(s.trim()) + trail;
      }),
    )
    .join("\n");
}

/** هل النص يبدو مشوّهًا (حروف عربية منفصلة)؟ */
export function looksScrambled(raw: string): boolean {
  const singles = raw.match(new RegExp(`(?:[${AR}] ){4,}`, "g"))?.length ?? 0;
  return singles > 5;
}

const LABELS = [
  "Contract Data",
  "Contract Type",
  "Contract No.",
  "Contract Sealing Location",
  "Contract Sealing Date",
  "Tenancy Start Date",
  "Tenancy End Date",
  "Lessor Data",
  "Lessor Representative Data",
  "Tenant Data",
  "Tenant Representative Data",
  "Brokerage Entity and Broker Data",
  "Property Data",
  "Rental Units Data",
  "Financial Data",
  "Rent Payments Schedule",
  "Name",
  "Company name/Founder",
  "Organization Type",
  "Unified Number",
  "CR No.",
  "ID No.",
  "ID Type",
  "Email",
  "Mobile No.",
  "National Address",
  "Brokerage Entity Name",
  "Broker Name",
  "Property Usage",
  "Property Type",
  "Number of Units",
  "Unit Type",
  "Unit No.",
  "Floor No.",
  "Unit Area",
  "Annual Rent:",
  "Annual Rent",
  "Last Rent Payment:",

  "Total Contract value",
  "VAT on rental value:",
  "Security Deposit (Not included in total contract amount):",
  "Number of Rent Payments:",
  "Rent payment cycle",
] as const;

type Sec =
  | "contract"
  | "lessor"
  | "lessorRep"
  | "tenant"
  | "tenantRep"
  | "broker"
  | "property"
  | "units"
  | "financial"
  | "schedule"
  | "other";

const SECTION_OF: Record<string, Sec> = {
  "Contract Data": "contract",
  "Lessor Data": "lessor",
  "Lessor Representative Data": "lessorRep",
  "Tenant Data": "tenant",
  "Tenant Representative Data": "tenantRep",
  "Brokerage Entity and Broker Data": "broker",
  "Property Data": "property",
  "Rental Units Data": "units",
  "Financial Data": "financial",
  "Rent Payments Schedule": "schedule",
};

const cleanValue = (v: string) => {
  let s = v.trim();
  const colon = s.indexOf(":");
  if (colon >= 0 && new RegExp(`[${AR}]`).test(s.slice(colon))) s = s.slice(0, colon);
  s = s.replace(/\s+/g, " ").trim();
  // بقايا حرف واحد من التسمية العربية في بداية القيمة (مثل "ة محل")
  s = s.replace(new RegExp(`^[${AR}] (?=[${AR}])`), "");
  s = s.replace(/^[،,]\s*/, "").trim();
  if (s === "-" || s === "—") return "";
  return s;
};

const num = (v: string | undefined) => {
  if (!v) return 0;
  const n = Number(v.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const cycleLabel = (raw: string) => {
  const s = raw.replace(/\s/g, "");
  if (/نصفسنو/.test(s)) return "نصف سنوي";
  if (/ربعسنو/.test(s)) return "ربع سنوي";
  if (/شهر/.test(s)) return "شهري";
  if (/سنو/.test(s)) return "سنوي";
  return raw;
};


export type EjarUnit = { unit_number: string; unit_type: string; floor: string; area: number };
export type EjarPayment = {
  no: number;
  rent: number;
  vat: number;
  services: number;
  total: number;
  issue_date: string;
  due_date: string;
  /** نهاية مهلة السداد — دائمًا بعد تاريخ الاستحقاق أو مساويًا له */
  deadline_date?: string;
};

export type EjarParsed = {
  contract_number: string;
  contract_type: "rent";
  signed_date: string;
  start_date: string;
  end_date: string;
  city: string;
  district: string;
  owner_name: string;
  owner_national_id: string;
  owner_phone: string;
  owner_email: string;
  tenant_is_company: boolean;
  tenant_name: string;
  tenant_national_id: string;
  tenant_phone: string;
  tenant_email: string;
  tenant_cr_number: string;
  tenant_rep_name: string;
  tenant_rep_national_id: string;
  tenant_rep_phone: string;
  owner_rep_name?: string;
  owner_rep_national_id?: string;
  owner_rep_phone?: string;
  broker_entity_name: string;
  broker_name: string;
  broker_phone: string;
  property_usage: string;
  property_type: string;
  property_name: string;
  unit_number: string;
  units: EjarUnit[];
  annual_rent: number;
  total_value: number;
  vat: number;
  deposit: number;
  payment_cycle: string;
  payments_count: number;
  payments: EjarPayment[];
};

/**
 * يحلّل نص عقد إيجار رسمي اعتمادًا على التسميات الإنجليزية الثابتة في النموذج.
 * يعيد null إذا لم يكن النموذج معروفًا.
 */
export function parseEjarContract(rawText: string): EjarParsed | null {
  if (!rawText) return null;
  const text = looksScrambled(rawText) ? normalizeArabicPdfText(rawText) : rawText.normalize("NFKC");
  if (!/Contract No\./.test(text) || !/Lessor Data/.test(text)) return null;

  const parts = text.replace(/\n/g, "  ").split(/ {2,}/).map((p) => p.trim()).filter(Boolean);

  let section: Sec = "other";
  const get: Partial<Record<Sec, Record<string, string>>> = {};
  const unitBuckets: Record<string, string>[] = [];
  let currentUnit: Record<string, string> | null = null;

  const put = (key: string, value: string) => {
    if (section === "units") {
      if (!currentUnit || (key === "Unit No." && currentUnit["Unit No."])) {
        currentUnit = {};
        unitBuckets.push(currentUnit);
      }
      if (currentUnit[key] === undefined) currentUnit[key] = value;
      return;
    }
    const bucket = (get[section] ??= {});
    if (bucket[key] === undefined) bucket[key] = value;
  };

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    const sectionLabel = Object.keys(SECTION_OF)
      .sort((a, b) => b.length - a.length)
      .find((label) => p === label || p.endsWith(label));
    const sec = sectionLabel ? SECTION_OF[sectionLabel] : undefined;
    if (sec) {
      section = sec;
      if (sec === "units") currentUnit = null;
      continue;
    }
    const label = (LABELS as readonly string[]).includes(p)
      ? p
      : (LABELS as readonly string[]).find((l) => l.length > 6 && p.endsWith(l));
    if (label) {
      const value = cleanValue(parts[i + 1] ?? "");
      if (value && !(LABELS as readonly string[]).includes(value)) put(label, value);
    }
  }

  const g = (sec: Sec, key: string) => get[sec]?.[key] ?? "";
  const anySec = (key: string) => {
    for (const bucket of Object.values(get)) {
      const v = bucket?.[key];
      if (v) return v;
    }
    return "";
  };
  const contract = (k: string) => g("contract", k);


  // جدول الدفعات: صفوف بترتيب معكوس (RTL) — نموذجان مختلفان للتخطيط
  const payments: EjarPayment[] = [];
  const rowRe =
    /(\d{4}-\d{2}-\d{2})\s{2,}(\d{4}-\d{2}-\d{2})\s{2,}([\d.,]+)\s{2,}([\d.,]+)\s{2,}([\d.,]+)\s{2,}([\d.,]+)\s{2,}(\d{1,3})(?!\d)/g;
  for (const m of text.matchAll(rowRe)) {
    const dueAd = m[1]!;
    const issueAd = m[2]!;
    if (Number(dueAd.slice(0, 4)) < 1900) continue;
    payments.push({
      no: Number(m[7]),
      total: num(m[3]),
      services: num(m[4]),
      vat: num(m[5]),
      rent: num(m[6]),
      due_date: dueAd,
      issue_date: issueAd,
    });
  }
  if (!payments.length) {
    const simpleRe =
      /([\d.,]+\.\d{2})\s{2,}\d{4}-\d{2}-\d{2}\s{2,}\d{4}-\d{2}-\d{2}\s{2,}[^\s]+\s{2,}(\d{4}-\d{2}-\d{2})\s{2,}(\d{4}-\d{2}-\d{2})\s{2,}(\d{1,3})(?!\d)/g;
    for (const m of text.matchAll(simpleRe)) {
      // عمودان ميلاديان: «تاريخ الاستحقاق» و«نهاية مهلة السداد». ترتيبهما في النص يختلف
      // حسب اتجاه القراءة، فالأقدم دائمًا هو الاستحقاق والأحدث هو نهاية المهلة.
      const [dueAd, deadlineAd] = [m[2]!, m[3]!].sort();
      if (Number(dueAd!.slice(0, 4)) < 1900) continue;
      payments.push({
        no: Number(m[4]),
        total: num(m[1]),
        services: 0,
        vat: 0,
        rent: num(m[1]),
        due_date: dueAd!,
        issue_date: dueAd!,
        deadline_date: deadlineAd!,
      });
    }
  }

  payments.sort((a, b) => a.no - b.no);

  const units: EjarUnit[] = unitBuckets
    .map((u) => ({
      unit_number: u["Unit No."] ?? "",
      unit_type: u["Unit Type"] ?? "",
      floor: u["Floor No."] ?? "",
      area: num(u["Unit Area"]),
    }))
    .filter((u) => u.unit_number || u.unit_type);

  const nationalAddress = g("property", "National Address") || g("lessor", "National Address");
  const district = nationalAddress
    .split(/[,،]/)
    .map((s) => s.replace(/[،,]/g, "").replace(/\d+/g, "").trim())
    .filter(Boolean)
    .slice(-1)[0] ?? "";


  const ownerCompanyName = g("lessor", "Company name/Founder");
  const companyName = g("tenant", "Company name/Founder");
  const isCompany = Boolean(companyName || g("tenant", "CR No."));
  const propertyType = g("property", "Property Type");
  const usage = g("property", "Property Usage");

  const contractNumber = (contract("Contract No.") || "").split("/")[0]!.trim();

  return {
    contract_number: contractNumber,
    contract_type: "rent",
    signed_date: contract("Contract Sealing Date"),
    start_date: contract("Tenancy Start Date"),
    end_date: contract("Tenancy End Date"),
    city: contract("Contract Sealing Location"),
    district,
    owner_name: ownerCompanyName || g("lessor", "Name") || g("lessorRep", "Name"),
    owner_national_id: g("lessor", "CR No.") || g("lessor", "Unified Number") || g("lessor", "ID No.") || g("lessorRep", "ID No."),
    owner_phone: (g("lessor", "Mobile No.") || g("lessorRep", "Mobile No.")).replace(/\s/g, ""),
    owner_email: (g("lessor", "Email") || g("lessorRep", "Email")).replace(/\s/g, ""),
    tenant_is_company: isCompany,
    tenant_name: isCompany ? companyName : g("tenant", "Name"),
    tenant_national_id: isCompany ? "" : g("tenant", "ID No."),
    tenant_phone: (g("tenant", "Mobile No.") || g("tenantRep", "Mobile No.")).replace(/\s/g, ""),
    tenant_email: (g("tenant", "Email") || g("tenantRep", "Email")).replace(/\s/g, ""),
    tenant_cr_number: isCompany ? g("tenant", "CR No.") : "",
    tenant_rep_name: g("tenantRep", "Name"),
    tenant_rep_national_id: g("tenantRep", "ID No."),
    tenant_rep_phone: g("tenantRep", "Mobile No.").replace(/\s/g, ""),
    owner_rep_name: g("lessorRep", "Name"),
    owner_rep_national_id: g("lessorRep", "ID No."),
    owner_rep_phone: g("lessorRep", "Mobile No.").replace(/\s/g, ""),
    broker_entity_name: g("broker", "Brokerage Entity Name"),
    broker_name: g("broker", "Broker Name"),
    broker_phone: g("broker", "Mobile No.").replace(/\s/g, ""),
    property_usage: usage,
    property_type: propertyType,
    property_name: [propertyType || usage, contract("Contract Sealing Location") || district]
      .filter(Boolean)
      .join(" — "),
    unit_number: units.map((u) => u.unit_number).filter(Boolean).join("، "),
    units,
    annual_rent: num(anySec("Annual Rent:") || anySec("Annual Rent")) || num(anySec("Total Contract value")),
    total_value: num(anySec("Total Contract value")),
    vat: num(anySec("VAT on rental value:")),
    deposit: num(anySec("Security Deposit (Not included in total contract amount):")),
    payment_cycle: cycleLabel(anySec("Rent payment cycle")),
    payments_count: Number(anySec("Number of Rent Payments:")) || payments.length,

    payments,
  };
}
