import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { getPortalOverview } from "@/lib/portal.functions";

export const Route = createFileRoute("/portal/")({
  head: () => ({
    meta: [
      { title: "بوابة العميل | الرشودي للعقارات" },
      { name: "description", content: "تابع عقودك وفواتيرك وأقساطك مع الرشودي للعقارات." },
      { property: "og:title", content: "بوابة العميل | الرشودي للعقارات" },
      { property: "og:description", content: "تابع عقودك وفواتيرك وأقساطك مع الرشودي للعقارات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalHome,
});

const money = (v: number | null | undefined) =>
  `${Number(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;
const num = (v: number | null | undefined) => Number(v ?? 0).toLocaleString("en-US");

function Counter({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 text-center">
      <p className={`text-xl font-extrabold ${tone ?? "text-foreground"}`}>{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function PortalHome() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-overview"],
    queryFn: () => getPortalOverview(),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">جاري التحميل…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const today = new Date().toISOString().slice(0, 10);
  const pending = data.payments.filter((p) => p.status !== "paid");
  const overdue = pending.filter((p) => p.due_date < today);
  const upcoming = pending.filter((p) => p.due_date >= today);
  const soon = [...overdue, ...upcoming].slice(0, 5);
  const remaining = data.payments.reduce((s, p) => s + Math.max(0, Number(p.amount_due) - Number(p.amount_paid)), 0);
  const paid = data.payments.reduce((s, p) => s + Number(p.amount_paid), 0);
  const days = (d: string) => Math.round((new Date(d).getTime() - new Date(today).getTime()) / 86400000);

  const contracts = data.contracts as unknown as {
    id: string;
    contract_number: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    annual_rent: number | null;
    property: { name: string; city: string | null; district: string | null } | null;
    unit: { unit_number: string | null; unit_type: string | null } | null;
    tenant: { full_name: string } | null;
  }[];

  return (
    <div className="space-y-5">
      {/* بطاقة العميل */}
      <section className="overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-primary-foreground/20 text-lg font-bold">
              {(data.contact?.full_name ?? "ع").slice(0, 1)}
            </span>
            <div>
              <h1 className="text-lg font-bold">{data.contact?.full_name ?? "مرحبًا"}</h1>
              <span className="mt-1 inline-block rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-100">
                • نشط
              </span>
            </div>
          </div>
          <div className="rounded-xl bg-foreground/15 px-4 py-3 text-xs leading-6">
            <p className="text-primary-foreground/70">رقم الهوية</p>
            <p className="font-bold" dir="ltr">{data.contact?.national_id ?? "—"}</p>
            <p className="mt-1 text-primary-foreground/70">الجوال</p>
            <p className="font-bold" dir="ltr">{data.contact?.phone ?? "—"}</p>
          </div>
        </div>
      </section>

      {overdue.length ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive">
          ⚠ {overdue.length} دفعات متأخرة بقيمة{" "}
          {num(overdue.reduce((s, p) => s + (Number(p.amount_due) - Number(p.amount_paid)), 0))} ر.س — يرجى التواصل مع الإدارة.
        </div>
      ) : null}
      {upcoming.length ? (
        <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary">
          ⏰ {upcoming.length} دفعات مستحقة قريبًا بقيمة{" "}
          {num(upcoming.reduce((s, p) => s + (Number(p.amount_due) - Number(p.amount_paid)), 0))} ر.س.
        </div>
      ) : null}

      {/* أقرب الدفعات */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-5 py-3 text-sm font-bold">
          <span>📅 أقرب الدفعات</span>
          <Link to="/portal/contracts" className="text-xs font-semibold text-primary">عرض الكل ←</Link>
        </header>
        {soon.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">لا توجد دفعات قادمة.</p>
        ) : (
          <ul className="divide-y divide-border">
            {soon.map((p) => {
              const late = p.due_date < today;
              const d = days(p.due_date);
              return (
                <li
                  key={p.id}
                  className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm ${late ? "bg-destructive/5" : "bg-primary/5"}`}
                >
                  <span className="font-bold">{num(Number(p.amount_due) - Number(p.amount_paid))} ر.س</span>
                  <span className="text-muted-foreground">دفعة رقم {p.payment_number}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.due_date} • {late ? `متأخرة منذ ${Math.abs(d)} يوم` : `تستحق بعد ${d} يوم`}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${late ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}
                  >
                    {late ? "متأخرة" : "مستحقة قريبًا"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {data.isOwner ? (
        <section className="space-y-3">
          <div><h2 className="text-base font-bold">محفظة المالك</h2><p className="text-xs text-muted-foreground">المباني والوحدات والعقارات المسجلة باسمك.</p></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.buildings.map((building) => {
              const units = data.units.filter((unit) => unit.building_id === building.id);
              const occupied = units.filter((unit) => unit.status === "occupied").length;
              return <article key={building.id} className="rounded-xl border border-border bg-card p-4 shadow-card"><div className="flex items-center justify-between"><h3 className="font-bold">{building.name}</h3><span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{units.length} وحدة</span></div><p className="mt-1 text-xs text-muted-foreground">{[building.district, building.city, building.address].filter(Boolean).join("، ") || "—"}</p><div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs"><span className="rounded-lg bg-success/10 p-2 text-success"><b className="block text-base">{occupied}</b>مشغولة</span><span className="rounded-lg bg-muted p-2"><b className="block text-base">{Math.max(units.length - occupied, 0)}</b>شاغرة</span></div></article>;
            })}
          </div>
        </section>
      ) : null}

      {/* عدادات */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Counter label="عقد" value={contracts.length} />
        <Counter label="وحدة" value={new Set(contracts.map((c) => c.unit?.unit_number).filter(Boolean)).size} />
        <Counter label="فاتورة" value={data.invoices.length} />
        <Counter label="قسط نشط" value={pending.length} tone="text-amber-600" />
        <Counter label="مسددة" value={data.payments.filter((p) => p.status === "paid").length} tone="text-emerald-600" />
        <Counter label="متأخرة" value={overdue.length} tone="text-destructive" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">إجمالي المدفوع</p>
          <p className="mt-1 text-xl font-extrabold text-emerald-600">{money(paid)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">إجمالي المتبقي</p>
          <p className={`mt-1 text-xl font-extrabold ${remaining ? "text-destructive" : "text-foreground"}`}>{money(remaining)}</p>
        </div>
      </div>

      {/* العقارات والوحدات */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold">🏢 العقارات والوحدات</h2>
        {contracts.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">لا توجد عقارات مرتبطة بك.</p>
        ) : (
          contracts.map((c) => {
            const own = data.payments.filter((p) => p.contract_id === c.id);
            const late = own.filter((p) => p.status !== "paid" && p.due_date < today).length;
            return (
              <article key={c.id} className="overflow-hidden rounded-2xl border border-border bg-card border-r-4 border-r-primary">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
                  <div>
                    <p className="text-sm font-bold">{c.property?.name ?? "عقار"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {[c.property?.city, c.property?.district].filter(Boolean).join(" — ") || "—"}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold">
                    {c.unit?.unit_number ? `${c.unit.unit_type ?? "شقة"} — وحدة ${c.unit.unit_number}` : "بدون وحدة"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs">
                  <span className="text-muted-foreground">المستأجر: <b className="text-foreground">{c.tenant?.full_name ?? "—"}</b></span>
                  <span className="text-muted-foreground">ينتهي في: <b className="text-foreground">{c.end_date ?? "—"}</b></span>
                  <span
                    className={`rounded-full px-2.5 py-1 font-semibold ${late ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}
                  >
                    {late ? `يوجد ${late} دفعة متأخرة` : "لا توجد دفعات متأخرة"}
                  </span>
                  <Link
                    to="/portal/contracts/$contractId"
                    params={{ contractId: c.id }}
                    className="rounded-lg border border-primary/30 px-3 py-1.5 font-semibold text-primary hover:bg-primary/5"
                  >
                    جدول الأقساط ←
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
