import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  FileSpreadsheet,
  FileUp,
  Megaphone,
  MessageCircle,
  Paperclip,
  Receipt,
  RefreshCw,
  Trash2,
  TrendingUp,
  UserPlus,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { exportWorkbook } from "@/lib/export";
import {
  addOwnerDelegate,
  addOwnerDocument,
  addOwnerExpense,
  createOwnerRequest,
  deleteOwnerDocument,
  deleteOwnerExpense,
  getOwnerDashboard,
  getOwnerStatement,
  getOwnerTools,
  remindTenantWhatsApp,
  removeOwnerDelegate,
} from "@/lib/portal.functions";

const num = (v: number | null | undefined) => Number(v ?? 0).toLocaleString("en-US");
const money = (v: number | null | undefined) => `${num(Math.round(Number(v ?? 0)))} ر.س`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthStart = (offset = 0) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 10);
};

const REQUEST_KINDS: Record<string, string> = {
  maintenance: "صيانة",
  renewal: "تجديد عقد",
  marketing: "تسويق وحدة",
  other: "أخرى",
};
const REQUEST_STATUS: Record<string, string> = {
  new: "جديد",
  in_progress: "قيد التنفيذ",
  done: "منجز",
  rejected: "مرفوض",
};
const EXPENSE_CATEGORIES = [
  { value: "maintenance", label: "صيانة" },
  { value: "utilities", label: "فواتير وخدمات" },
  { value: "cleaning", label: "نظافة" },
  { value: "government", label: "رسوم حكومية" },
  { value: "other", label: "أخرى" },
];
const DOC_TYPES = [
  { value: "deed", label: "صك الملكية" },
  { value: "meter", label: "عداد الكهرباء/المياه" },
  { value: "handover", label: "صور التسليم" },
  { value: "other", label: "أخرى" },
];

function Card({ children, title, icon: Icon, action }: { children: React.ReactNode; title: string; icon: typeof Wrench; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-card">
      <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </h3>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
const btnCls =
  "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50";
const ghostBtn =
  "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition hover:bg-muted disabled:opacity-50";

export function OwnerTools() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const dash = useQuery({ queryKey: ["owner-dashboard"], queryFn: () => getOwnerDashboard() });
  const tools = useQuery({ queryKey: ["owner-tools"], queryFn: () => getOwnerTools() });

  const [request, setRequest] = useState({ kind: "maintenance", title: "", details: "", unitId: "" });
  const [expense, setExpense] = useState({ category: "maintenance", amount: "", description: "", spentOn: todayISO(), unitId: "" });
  const [doc, setDoc] = useState({ title: "", docType: "deed", unitId: "" });
  const [delegate, setDelegate] = useState({ fullName: "", phone: "", nationalId: "", accessLevel: "view" as "view" | "collect" });
  const [range, setRange] = useState({ from: monthStart(-11), to: todayISO() });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["owner-tools"] });
    void qc.invalidateQueries({ queryKey: ["owner-dashboard"] });
  };

  const mRequest = useMutation({
    mutationFn: () =>
      createOwnerRequest({
        data: {
          kind: request.kind as "maintenance" | "renewal" | "marketing" | "other",
          title: request.title,
          details: request.details,
          unitId: request.unitId || null,
        },
      }),
    onSuccess: () => {
      toast.success("تم إرسال الطلب لفريق الرشودي.");
      setRequest({ kind: "maintenance", title: "", details: "", unitId: "" });
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الإرسال"),
  });

  const quickRequest = useMutation({
    mutationFn: (v: { kind: "renewal" | "marketing"; title: string; unitId?: string | null; contractId?: string | null }) =>
      createOwnerRequest({ data: { kind: v.kind, title: v.title, unitId: v.unitId ?? null, contractId: v.contractId ?? null } }),
    onSuccess: () => {
      toast.success("تم إرسال الطلب.");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الإرسال"),
  });

  const mRemind = useMutation({
    mutationFn: (paymentId: string) => remindTenantWhatsApp({ data: { paymentId } }),
    onSuccess: () => toast.success("تم إرسال التذكير عبر واتساب."),
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر إرسال التذكير"),
  });

  const mExpense = useMutation({
    mutationFn: () =>
      addOwnerExpense({
        data: {
          category: expense.category,
          amount: Number(expense.amount),
          description: expense.description,
          spentOn: expense.spentOn,
          unitId: expense.unitId || null,
        },
      }),
    onSuccess: () => {
      toast.success("تم تسجيل المصروف.");
      setExpense({ category: "maintenance", amount: "", description: "", spentOn: todayISO(), unitId: "" });
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الحفظ"),
  });

  const mDeleteExpense = useMutation({
    mutationFn: (id: string) => deleteOwnerExpense({ data: { id } }),
    onSuccess: refresh,
  });

  const mDoc = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error("اختر ملفًا أولًا.");
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("تعذّر قراءة الملف"));
        reader.readAsDataURL(file);
      });
      return addOwnerDocument({
        data: { title: doc.title || file.name, docType: doc.docType, fileName: file.name, dataBase64, unitId: doc.unitId || null },
      });
    },
    onSuccess: () => {
      toast.success("تم رفع المرفق.");
      setDoc({ title: "", docType: "deed", unitId: "" });
      if (fileRef.current) fileRef.current.value = "";
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر الرفع"),
  });

  const mDeleteDoc = useMutation({ mutationFn: (id: string) => deleteOwnerDocument({ data: { id } }), onSuccess: refresh });

  const mDelegate = useMutation({
    mutationFn: () => addOwnerDelegate({ data: delegate }),
    onSuccess: () => {
      toast.success("تم تفويض الوكيل.");
      setDelegate({ fullName: "", phone: "", nationalId: "", accessLevel: "view" });
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر التفويض"),
  });

  const mRemoveDelegate = useMutation({ mutationFn: (id: string) => removeOwnerDelegate({ data: { id } }), onSuccess: refresh });

  const mStatement = useMutation({
    mutationFn: () => getOwnerStatement({ data: range }),
    onSuccess: async (s) => {
      await exportWorkbook(`كشف حساب ${s.ownerName} ${s.from} - ${s.to}`, [
        {
          name: "الدفعات",
          rows: s.rows.map((r) => ({
            "رقم العقد": r.contractNumber,
            المستأجر: r.tenant,
            الوحدة: r.unit,
            "رقم الدفعة": r.paymentNumber,
            "تاريخ الاستحقاق": r.dueDate,
            المستحق: r.amountDue,
            المدفوع: r.amountPaid,
            المتبقي: r.remaining,
            الحالة: r.status,
          })),
        },
        {
          name: "المصروفات",
          rows: s.expenses.map((e) => ({
            التاريخ: e.spent_on,
            البند: e.category,
            الوصف: e.description ?? "",
            المبلغ: Number(e.amount),
          })),
        },
      ]);
      toast.success("تم تنزيل كشف الحساب.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر إنشاء الكشف"),
  });

  const view = useMemo(() => {
    const data = dash.data;
    if (!data) return null;
    const today = todayISO();
    const day = 86400000;
    const daysTo = (d: string) => Math.round((new Date(d).getTime() - new Date(today).getTime()) / day);

    const expiring = data.contracts
      .filter((c) => c.status === "active" && c.end_date && daysTo(c.end_date) >= 0 && daysTo(c.end_date) <= 60)
      .map((c) => ({ ...c, days: daysTo(c.end_date as string) }))
      .sort((a, b) => a.days - b.days);

    // سجل سداد كل مستأجر + تقييم الانتظام
    const tenants = new Map<string, { name: string; unit: string; total: number; onTime: number; late: number; remaining: number }>();
    for (const p of data.payments) {
      const c = data.contracts.find((x) => x.id === p.contract_id);
      const name = c?.tenant?.full_name ?? "مستأجر";
      const key = `${c?.id ?? "x"}`;
      const row = tenants.get(key) ?? {
        name,
        unit: c?.unit?.unit_number ? `وحدة ${c.unit.unit_number}` : (c?.property?.name ?? "—"),
        total: 0,
        onTime: 0,
        late: 0,
        remaining: 0,
      };
      row.total += 1;
      if (p.status === "paid") row.onTime += 1;
      else if (p.due_date < today) row.late += 1;
      row.remaining += Math.max(0, Number(p.amount_due) - Number(p.amount_paid));
      tenants.set(key, row);
    }
    const tenantRows = [...tenants.values()]
      .map((t) => ({ ...t, score: t.total ? Math.round((t.onTime / t.total) * 100) : 0 }))
      .sort((a, b) => b.remaining - a.remaining);

    // مقارنة التحصيل بين الشهر الحالي والسابق
    const inMonth = (iso: string, offset: number) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() + offset);
      return iso.slice(0, 7) === d.toISOString().slice(0, 7);
    };
    const sumPaid = (offset: number) =>
      data.payments.filter((p) => inMonth(p.due_date, offset)).reduce((s, p) => s + Number(p.amount_paid), 0);
    const currentMonth = sumPaid(0);
    const prevMonth = sumPaid(-1);

    const vacant = data.units.filter((u) => u.status !== "occupied");
    const dueSoon = data.payments
      .filter((p) => p.status !== "paid")
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 10);

    return { expiring, tenantRows, currentMonth, prevMonth, vacant, dueSoon, today };
  }, [dash.data]);

  const expenses = tools.data?.expenses ?? [];
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const collected = (dash.data?.payments ?? []).reduce((s, p) => s + Number(p.amount_paid), 0);
  const units = dash.data?.units ?? [];

  if (dash.isLoading || tools.isLoading) return <p className="text-sm text-muted-foreground">جاري تحميل أدوات المالك…</p>;
  if (!view || !tools.data) return null;

  const diff = view.currentMonth - view.prevMonth;
  const diffPct = view.prevMonth ? Math.round((diff / view.prevMonth) * 100) : view.currentMonth ? 100 : 0;

  return (
    <div className="mt-6 space-y-4">
      <div>
        <h2 className="text-lg font-black">أدوات المالك</h2>
        <p className="text-xs text-muted-foreground">كل ما يساعدك على متابعة المستأجرين والتحصيل والتشغيل.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 1) تنبيهات انتهاء العقود */}
        <Card title="عقود تقترب من الانتهاء (30/60 يومًا)" icon={CalendarClock}>
          {view.expiring.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد عقود تنتهي خلال 60 يومًا.</p>
          ) : (
            <ul className="divide-y divide-border">
              {view.expiring.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div>
                    <p className="font-bold">
                      {c.tenant?.full_name ?? "مستأجر"} • {c.unit?.unit_number ? `وحدة ${c.unit.unit_number}` : (c.property?.name ?? "—")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">ينتهي في {c.end_date} • بعد {c.days} يومًا</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${c.days <= 30 ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}
                    >
                      {c.days <= 30 ? "عاجل" : "قريب"}
                    </span>
                    <button
                      type="button"
                      className={ghostBtn}
                      disabled={quickRequest.isPending}
                      onClick={() =>
                        quickRequest.mutate({
                          kind: "renewal",
                          title: `طلب تجديد عقد ${c.contract_number}`,
                          unitId: c.unit?.id ?? null,
                          contractId: c.id,
                        })
                      }
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> طلب تجديد
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 2) كشف الحساب */}
        <Card title="كشف حساب قابل للتصدير" icon={FileSpreadsheet}>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground">
              من
              <input type="date" className={inputCls} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            </label>
            <label className="text-xs text-muted-foreground">
              إلى
              <input type="date" className={inputCls} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={btnCls} disabled={mStatement.isPending} onClick={() => mStatement.mutate()}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> تصدير Excel
            </button>
            <button type="button" className={ghostBtn} onClick={() => window.print()}>
              <Receipt className="h-3.5 w-3.5" /> طباعة / PDF
            </button>
          </div>
        </Card>

        {/* 3) سجل السداد وتقييم الانتظام */}
        <Card title="سجل سداد المستأجرين وتقييم الانتظام" icon={BadgeCheck}>
          {view.tenantRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد بيانات سداد بعد.</p>
          ) : (
            <table className="w-full text-right text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 font-semibold">المستأجر</th>
                  <th className="py-1 font-semibold">الوحدة</th>
                  <th className="py-1 font-semibold">مسدد</th>
                  <th className="py-1 font-semibold">متأخر</th>
                  <th className="py-1 font-semibold">المتبقي</th>
                  <th className="py-1 font-semibold">الانتظام</th>
                </tr>
              </thead>
              <tbody>
                {view.tenantRows.map((t) => (
                  <tr key={`${t.name}-${t.unit}`} className="border-t border-border">
                    <td className="py-1.5 font-semibold">{t.name}</td>
                    <td className="py-1.5">{t.unit}</td>
                    <td className="py-1.5 text-success">{t.onTime}</td>
                    <td className="py-1.5 text-destructive">{t.late}</td>
                    <td className="py-1.5">{money(t.remaining)}</td>
                    <td className="py-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 font-bold ${t.score >= 80 ? "bg-success/10 text-success" : t.score >= 50 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}`}
                      >
                        {t.score}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* 5) تذكير واتساب */}
        <Card title="تذكير المستأجر بالدفعة عبر واتساب" icon={MessageCircle}>
          {view.dueSoon.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد دفعات مستحقة.</p>
          ) : (
            <ul className="divide-y divide-border">
              {view.dueSoon.map((p) => {
                const c = dash.data?.contracts.find((x) => x.id === p.contract_id);
                return (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <div>
                      <p className="font-bold">{money(Number(p.amount_due) - Number(p.amount_paid))}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {c?.tenant?.full_name ?? "مستأجر"} • {p.due_date}
                        {p.due_date < view.today ? " • متأخرة" : ""}
                      </p>
                    </div>
                    <button type="button" className={ghostBtn} disabled={mRemind.isPending} onClick={() => mRemind.mutate(p.id)}>
                      <MessageCircle className="h-3.5 w-3.5" /> إرسال تذكير
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* 4) طلبات الصيانة والطلبات العامة */}
        <Card title="طلبات الصيانة والخدمة" icon={Wrench}>
          <div className="grid gap-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <select className={inputCls} value={request.kind} onChange={(e) => setRequest({ ...request, kind: e.target.value })}>
                {Object.entries(REQUEST_KINDS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <select className={inputCls} value={request.unitId} onChange={(e) => setRequest({ ...request, unitId: e.target.value })}>
                <option value="">كل الوحدات</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    وحدة {u.unit_number ?? "—"}
                  </option>
                ))}
              </select>
            </div>
            <input className={inputCls} placeholder="عنوان الطلب" value={request.title} onChange={(e) => setRequest({ ...request, title: e.target.value })} />
            <textarea
              className={inputCls}
              rows={2}
              placeholder="تفاصيل إضافية (اختياري)"
              value={request.details}
              onChange={(e) => setRequest({ ...request, details: e.target.value })}
            />
            <button type="button" className={btnCls} disabled={mRequest.isPending} onClick={() => mRequest.mutate()}>
              <Wrench className="h-3.5 w-3.5" /> إرسال الطلب
            </button>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {tools.data.requests.slice(0, 6).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                <span className="font-semibold">
                  {REQUEST_KINDS[r.kind] ?? r.kind} — {r.title}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5">{REQUEST_STATUS[r.status] ?? r.status}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* 6) تسويق الوحدات الشاغرة */}
        <Card title="إعلان الوحدات الشاغرة للتسويق" icon={Megaphone}>
          {view.vacant.length === 0 ? (
            <p className="text-sm text-muted-foreground">كل وحداتك مشغولة حاليًا.</p>
          ) : (
            <ul className="divide-y divide-border">
              {view.vacant.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <div>
                    <p className="font-bold">وحدة {u.unit_number ?? "—"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {u.unit_type ?? "—"} {u.area ? `• ${num(u.area)} م²` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={ghostBtn}
                    disabled={quickRequest.isPending}
                    onClick={() => quickRequest.mutate({ kind: "marketing", title: `طلب تسويق وحدة ${u.unit_number ?? ""}`, unitId: u.id })}
                  >
                    <Megaphone className="h-3.5 w-3.5" /> اطلب التسويق
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 7) المرفقات */}
        <Card title="مرفقات الوحدة (صك، عداد، تسليم)" icon={Paperclip}>
          <div className="grid gap-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <select className={inputCls} value={doc.docType} onChange={(e) => setDoc({ ...doc, docType: e.target.value })}>
                {DOC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select className={inputCls} value={doc.unitId} onChange={(e) => setDoc({ ...doc, unitId: e.target.value })}>
                <option value="">بدون وحدة محددة</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    وحدة {u.unit_number ?? "—"}
                  </option>
                ))}
              </select>
            </div>
            <input className={inputCls} placeholder="اسم المرفق" value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} />
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xlsx" className={inputCls} />
            <button type="button" className={btnCls} disabled={mDoc.isPending} onClick={() => mDoc.mutate()}>
              <FileUp className="h-3.5 w-3.5" /> رفع المرفق
            </button>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {tools.data.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                <a href={d.url ?? "#"} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">
                  {d.title}
                </a>
                <button type="button" className="text-destructive" onClick={() => mDeleteDoc.mutate(d.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {/* 8) المصروفات وصافي الدخل */}
        <Card
          title="مصروفات الوحدات وصافي الدخل"
          icon={Receipt}
          action={<span className="text-xs font-bold text-success">الصافي: {money(collected - totalExpenses)}</span>}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <select className={inputCls} value={expense.category} onChange={(e) => setExpense({ ...expense, category: e.target.value })}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <select className={inputCls} value={expense.unitId} onChange={(e) => setExpense({ ...expense, unitId: e.target.value })}>
              <option value="">بدون وحدة محددة</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  وحدة {u.unit_number ?? "—"}
                </option>
              ))}
            </select>
            <input className={inputCls} type="number" placeholder="المبلغ" value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} />
            <input className={inputCls} type="date" value={expense.spentOn} onChange={(e) => setExpense({ ...expense, spentOn: e.target.value })} />
          </div>
          <input
            className={`${inputCls} mt-2`}
            placeholder="وصف المصروف"
            value={expense.description}
            onChange={(e) => setExpense({ ...expense, description: e.target.value })}
          />
          <button type="button" className={`${btnCls} mt-2`} disabled={mExpense.isPending} onClick={() => mExpense.mutate()}>
            <Receipt className="h-3.5 w-3.5" /> تسجيل المصروف
          </button>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
            <span className="rounded-lg bg-success/10 p-2 text-success">
              <b className="block text-sm">{money(collected)}</b>المحصّل
            </span>
            <span className="rounded-lg bg-destructive/10 p-2 text-destructive">
              <b className="block text-sm">{money(totalExpenses)}</b>المصروفات
            </span>
            <span className="rounded-lg bg-primary/10 p-2 text-primary">
              <b className="block text-sm">{money(collected - totalExpenses)}</b>الصافي
            </span>
          </div>
          <ul className="mt-3 divide-y divide-border">
            {expenses.slice(0, 6).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                <span>
                  {e.spent_on} • {EXPENSE_CATEGORIES.find((c) => c.value === e.category)?.label ?? e.category} • {money(Number(e.amount))}
                </span>
                <button type="button" className="text-destructive" onClick={() => mDeleteExpense.mutate(e.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {/* 9) مقارنة التحصيل */}
        <Card title="مقارنة التحصيل بالشهر السابق" icon={TrendingUp}>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="text-lg font-black">{money(view.currentMonth)}</p>
              <p className="text-[11px] text-muted-foreground">الشهر الحالي</p>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="text-lg font-black">{money(view.prevMonth)}</p>
              <p className="text-[11px] text-muted-foreground">الشهر السابق</p>
            </div>
          </div>
          <p className={`mt-3 flex items-center justify-center gap-2 text-sm font-bold ${diff >= 0 ? "text-success" : "text-destructive"}`}>
            {diff >= 0 ? <TrendingUp className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {diff >= 0 ? "ارتفاع" : "انخفاض"} {Math.abs(diffPct)}% ({money(Math.abs(diff))})
          </p>
        </Card>

        {/* 10) تفويض وكيل */}
        <Card title="تفويض وكيل (عرض أو تسجيل سداد)" icon={UserPlus}>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={inputCls} placeholder="اسم المفوَّض" value={delegate.fullName} onChange={(e) => setDelegate({ ...delegate, fullName: e.target.value })} />
            <input className={inputCls} placeholder="رقم الجوال" value={delegate.phone} onChange={(e) => setDelegate({ ...delegate, phone: e.target.value })} />
            <input className={inputCls} placeholder="رقم الهوية (اختياري)" value={delegate.nationalId} onChange={(e) => setDelegate({ ...delegate, nationalId: e.target.value })} />
            <select
              className={inputCls}
              value={delegate.accessLevel}
              onChange={(e) => setDelegate({ ...delegate, accessLevel: e.target.value as "view" | "collect" })}
            >
              <option value="view">عرض فقط</option>
              <option value="collect">عرض وتسجيل سداد</option>
            </select>
          </div>
          <button type="button" className={`${btnCls} mt-2`} disabled={mDelegate.isPending} onClick={() => mDelegate.mutate()}>
            <UserPlus className="h-3.5 w-3.5" /> إضافة تفويض
          </button>
          <ul className="mt-3 divide-y divide-border">
            {tools.data.delegates.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                <span className="font-semibold">
                  {d.delegate?.full_name ?? "—"} • {d.access_level === "collect" ? "عرض وتسجيل سداد" : "عرض فقط"}
                </span>
                <button type="button" className="text-destructive" onClick={() => mRemoveDelegate.mutate(d.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
