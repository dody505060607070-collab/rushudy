import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { getPortalOverview } from "@/lib/portal.functions";

export const Route = createFileRoute("/portal/contracts/")({
  head: () => ({
    meta: [
      { title: "عقودي | بوابة عميل الرشودي للعقارات" },
      { name: "description", content: "استعرض عقودك الإيجارية وجدول الأقساط الخاص بكل عقد." },
      { property: "og:title", content: "عقودي | بوابة عميل الرشودي للعقارات" },
      { property: "og:description", content: "استعرض عقودك الإيجارية وجدول الأقساط الخاص بكل عقد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalContracts,
});

const cycleLabel: Record<string, string> = {
  monthly: "شهري",
  quarterly: "ربع سنوي",
  semiannual: "نصف سنوي",
  semi_annual: "نصف سنوي",
  annual: "سنوي",
};

function PortalContracts() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["portal-overview"],
    queryFn: () => getPortalOverview(),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">جاري التحميل…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;

  const contracts = (data?.contracts ?? []) as unknown as {
    id: string;
    contract_number: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    annual_rent: number | null;
    payment_cycle: string | null;
    property: { name: string; city: string | null; district: string | null } | null;
    unit: { unit_number: string | null; unit_type: string | null } | null;
    tenant: { full_name: string } | null;
  }[];
  const payments = data?.payments ?? [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">العقود</h1>
        <p className="text-sm text-muted-foreground">جميع عقوداتك الإيجارية — عرض فقط.</p>
      </div>

      {contracts.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">لا توجد عقود مسجّلة باسمك.</p>
      ) : null}

      {contracts.map((c) => {
        const own = payments.filter((p) => p.contract_id === c.id);
        const paid = own.filter((p) => p.status === "paid").length;
        const late = own.filter((p) => p.status !== "paid" && p.due_date < today).length;
        const rest = own.length - paid - late;
        return (
          <article key={c.id} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[11px] text-muted-foreground">رقم العقد</p>
                <p className="text-base font-bold">{c.contract_number}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                • {c.status === "active" ? "نشط" : c.status}
              </span>
            </div>

            <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-[11px] text-muted-foreground">العقار / الوحدة</p>
                <p className="font-semibold">{c.property?.name ?? "لم يُسجَّل اسم العقار بعد"}</p>
                <p className="text-xs text-muted-foreground">
                  {c.unit?.unit_number ? `${c.unit.unit_type ?? "شقة"} — وحدة ${c.unit.unit_number}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">المستأجر</p>
                <p className="font-semibold">{c.tenant?.full_name ?? "—"}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">الإيجار السنوي</p>
                <p className="font-semibold">{Number(c.annual_rent ?? 0).toLocaleString("en-US")} ر.س</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">تاريخ البداية</p>
                <p className="font-semibold">{c.start_date ?? "—"}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">تاريخ الانتهاء</p>
                <p className="font-semibold">{c.end_date ?? "—"}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">دورة الدفع</p>
                <p className="font-semibold">{cycleLabel[c.payment_cycle ?? ""] ?? c.payment_cycle ?? "غير مسجل"}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="flex flex-wrap gap-3 text-muted-foreground">
                <span>مسددة {paid}</span>
                {rest > 0 ? <span className="text-amber-600">قادمة {rest}</span> : null}
                {late > 0 ? <span className="text-destructive">متأخرة {late}</span> : null}
              </span>
              <Link
                to="/portal/contracts/$contractId"
                params={{ contractId: c.id }}
                className="rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"
              >
                جدول الأقساط ←
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
