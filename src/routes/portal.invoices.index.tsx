import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { getPortalOverview } from "@/lib/portal.functions";
import { getMyServiceRequests } from "@/lib/service-partners.functions";

export const Route = createFileRoute("/portal/invoices/")({
  head: () => ({
    meta: [
      { title: "فواتيري | بوابة عميل الرشودي للعقارات" },
      { name: "description", content: "كل الفواتير المعتمدة والمرسلة إليك من إدارة الرشودي للعقارات." },
      { property: "og:title", content: "فواتيري | بوابة عميل الرشودي للعقارات" },
      { property: "og:description", content: "كل الفواتير المعتمدة والمرسلة إليك من إدارة الرشودي للعقارات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalInvoices,
});

const money = (v: number) =>
  `${Number(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;

const statusChip: Record<string, { label: string; cls: string }> = {
  paid: { label: "مدفوعة", cls: "bg-emerald-50 text-emerald-700" },
  sent: { label: "مرسلة", cls: "bg-amber-50 text-amber-700" },
  unpaid: { label: "بانتظار السداد", cls: "bg-amber-50 text-amber-700" },
  overdue: { label: "متأخرة", cls: "bg-destructive/10 text-destructive" },
  cancelled: { label: "ملغاة", cls: "bg-muted text-muted-foreground" },
};

function PortalInvoices() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-overview"],
    queryFn: () => getPortalOverview(),
  });
  const serviceData = useQuery({ queryKey: ["portal-service-requests"], queryFn: () => getMyServiceRequests() });

  if (isLoading) return <p className="text-sm text-muted-foreground">جاري التحميل…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;

  const all = data?.invoices ?? [];
  const rows = all.filter(
    (i) =>
      (!search || i.invoice_number.includes(search)) &&
      (!status || i.status === status) &&
      (!from || i.issue_date >= from) &&
      (!to || i.issue_date <= to),
  );

  const unpaid = all.filter((i) => i.status !== "paid" && i.status !== "cancelled");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">الفواتير</h1>
        <p className="text-sm text-muted-foreground">كل الفواتير المعتمدة والمرسلة إليك من الإدارة</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">فواتير بانتظار السداد</p>
          <p className="mt-1 text-lg font-bold">{unpaid.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">فواتير مدفوعة</p>
          <p className="mt-1 text-lg font-bold">{all.filter((i) => i.status === "paid").length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">إجمالي المستحق</p>
          <p className="mt-1 text-lg font-bold">{money(unpaid.reduce((s, i) => s + Number(i.total), 0))}</p>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs text-muted-foreground lg:col-span-2">
          بحث
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="رقم الفاتورة"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          الحالة
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">الكل</option>
            <option value="paid">مدفوعة</option>
            <option value="sent">مرسلة</option>
            <option value="unpaid">بانتظار السداد</option>
            <option value="overdue">متأخرة</option>
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          من تاريخ
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          إلى تاريخ
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
      </div>

      <div className="space-y-3">
        {rows.map((i) => {
          const chip = statusChip[i.status] ?? statusChip["unpaid"]!;
          const count = (i as { items?: { count: number }[] }).items?.[0]?.count ?? 0;
          return (
            <article key={i.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4">
              <div>
                <p className="text-[11px] text-muted-foreground">رقم الفاتورة</p>
                <p className="font-bold">{i.invoice_number}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">تاريخ الفاتورة</p>
                <p className="font-semibold">{i.issue_date}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">عدد البنود</p>
                <p className="font-semibold">{count}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">الإجمالي</p>
                <p className="font-semibold">{money(Number(i.total))}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${chip.cls}`}>{chip.label}</span>
              <Link
                to="/portal/invoices/$invoiceId"
                params={{ invoiceId: i.id }}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
              >
                عرض الفاتورة ←
              </Link>
            </article>
          );
        })}

        {rows.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">لا توجد فواتير مطابقة.</p>
        ) : null}
      </div>
      <section className="space-y-3">
        <div><h2 className="text-base font-bold">فواتير شركاء الخدمات</h2><p className="text-xs text-muted-foreground">الفواتير الصادرة من الشركات التي طلبت خدماتها.</p></div>
        {(serviceData.data?.invoices ?? []).map((invoice) => <article key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"><div><p className="font-bold">{invoice.invoice_number}</p><p className="text-xs text-muted-foreground">{invoice.partner?.name ?? "شريك خدمة"}</p></div><p className="font-bold text-primary">{invoice.amount == null ? "المبلغ موضح بالمرفق" : money(Number(invoice.amount))}</p><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">صادرة</span></article>)}
        {!serviceData.data?.invoices.length ? <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">لا توجد فواتير خدمات حتى الآن.</p> : null}
      </section>
    </div>
  );
}
