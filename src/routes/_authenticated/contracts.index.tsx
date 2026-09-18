import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, FileText, FileUp, Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { DataTable } from "@/components/kit/DataTable";
import { EmptyState, formatCurrency, formatDate, useTableRows } from "@/components/kit/LiveTable";
import {
  Field,
  GhostButton,
  Modal,
  PrimaryButton,
  inputClass,
  textareaClass,
} from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";
import { StatusLegend } from "@/components/kit/StatusLegend";
import { supabase } from "@/integrations/supabase/client";
import { analyzeContractPdf } from "@/lib/ai.functions";
import { finalizeContractImport } from "@/lib/contracts.functions";
import { deleteContractWithOwner } from "@/lib/delete-helpers";
import { ensureClientAccount } from "@/lib/portal.functions";
import { contractStatusLabels, importStatusLabels } from "@/lib/labels";
import { rowTone, toneRowClass } from "@/lib/status-tone";

type Row = {
  id: string;
  contract_number: string | null;
  contract_type: string;
  start_date: string | null;
  end_date: string | null;
  annual_rent: number | null;
  total_value: number | null;
  deposit: number | null;
  payment_cycle: string | null;
  payments_count: number | null;
  notes: string | null;
  status: string;
  source: string | null;
  owner_id: string | null;
  tenant_id: string | null;
  building_id: string | null;
  property_id: string | null;
  unit_id: string | null;
  owner: { full_name: string } | null;
  tenant: { full_name: string } | null;
  created_at: string;
};

type ImportRow = {
  id: string;
  file_name: string;
  file_size: number | null;
  status: string;
  ocr_used: boolean | null;
  warnings: unknown[] | null;
  error_message: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/contracts/")({
  head: () => ({
    meta: [
      { title: "إدارة العقود | الرشودي للعقارات" },
      {
        name: "description",
        content:
          "عقود الإيجار والبيع، إضافتها يدويًا أو استيرادها من ملف PDF وتحليلها بالذكاء الاصطناعي.",
      },
      { property: "og:title", content: "إدارة العقود | الرشودي للعقارات" },
      { property: "og:description", content: "عقود الإيجار والبيع واستيراد PDF وتحليلها آليًا." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { edit?: string } =>
    typeof search["edit"] === "string" ? { edit: search["edit"] } : {},
  component: ContractsPage,
});

const SELECT =
  "id, contract_number, contract_type, start_date, end_date, annual_rent, total_value, deposit, payment_cycle, payments_count, notes, status, source, owner_id, tenant_id, building_id, property_id, unit_id, created_at, owner:owner_id(full_name), tenant:tenant_id(full_name)";

type FormState = {
  contract_number: string;
  contract_type: string;
  owner_id: string;
  tenant_id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  annual_rent: string;
  total_value: string;
  deposit: string;
  payment_cycle: string;
  payments_count: string;
  status: string;
  notes: string;
};

const emptyForm: FormState = {
  contract_number: "",
  contract_type: "rent",
  owner_id: "",
  tenant_id: "",
  property_id: "",
  start_date: "",
  end_date: "",
  annual_rent: "",
  total_value: "",
  deposit: "",
  payment_cycle: "annual",
  payments_count: "1",
  status: "active",
  notes: "",
};

const cycleLabels: Record<string, string> = {
  annual: "سنوي",
  semi: "نصف سنوي",
  quarterly: "ربع سنوي",
  monthly: "شهري",
};

function ContractsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const queryClient = useQueryClient();

  const { data, isLoading } = useTableRows<Row>({
    table: "contracts",
    select: SELECT,
    orderBy: { column: "created_at" },
    queryKey: ["contracts"],
  });

  const imports = useTableRows<ImportRow>({
    table: "contract_imports",
    select: "id, file_name, file_size, status, ocr_used, warnings, error_message, created_at",
    orderBy: { column: "created_at" },
    queryKey: ["contract_imports"],
  });

  const contacts = useQuery({
    queryKey: ["contacts", "picker"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("contacts")
        .select("id, full_name")
        .order("full_name")
        .limit(500);
      if (error) throw error;
      return rows ?? [];
    },
  });

  const unitProperties = useQuery({
    queryKey: ["contract-unit-properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, code, building_id, unit_id, building:building_id(name)")
        .not("building_id", "is", null)
        .order("name")
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        name: string;
        code: string;
        building_id: string | null;
        unit_id: string | null;
        building: { name: string } | null;
      }[];
    },
  });

  const rows = data ?? [];
  const set = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const openCreate = (prefill?: Partial<FormState>) => {
    setEditing(null);
    setForm({ ...emptyForm, ...prefill });
    setFormOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    setForm({
      contract_number: row.contract_number ?? "",
      contract_type: row.contract_type ?? "rent",
      owner_id: row.owner_id ?? "",
      tenant_id: row.tenant_id ?? "",
      property_id: row.property_id ?? "",
      start_date: row.start_date ?? "",
      end_date: row.end_date ?? "",
      annual_rent: row.annual_rent != null ? String(row.annual_rent) : "",
      total_value: row.total_value != null ? String(row.total_value) : "",
      deposit: row.deposit != null ? String(row.deposit) : "",
      payment_cycle: row.payment_cycle ?? "annual",
      payments_count: row.payments_count != null ? String(row.payments_count) : "1",
      status: row.status ?? "active",
      notes: row.notes ?? "",
    });
    setFormOpen(true);
  };

  const { edit: editId } = Route.useSearch();
  const handledEditId = useRef<string | null>(null);
  useEffect(() => {
    if (!editId || handledEditId.current === editId) return;
    const row = rows.find((r) => r.id === editId);
    if (!row) return;
    handledEditId.current = editId;
    openEdit(row);
    void navigate({ to: "/contracts", search: { edit: undefined }, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, rows]);

  const save = useMutation({
    mutationFn: async (source: "manual" | "pdf_import" = "manual") => {
      const payload = {
        contract_number:
          form.contract_number.trim() || `C-${Date.now().toString(36).toUpperCase()}`,
        contract_type: form.contract_type,
        owner_id: form.owner_id || null,
        tenant_id: form.tenant_id || null,
        property_id: form.property_id || null,
        unit_id:
          unitProperties.data?.find((property) => property.id === form.property_id)?.unit_id ??
          null,
        building_id:
          unitProperties.data?.find((property) => property.id === form.property_id)?.building_id ??
          null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        annual_rent: form.annual_rent ? Number(form.annual_rent) : null,
        total_value: form.total_value ? Number(form.total_value) : null,
        deposit: form.deposit ? Number(form.deposit) : null,
        payment_cycle: form.payment_cycle || null,
        payments_count: form.payments_count ? Number(form.payments_count) : null,
        status: form.status,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("contracts").update(payload).eq("id", editing.id);
        if (error) throw error;
        return null;
      }
      const { error } = await supabase.from("contracts").insert({ ...payload, source });
      if (error) throw error;
      // إنشاء حساب المالك والمستأجر فور إنشاء العقد.
      const contacts = [payload.owner_id, payload.tenant_id].filter(
        (contactId, index, all): contactId is string =>
          Boolean(contactId) && all.indexOf(contactId) === index,
      );
      const results = await Promise.all(
        contacts.map(async (contactId) => {
          try {
            return await ensureClientAccount({ data: { contactId } });
          } catch {
            return { ok: false as const, reason: "تعذّر إنشاء حساب البوابة تلقائيًا." };
          }
        }),
      );
      const ownerResult = payload.owner_id
        ? results[contacts.indexOf(payload.owner_id)]
        : undefined;
      const firstSuccess = ownerResult?.ok ? ownerResult : results.find((result) => result.ok);
      if (firstSuccess?.ok)
        return { username: firstSuccess.username, password: firstSuccess.password };
      return results[0] && !results[0].ok ? { reason: results[0].reason } : null;
    },
    onSuccess: (account) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["building-unit-contracts"] });
      toast.success(editing ? "تم تحديث العقد" : "تم إنشاء العقد");
      if (account && "username" in account && account.username) {
        toast.success(
          `تم تفعيل بوابة العميل — المستخدم ${account.username} وكلمة المرور ${account.password}`,
          {
            duration: 12000,
          },
        );
      } else if (account && "reason" in account && account.reason) {
        toast.warning(account.reason);
      }
      setFormOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحفظ"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const contract = rows.find((row) => row.id === id);
      await deleteContractWithOwner(id, contract?.owner_id ?? null, false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contract_imports"] });
      toast.success("تم حذف العقد");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحذف"),
  });

  const counts = useMemo(
    () => ({
      all: rows.length,
      rent: rows.filter((r) => r.contract_type !== "sale").length,
      sale: rows.filter((r) => r.contract_type === "sale").length,
      active: rows.filter((r) => r.status === "active").length,
      expired: rows.filter((r) => r.status === "expired" || r.status === "terminated").length,
      imports: (imports.data ?? []).length,
    }),
    [rows, imports.data],
  );

  const filtered = rows.filter((r) => {
    if (tab === "all") return true;
    if (tab === "rent") return r.contract_type !== "sale";
    if (tab === "sale") return r.contract_type === "sale";
    if (tab === "active") return r.status === "active";
    if (tab === "imports") return true;
    return r.status === "expired" || r.status === "terminated";
  });

  return (
    <>
      <PageHero
        title="إدارة العقود"
        subtitle="جميع العقود المسجلة أو المستوردة من ملفات PDF، مع أطرافها وقيمها ودفعاتها."
        icon={FileText}
        stats={[
          { value: String(counts.active), label: "عقد ساري" },
          { value: String(counts.expired), label: "منتهٍ / منهي" },
          { value: String(counts.imports), label: "ملف مستورد" },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => openCreate()}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" />
          عقد جديد
        </button>
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <FileUp className="size-4" />
          استيراد عقد PDF
        </button>
      </div>

      <Pills
        variant="card"
        defaultKey="all"
        onChange={setTab}
        items={[
          { key: "all", label: "كل العقود", count: counts.all },
          { key: "rent", label: "إيجار", count: counts.rent },
          { key: "sale", label: "بيع", count: counts.sale },
          { key: "active", label: "سارية", count: counts.active },
          { key: "expired", label: "منتهية", count: counts.expired },
          { key: "imports", label: "ملفات PDF", count: counts.imports },
        ]}
      />

      {tab === "imports" ? (
        <div className="space-y-3">
          <StatusLegend />
          <DataTable<ImportRow>
            rows={imports.data ?? []}
            rowClassName={(r) => toneRowClass[rowTone(r.status)]}
            searchPlaceholder="بحث باسم الملف"
            emptyState={
              <EmptyState
                text="لا توجد ملفات مستوردة"
                hint="اضغط «استيراد عقد PDF» لرفع ملف وتحليله بالذكاء الاصطناعي."
              />
            }
            columns={[
              { header: "الملف", cell: (r) => r.file_name, className: "font-semibold" },
              {
                header: "الحجم",
                cell: (r) => (r.file_size ? `${(r.file_size / 1024 / 1024).toFixed(2)} م.ب` : "—"),
              },
              {
                header: "الحالة",
                cell: (r) => (
                  <Chip
                    tone={
                      r.status === "approved"
                        ? "success"
                        : r.status === "failed" || r.status === "rejected"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {importStatusLabels[r.status] ?? r.status}
                  </Chip>
                ),
              },
              { header: "تحذيرات", cell: (r) => (r.warnings?.length ?? 0) || "—" },
              {
                header: "التاريخ",
                sortable: true,
                value: (r) => r.created_at,
                cell: (r) => formatDate(r.created_at),
              },
              {
                header: "إجراءات",
                cell: (r) => (
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm("حذف سجل الاستيراد هذا؟")) {
                        const { error } = await supabase
                          .from("contract_imports")
                          .delete()
                          .eq("id", r.id);
                        if (error) toast.error(error.message);
                        else {
                          toast.success("تم حذف السجل");
                          queryClient.invalidateQueries({ queryKey: ["contract_imports"] });
                        }
                      }
                    }}
                    className="text-destructive hover:underline"
                  >
                    <Trash2 className="size-4" />
                  </button>
                ),
              },
            ]}
          />
        </div>
      ) : isLoading ? (
        <div className="surface-card grid place-items-center gap-2 px-6 py-16 text-center">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-[13px] text-muted-foreground">جاري تحميل العقود…</p>
        </div>
      ) : (
        <div className="space-y-3">
          <StatusLegend />
          <DataTable<Row>
            rows={filtered}
            rowClassName={(r) => toneRowClass[rowTone(r.status, r.end_date)]}
            onRowClick={(r) =>
              navigate({ to: "/contracts/$contractId", params: { contractId: r.id } })
            }
            draggableRows
            dragLabel="عقد"
            showColumnsButton
            searchPlaceholder="بحث برقم العقد أو الطرف"
            emptyState={
              <EmptyState
                text="لا توجد عقود"
                hint="أضِف عقدًا يدويًا أو استورد ملف PDF لعقد قائم ليظهر هنا."
              />
            }
            columns={[
              {
                header: "رقم العقد",
                sortable: true,
                value: (r) => r.contract_number ?? "",
                cell: (r) => (
                  <Link
                    to="/contracts/$contractId"
                    params={{ contractId: r.id }}
                    className="font-bold text-primary hover:underline"
                  >
                    {r.contract_number ?? "—"}
                  </Link>
                ),
                className: "font-semibold",
              },
              { header: "النوع", cell: (r) => (r.contract_type === "sale" ? "بيع" : "إيجار") },
              { header: "المالك", cell: (r) => r.owner?.full_name ?? "—" },
              { header: "المستأجر / المشتري", cell: (r) => r.tenant?.full_name ?? "—" },
              {
                header: "من",
                sortable: true,
                value: (r) => r.start_date ?? "",
                cell: (r) => formatDate(r.start_date),
              },
              {
                header: "إلى",
                sortable: true,
                value: (r) => r.end_date ?? "",
                cell: (r) => formatDate(r.end_date),
              },
              {
                header: "القيمة",
                sortable: true,
                value: (r) => r.annual_rent ?? r.total_value ?? 0,
                cell: (r) => formatCurrency(r.annual_rent ?? r.total_value),
              },
              {
                header: "الدورة",
                cell: (r) => cycleLabels[r.payment_cycle ?? ""] ?? r.payment_cycle ?? "—",
              },
              {
                header: "المصدر",
                cell: (r) => (
                  <Chip tone={r.source === "pdf_import" ? "gold" : "neutral"}>
                    {r.source === "pdf_import" ? "استيراد PDF" : "إدخال يدوي"}
                  </Chip>
                ),
              },
              {
                header: "الحالة",
                cell: (r) => (
                  <Chip tone={rowTone(r.status, r.end_date)}>
                    {contractStatusLabels[r.status] ?? r.status}
                  </Chip>
                ),
              },
              {
                header: "إجراءات",
                cell: (r) => (
                  <span className="inline-flex items-center gap-3">
                    <Link
                      to="/contracts/$contractId"
                      params={{ contractId: r.id }}
                      className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-foreground"
                    >
                      <Eye className="size-4" />
                      عرض
                    </Link>
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary"
                    >
                      <Pencil className="size-4" />
                      تعديل
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`حذف العقد ${r.contract_number ?? ""}؟`))
                          remove.mutate(r.id);
                      }}
                      className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-destructive"
                    >
                      <Trash2 className="size-4" />
                      حذف
                    </button>
                  </span>
                ),
              },
            ]}
          />
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        wide
        title={editing ? "تعديل العقد" : "عقد جديد"}
        subtitle="الأطراف تُختار من قاعدة العملاء، وتُحدَّث لوحة التحكم تلقائيًا بعد الحفظ."
        footer={
          <>
            <PrimaryButton onClick={() => save.mutate("manual")} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              حفظ العقد
            </PrimaryButton>
            <GhostButton onClick={() => setFormOpen(false)}>إلغاء</GhostButton>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="رقم العقد" hint="يُولَّد تلقائيًا إذا تُرك فارغًا">
            <input
              className={inputClass}
              dir="ltr"
              value={form.contract_number}
              onChange={(e) => set({ contract_number: e.target.value })}
            />
          </Field>
          <Field label="نوع العقد">
            <select
              className={inputClass}
              value={form.contract_type}
              onChange={(e) => set({ contract_type: e.target.value })}
            >
              <option value="rent">إيجار</option>
              <option value="sale">بيع</option>
            </select>
          </Field>
          <Field label="المالك">
            <select
              className={inputClass}
              value={form.owner_id}
              onChange={(e) => set({ owner_id: e.target.value })}
            >
              <option value="">— اختر —</option>
              {(contacts.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="المستأجر / المشتري">
            <select
              className={inputClass}
              value={form.tenant_id}
              onChange={(e) => set({ tenant_id: e.target.value })}
            >
              <option value="">— اختر —</option>
              {(contacts.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="العمارة والوحدة">
            <select
              className={inputClass}
              value={form.property_id}
              onChange={(e) => set({ property_id: e.target.value })}
            >
              <option value="">— اختر الوحدة —</option>
              {(unitProperties.data ?? []).map((property) => (
                <option key={property.id} value={property.id}>
                  {[property.building?.name, property.name || property.code]
                    .filter(Boolean)
                    .join(" — ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="تاريخ البداية">
            <input
              type="date"
              className={inputClass}
              value={form.start_date}
              onChange={(e) => set({ start_date: e.target.value })}
            />
          </Field>
          <Field label="تاريخ النهاية">
            <input
              type="date"
              className={inputClass}
              value={form.end_date}
              onChange={(e) => set({ end_date: e.target.value })}
            />
          </Field>
          <Field label="الإيجار السنوي">
            <input
              className={inputClass}
              dir="ltr"
              inputMode="numeric"
              value={form.annual_rent}
              onChange={(e) => set({ annual_rent: e.target.value })}
            />
          </Field>
          <Field label="القيمة الإجمالية">
            <input
              className={inputClass}
              dir="ltr"
              inputMode="numeric"
              value={form.total_value}
              onChange={(e) => set({ total_value: e.target.value })}
            />
          </Field>
          <Field label="التأمين">
            <input
              className={inputClass}
              dir="ltr"
              inputMode="numeric"
              value={form.deposit}
              onChange={(e) => set({ deposit: e.target.value })}
            />
          </Field>
          <Field label="دورة السداد">
            <select
              className={inputClass}
              value={form.payment_cycle}
              onChange={(e) => set({ payment_cycle: e.target.value })}
            >
              {Object.entries(cycleLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="عدد الدفعات">
            <input
              className={inputClass}
              dir="ltr"
              inputMode="numeric"
              value={form.payments_count}
              onChange={(e) => set({ payments_count: e.target.value })}
            />
          </Field>
          <Field label="الحالة">
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => set({ status: e.target.value })}
            >
              {Object.entries(contractStatusLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ملاحظات" className="sm:col-span-2">
            <textarea
              className={textareaClass}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </Field>
        </div>
      </Modal>

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onExtracted={(prefill) => {
          setImportOpen(false);
          openCreate(prefill);
        }}
      />
    </>
  );
}

export function ImportDialog({
  open,
  onClose,
  onExtracted,
}: {
  open: boolean;
  onClose: () => void;
  onExtracted: (prefill: Partial<FormState>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [report, setReport] = useState<{ created: string[]; warnings: string[] } | null>(null);
  const [analysisStage, setAnalysisStage] = useState("");
  const queryClient = useQueryClient();

  const finalize = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error("لا توجد بيانات مستخرجة");
      return finalizeContractImport({
        data: {
          extraction: result,
          filePath: filePath ?? undefined,
          importId: importId ?? undefined,
        },
      });
    },
    onSuccess: (res) => {
      setReport({ created: res.created, warnings: res.warnings });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contract_imports"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast.success("تم ترحيل العقد وتوزيع بياناته تلقائيًا");
      if (res.account) {
        toast.success(
          `بوابة العميل: المستخدم ${res.account.username} — كلمة المرور ${res.account.password}`,
          { duration: 15000 },
        );
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الترحيل"),
  });

  const analyze = useMutation({
    mutationFn: async (f: File) => {
      setAnalysisStage("جاري التحقق من تكرار العقد…");
      const buffer = await f.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buffer);
      const fileHash = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const duplicateImports = await supabase
        .from("contract_imports")
        .select("id, file_name, file_path, contract_id, created_at")
        .eq("file_hash", fileHash)
        .limit(20);
      if (duplicateImports.error) throw duplicateImports.error;

      const linkedContractIds = (duplicateImports.data ?? [])
        .map((item) => item.contract_id)
        .filter((id): id is string => Boolean(id));
      const existingContracts = linkedContractIds.length
        ? await supabase
            .from("contracts")
            .select("id, contract_number, property:property_id(name)")
            .in("id", linkedContractIds)
            .limit(1)
        : { data: [], error: null };
      if (existingContracts.error) throw existingContracts.error;
      const existing = existingContracts.data?.[0];
      if (existing) {
        const property = Array.isArray(existing.property)
          ? existing.property[0]
          : existing.property;
        throw new Error(
          `العقد موجود بالفعل باسم «${property?.name ?? existing.contract_number ?? "عقد مسجّل"}» ورقم ${existing.contract_number ?? "غير محدد"} — تم رفض الملف لمنع التكرار.`,
        );
      }

      // سجلات التحليل التي فقدت عقدها لا تمنع إعادة رفعه بعد الحذف.
      const staleImports = duplicateImports.data ?? [];
      const stalePaths = staleImports
        .map((item) => item.file_path)
        .filter((path): path is string => Boolean(path));
      if (stalePaths.length) await supabase.storage.from("contract-files").remove(stalePaths);
      if (staleImports.length) {
        const removed = await supabase
          .from("contract_imports")
          .delete()
          .in(
            "id",
            staleImports.map((item) => item.id),
          );
        if (removed.error) throw removed.error;
      }

      setAnalysisStage("جاري قراءة نص العقد…");
      let extractedText = "";
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const document = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()) })
          .promise;
        const pages: string[] = [];
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          const page = await document.getPage(pageNumber);
          const content = await page.getTextContent();
          pages.push(
            content.items
              .map((item) => ("str" in item ? item.str : ""))
              .filter(Boolean)
              .join(" "),
          );
        }
        extractedText = pages.join("\n").trim();
      } catch {
        extractedText = "";
      }

      setAnalysisStage("جاري حفظ نسخة العقد…");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("تعذّر قراءة الملف"));
        reader.readAsDataURL(f);
      });

      const path = `imports/${Date.now()}-${f.name.replace(/[^\w.\-]/g, "_")}`;
      const upload = await supabase.storage
        .from("contract-files")
        .upload(path, f, { upsert: true });
      if (upload.error) throw new Error("تعذّر رفع الملف إلى المخزن الخاص");

      setAnalysisStage(
        extractedText.length >= 300
          ? "جاري استخراج البيانات من النص…"
          : "العقد مصوّر — جاري قراءة الصفحات…",
      );
      const { extractionJson } = await analyzeContractPdf({
        data: {
          fileName: f.name,
          ...(extractedText.length >= 300 ? { extractedText } : { dataUrl }),
        },
      });
      const extraction = JSON.parse(extractionJson) as Record<string, unknown>;

      const saved = await supabase
        .from("contract_imports")
        .insert({
          file_path: path,
          file_name: f.name,
          file_size: f.size,
          file_hash: fileHash,
          status: "needs_review",
          extraction: extraction as never,
          warnings: (Array.isArray(extraction["warnings"]) ? extraction["warnings"] : []) as never,
        })
        .select("id")
        .single();

      return { extraction, path, importId: saved.data?.id ?? null };
    },
    onSuccess: ({ extraction, path, importId: id }) => {
      setAnalysisStage("");
      setResult(extraction);
      setFilePath(path);
      setImportId(id);
      setReport(null);
      queryClient.invalidateQueries({ queryKey: ["contract_imports"] });
      queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
      toast.success("تم تحليل الملف بالذكاء الاصطناعي");
    },
    onError: (err) => {
      setAnalysisStage("");
      toast.error(err instanceof Error ? err.message : "تعذّر تحليل الملف");
    },
  });

  const str = (key: string) => {
    const v = result?.[key];
    return v == null || v === "" ? "" : String(v);
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        setFile(null);
        setResult(null);
        onClose();
      }}
      wide
      title="استيراد عقد PDF"
      subtitle="ارفع ملف العقد ليقرأه الذكاء الاصطناعي ويستخرج بياناته تلقائيًا للمراجعة."
      footer={
        result ? (
          report ? (
            <>
              <GhostButton
                onClick={() =>
                  onExtracted({
                    contract_number: str("contract_number"),
                    contract_type: str("contract_type") === "sale" ? "sale" : "rent",
                    start_date: str("start_date"),
                    end_date: str("end_date"),
                    annual_rent: str("annual_rent"),
                    total_value: str("total_value"),
                    deposit: str("deposit"),
                    payments_count: str("payments_count") || "1",
                    notes: [str("property_name"), str("district"), str("special_terms")]
                      .filter(Boolean)
                      .join(" — "),
                  })
                }
              >
                متابعة إلى نموذج العقد
              </GhostButton>
              <GhostButton
                onClick={() => {
                  setResult(null);
                  setFile(null);
                  setReport(null);
                }}
              >
                ملف آخر
              </GhostButton>
            </>
          ) : (
            <PrimaryButton onClick={() => finalize.mutate()} disabled={finalize.isPending}>
              {finalize.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              ترحيل تلقائي كامل
            </PrimaryButton>
          )
        ) : (
          <PrimaryButton
            onClick={() => file && analyze.mutate(file)}
            disabled={!file || analyze.isPending}
          >
            {analyze.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {analyze.isPending ? analysisStage || "جاري تحليل الملف…" : "تحليل الملف"}
          </PrimaryButton>
        )
      }
    >
      {result ? (
        <div className="space-y-3">
          <p className="text-[13px] font-semibold text-foreground">البيانات المستخرجة</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["رقم العقد", "contract_number"],
              ["نوع العقد", "contract_type"],
              ["المالك", "owner_name"],
              ["المستأجر", "tenant_name"],
              ["البداية", "start_date"],
              ["النهاية", "end_date"],
              ["الإيجار السنوي", "annual_rent"],
              ["القيمة الإجمالية", "total_value"],
              ["التأمين", "deposit"],
              ["عدد الدفعات", "payments_count"],
              ["العقار", "property_name"],
              ["الحي", "district"],
            ].map(([label, key]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-[12.5px]"
              >
                <span className="font-semibold text-foreground">{str(key as string) || "—"}</span>
                <span className="text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
          {Array.isArray(result["warnings"]) && result["warnings"].length ? (
            <ul className="list-inside list-disc space-y-1 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-[12.5px] text-warning-foreground">
              {(result["warnings"] as string[]).map((w, i) => (
                <li key={i}>{String(w)}</li>
              ))}
            </ul>
          ) : null}

          {report ? (
            <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-[13px] font-bold text-foreground">نتيجة الترحيل التلقائي</p>
              <ul className="list-inside list-disc space-y-1 text-[12.5px] text-success">
                {report.created.map((c, i) => (
                  <li key={i}>تم إنشاء {c}</li>
                ))}
              </ul>
              {report.warnings.length ? (
                <>
                  <p className="text-[12.5px] font-bold text-foreground">استثناءات تحتاج مراجعة</p>
                  <ul className="list-inside list-disc space-y-1 text-[12.5px] text-warning-foreground">
                    {report.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-[12.5px] text-muted-foreground">
                  لا توجد استثناءات — العقد جاهز.
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-lg border border-border bg-accent/40 px-4 py-3 text-[12.5px] text-muted-foreground">
              «ترحيل تلقائي كامل» ينشئ المالك والمستأجر والعقار والعقد وجدول الدفعات، والفواتير
              تُنشأ يدويًا من صفحة الفواتير وحساب بوابة العميل وتذكير السداد دفعة واحدة.
            </p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="grid w-full place-items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-muted/30 px-6 py-14 text-center transition-colors hover:border-primary/40 hover:bg-accent/40"
        >
          <span className="grid size-14 place-items-center rounded-2xl border border-border bg-card text-primary">
            <FileUp className="size-7" />
          </span>
          <span className="text-[14px] font-bold text-foreground">
            {file ? file.name : "اسحب ملف العقد هنا أو اضغط للاختيار"}
          </span>
          <span className="text-[12px] text-muted-foreground">
            ملف PDF واحد — يُخزَّن بشكل خاص وآمن
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </button>
      )}
    </Modal>
  );
}
