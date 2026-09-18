import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock, ClipboardCheck, Eye, Home, Megaphone, MapPinned, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Empty, Field, Pill, PortalCard, Progress, Stat, btnGhost, btnPrimary, inputClass, money, num, pct } from "@/components/portal/ui";
import { getOwnerInsights } from "@/lib/owner-portal.functions";
import { createOwnerRequest } from "@/lib/portal.functions";

export const Route = createFileRoute("/portal/units")({
  head: () => ({
    meta: [
      { title: "وحداتي | بوابة المالك" },
      { name: "description", content: "حالة وحدات المالك: الإشغال، الشواغر، طلبات التسويق والمعاينة، الزيارات وتقارير حالة الوحدة." },
      { property: "og:title", content: "وحداتي | بوابة المالك" },
      { property: "og:description", content: "متابعة إشغال الوحدات والشواغر والزيارات وتقارير الحالة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OwnerUnitsPage,
});

const STATUS_LABELS: Record<string, string> = {
  vacant: "شاغرة",
  rented: "مؤجرة",
  reserved: "محجوزة",
  maintenance: "تحت الصيانة",
};

function OwnerUnitsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["owner-insights"], queryFn: () => getOwnerInsights() });
  const [search, setSearch] = useState("");

  const request = useMutation({
    mutationFn: (input: { kind: "marketing" | "maintenance" | "other"; title: string; unitId?: string | null; propertyId?: string | null }) =>
      createOwnerRequest({ data: input }),
    onSuccess: () => {
      toast.success("تم إرسال طلبك للمكتب");
      void qc.invalidateQueries({ queryKey: ["owner-tools"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">جاري التحميل…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const today = new Date().toISOString().slice(0, 10);
  const activeByUnit = new Map(
    data.contracts
      .filter((c) => ["active", "approved"].includes(c.status) && c.unit?.id)
      .map((c) => [c.unit!.id, c] as const),
  );

  const units = data.units.filter((u) =>
    search ? `${u.unit_number} ${u.unit_type ?? ""} ${u.floor ?? ""}`.includes(search) : true,
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="إجمالي الوحدات" value={num(data.summary.unitsCount)} />
        <Stat label="مؤجرة" value={num(data.summary.occupiedUnits)} tone="good" />
        <Stat label="شاغرة" value={num(data.summary.vacantUnits)} tone="warn" />
        <Stat label="نسبة الإشغال" value={pct(data.summary.occupancyRate)} />
      </div>

      <PortalCard
        title="لوحة الوحدات"
        icon={Home}
        subtitle="حالة كل وحدة والمستأجر الحالي وقيمة الإيجار"
        action={
          <span className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={`${inputClass} w-56 pr-9`}
              placeholder="ابحث عن وحدة"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </span>
        }
      >
        {units.length === 0 ? (
          <Empty text="لا توجد وحدات مطابقة." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {units.map((u) => {
              const contract = activeByUnit.get(u.id);
              const occupied = Boolean(contract);
              return (
                <article key={u.id} className="rounded-xl border border-border bg-card p-4">
                  <header className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-[13.5px] font-bold text-foreground">وحدة {u.unit_number}</h4>
                      <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                        {[u.unit_type, u.floor ? `الدور ${u.floor}` : null, u.area ? `${u.area} م²` : null].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <Pill tone={occupied ? "good" : "warn"}>{occupied ? "مؤجرة" : STATUS_LABELS[u.status] ?? "شاغرة"}</Pill>
                  </header>

                  {contract ? (
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
                      <div className="rounded-lg bg-muted/50 p-2">
                        <dt className="text-muted-foreground">المستأجر</dt>
                        <dd className="font-semibold text-foreground">{contract.tenant?.full_name ?? "—"}</dd>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2">
                        <dt className="text-muted-foreground">الإيجار السنوي</dt>
                        <dd className="font-semibold text-foreground">{money(contract.annual_rent)}</dd>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2">
                        <dt className="text-muted-foreground">ينتهي في</dt>
                        <dd className="font-semibold text-foreground">{contract.end_date ?? "—"}</dd>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2">
                        <dt className="text-muted-foreground">رقم العقد</dt>
                        <dd className="font-semibold text-foreground">{contract.contract_number}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="mt-3 rounded-lg border border-dashed border-border p-3 text-[11.5px] text-muted-foreground">
                      هذه الوحدة شاغرة حاليًا — يمكنك طلب تسويقها بضغطة واحدة.
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {!contract ? (
                      <button
                        type="button"
                        className={btnGhost}
                        disabled={request.isPending}
                        onClick={() => request.mutate({ kind: "marketing", title: `طلب تسويق الوحدة ${u.unit_number}`, unitId: u.id })}
                      >
                        <Megaphone className="h-4 w-4" /> اطلب تسويقها
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={btnGhost}
                      disabled={request.isPending}
                      onClick={() => request.mutate({ kind: "other", title: `طلب معاينة ميدانية للوحدة ${u.unit_number}`, unitId: u.id })}
                    >
                      <ClipboardCheck className="h-4 w-4" /> اطلب معاينة ميدانية
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </PortalCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <PortalCard title="تجديدات قادمة" icon={CalendarClock} subtitle="عقود تنتهي خلال 90 يومًا — قرر التجديد أو الزيادة مبكرًا">
          {data.renewals.length === 0 ? (
            <Empty text="لا توجد عقود قاربت على الانتهاء." />
          ) : (
            <ul className="space-y-2">
              {data.renewals.map((c) => (
                <li key={c.id} className="rounded-lg border border-border px-3 py-2 text-[12.5px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">
                      عقد {c.contract_number} — {c.unit?.unit_number ?? c.property?.name ?? ""}
                    </span>
                    <Pill tone={c.daysLeft <= 30 ? "bad" : c.daysLeft <= 60 ? "warn" : "info"}>
                      {c.daysLeft >= 0 ? `متبقٍ ${c.daysLeft} يوم` : "منتهٍ"}
                    </Pill>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[11.5px] text-muted-foreground">
                      المستأجر: {c.tenant?.full_name ?? "—"} · الإيجار {money(c.annual_rent)}
                    </span>
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => request.mutate({ kind: "other", title: `الموافقة على تجديد العقد ${c.contract_number}`, unitId: c.unit?.id ?? null })}
                    >
                      أوافق على التجديد
                    </button>
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => request.mutate({ kind: "marketing", title: `عدم التجديد وتسويق وحدة العقد ${c.contract_number}`, unitId: c.unit?.id ?? null })}
                    >
                      لا أرغب في التجديد
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PortalCard>

        <PortalCard title="سجل الزيارات والمعاينات" icon={Eye} subtitle="من زار وحداتك ومتى وما رأيه">
          {(data.visits ?? []).length === 0 ? (
            <Empty text="لا توجد زيارات مسجلة بعد." />
          ) : (
            <ul className="space-y-2">
              {data.visits.map((v) => (
                <li key={v.id} className="rounded-lg border border-border px-3 py-2 text-[12.5px]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{v.visitor_name}</span>
                    <span className="text-[11px] text-muted-foreground">{v.visit_date}</span>
                  </div>
                  {v.feedback ? <p className="mt-1 text-[11.5px] text-muted-foreground">{v.feedback}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </PortalCard>
      </div>

      <PortalCard title="تقارير حالة الوحدة" icon={MapPinned} subtitle="حالة الوحدة بالصور عند التسليم والإخلاء والجولات الدورية">
        {(data.conditionReports ?? []).length === 0 ? (
          <Empty text="لا توجد تقارير حالة بعد." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.conditionReports.map((r) => (
              <article key={r.id} className="rounded-xl border border-border p-4 text-[12.5px]">
                <div className="flex items-center justify-between">
                  <Pill tone="info">
                    {r.kind === "move_in" ? "تسليم" : r.kind === "move_out" ? "إخلاء" : "جولة دورية"}
                  </Pill>
                  <span className="text-[11px] text-muted-foreground">{r.reported_on}</span>
                </div>
                {r.summary ? <p className="mt-2 text-muted-foreground">{r.summary}</p> : null}
                {(r.images ?? []).length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(r.images ?? []).slice(0, 6).map((src: string) => (
                      <img key={src} src={src} alt="حالة الوحدة" loading="lazy" className="h-16 w-16 rounded-lg object-cover" />
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </PortalCard>

      <PortalCard title="طلب سريع للمكتب" icon={Megaphone} subtitle="اكتب طلبك وسيصل لفريق الإدارة مباشرة">
        <QuickRequest onSend={(title) => request.mutate({ kind: "other", title })} pending={request.isPending} />
      </PortalCard>
    </div>
  );
}

function QuickRequest({ onSend, pending }: { onSend: (title: string) => void; pending: boolean }) {
  const [title, setTitle] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[16rem] flex-1">
        <Field label="نص الطلب">
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: أرغب في رفع إيجار الوحدة 12" />
        </Field>
      </div>
      <button
        type="button"
        className={btnPrimary}
        disabled={pending || title.trim().length < 3}
        onClick={() => {
          onSend(title.trim());
          setTitle("");
        }}
      >
        إرسال الطلب
      </button>
    </div>
  );
}
