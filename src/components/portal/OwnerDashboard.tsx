import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, CalendarCheck, CheckCircle2, LogIn, LogOut } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { OwnerTools } from "@/components/portal/OwnerTools";
import { getOwnerDashboard, markOwnerPaymentPaid } from "@/lib/portal.functions";

const num = (v: number | null | undefined) => Number(v ?? 0).toLocaleString("en-US");
const money = (v: number | null | undefined) => `${num(Math.round(Number(v ?? 0)))} ر.س`;
const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function Card({ children, title, action }: { children: React.ReactNode; title: string; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <h3 className="text-sm font-bold">{title}</h3>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof LogIn; tone: string }) {
  return (
    <article className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 shadow-card">
      <div>
        <p className="text-3xl font-black text-foreground">{num(value)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
    </article>
  );
}

export function OwnerDashboard() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["owner-dashboard"],
    queryFn: () => getOwnerDashboard(),
  });

  const pay = useMutation({
    mutationFn: (paymentId: string) => markOwnerPaymentPaid({ data: { paymentId, note: "تم السداد بواسطة المالك" } }),
    onSuccess: () => {
      toast.success("تم تسجيل السداد.");
      void qc.invalidateQueries({ queryKey: ["owner-dashboard"] });
      void qc.invalidateQueries({ queryKey: ["portal-overview"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "تعذّر تسجيل السداد"),
    onSettled: () => setBusy(null),
  });

  const view = useMemo(() => {
    if (!data) return null;
    const today = new Date().toISOString().slice(0, 10);
    const units = data.units;
    const occupied = units.filter((u) => u.status === "occupied").length;
    const outOfService = units.filter((u) => u.status === "maintenance" || u.status === "out_of_service").length;
    const vacant = Math.max(units.length - occupied - outOfService, 0);

    const byType = new Map<string, { type: string; occupied: number; vacant: number }>();
    for (const u of units) {
      const key = u.unit_type ?? "غير محدد";
      const row = byType.get(key) ?? { type: key, occupied: 0, vacant: 0 };
      if (u.status === "occupied") row.occupied += 1;
      else row.vacant += 1;
      byType.set(key, row);
    }

    const active = data.contracts.filter((c) => c.status === "active");
    const startingToday = data.contracts.filter((c) => c.start_date === today);
    const endingToday = data.contracts.filter((c) => c.end_date === today);

    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const iso = d.toISOString().slice(0, 10);
      const due = data.payments.filter((p) => p.due_date === iso);
      const paid = due.filter((p) => p.status === "paid").length;
      return {
        day: WEEKDAYS[d.getDay()] ?? "",
        value: due.length ? Math.round((paid / due.length) * 100) : units.length ? Math.round((occupied / units.length) * 100) : 0,
      };
    });

    const pending = data.payments
      .filter((p) => p.status !== "paid")
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    const overdue = pending.filter((p) => p.due_date < today);

    const activities = [...data.payments]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 8)
      .map((p) => {
        const contract = data.contracts.find((c) => c.id === p.contract_id);
        return {
          id: p.id,
          title: `${p.status === "paid" ? "سداد" : "دفعة مستحقة"} رقم ${p.payment_number} — ${contract?.unit?.unit_number ? `وحدة ${contract.unit.unit_number}` : (contract?.property?.name ?? "عقد")}`,
          meta: `${p.due_date} • ${money(p.amount_due)}`,
          paid: p.status === "paid",
        };
      });

    return {
      today,
      units,
      occupied,
      vacant,
      outOfService,
      byType: [...byType.values()],
      active,
      startingToday,
      endingToday,
      week,
      pending,
      overdue,
      activities,
      collected: data.payments.reduce((s, p) => s + Number(p.amount_paid), 0),
      remaining: data.payments.reduce((s, p) => s + Math.max(0, Number(p.amount_due) - Number(p.amount_paid)), 0),
    };
  }, [data]);

  if (isLoading) return <p className="text-sm text-muted-foreground">جاري تحميل لوحة المالك…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data || !view) return null;

  const donut = [
    { name: "مشغولة", value: view.occupied, fill: "hsl(var(--destructive))" },
    { name: "شاغرة", value: view.vacant, fill: "hsl(var(--success))" },
    { name: "خارج الخدمة", value: view.outOfService, fill: "hsl(var(--muted-foreground))" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black">لوحة المعلومات</h2>
        <p className="text-xs text-muted-foreground">ملخص مبانيك ووحداتك وعقودك وتحصيلاتك.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="عقود تبدأ اليوم" value={view.startingToday.length} icon={LogIn} tone="bg-success/10 text-success" />
        <Kpi label="عقود تنتهي اليوم" value={view.endingToday.length} icon={LogOut} tone="bg-destructive/10 text-destructive" />
        <Kpi label="العقود القائمة" value={view.active.length} icon={CalendarCheck} tone="bg-primary/10 text-primary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="إشغال الوحدات">
          <div className="h-56">
            {donut.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donut} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {donut.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="pt-16 text-center text-sm text-muted-foreground">لا توجد وحدات مسجلة.</p>
            )}
          </div>
          <table className="mt-3 w-full text-right text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 font-semibold">نوع الوحدة</th>
                <th className="py-1 font-semibold">مشغول</th>
                <th className="py-1 font-semibold">شاغر</th>
              </tr>
            </thead>
            <tbody>
              {view.byType.map((row) => (
                <tr key={row.type} className="border-t border-border">
                  <td className="py-1.5">{row.type}</td>
                  <td className="py-1.5 font-bold text-destructive">{row.occupied}</td>
                  <td className="py-1.5 font-bold text-success">{row.vacant}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="حركة الإشغال والتحصيل الأسبوعية">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={view.week}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="الأنشطة">
          {view.activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد أنشطة بعد.</p>
          ) : (
            <ul className="space-y-2">
              {view.activities.map((a) => (
                <li key={a.id} className="rounded-xl border border-border px-3 py-2">
                  <p className="flex items-center gap-2 text-xs font-semibold text-primary">
                    <Activity className="h-3.5 w-3.5" /> {a.title}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{a.meta}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="حالة الوحدة">
          <ul className="space-y-2 text-sm">
            {[
              { label: "شاغر", value: view.vacant, dot: "bg-success" },
              { label: "مشغول", value: view.occupied, dot: "bg-destructive" },
              { label: "خارج الخدمة", value: view.outOfService, dot: "bg-muted-foreground" },
              { label: "إجمالي الوحدات", value: view.units.length, dot: "bg-primary" },
            ].map((row) => (
              <li key={row.label} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                <span className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${row.dot}`} /> {row.label}
                </span>
                <b>{num(row.value)}</b>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
            <span className="rounded-lg bg-success/10 p-3 text-success">
              <b className="block text-base">{money(view.collected)}</b>المحصّل
            </span>
            <span className="rounded-lg bg-destructive/10 p-3 text-destructive">
              <b className="block text-base">{money(view.remaining)}</b>المتبقي
            </span>
          </div>
        </Card>

        <div className="lg:col-span-2">
          <Card
            title="الدفعات المستحقة"
            action={<span className="text-xs text-muted-foreground">{view.overdue.length} متأخرة</span>}
          >
            {view.pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد دفعات مستحقة.</p>
            ) : (
              <ul className="divide-y divide-border">
                {view.pending.slice(0, 8).map((p) => {
                  const contract = data.contracts.find((c) => c.id === p.contract_id);
                  const late = p.due_date < view.today;
                  return (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                      <div>
                        <p className="font-bold">{money(Number(p.amount_due) - Number(p.amount_paid))}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {contract?.tenant?.full_name ?? "مستأجر"} •{" "}
                          {contract?.unit?.unit_number ? `وحدة ${contract.unit.unit_number}` : (contract?.property?.name ?? "—")} • {p.due_date}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${late ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}
                        >
                          {late ? "متأخرة" : "مستحقة"}
                        </span>
                        <button
                          type="button"
                          disabled={pay.isPending && busy === p.id}
                          onClick={() => {
                            setBusy(p.id);
                            pay.mutate(p.id);
                          }}
                          className="flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-xs font-bold text-success transition hover:bg-success/20 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> تم السداد
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <OwnerTools />
    </div>
  );
}
