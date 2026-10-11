import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, CircleCheck, Eye, Star, Target, User, Users } from "lucide-react";

import { Chip } from "@/components/kit/Chip";
import { EmptyState } from "@/components/kit/LiveTable";
import { inputClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";
import {
  computeAutoProgress,
  effectiveAchieved,
  goalPoints,
  monthStart,
  type GoalRow,
} from "@/lib/goals";
import { useState } from "react";

const TITLE = "أهداف الموظفين | الرشودي للعقارات";
const DESC = "قائمة الموظفين وأهدافهم الشهرية ونقاطهم المحتسبة تلقائيًا من عمل النظام.";

export const Route = createFileRoute("/_authenticated/goals/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GoalsIndexPage,
});

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function GoalsIndexPage() {
  const [month, setMonth] = useState(currentMonth());
  const period = monthStart(month);

  const { data: employees = [] } = useQuery({
    queryKey: ["goal-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, job_title, phone, is_active")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: summary = [], isLoading } = useQuery({
    queryKey: ["goals-summary", period, employees.map((e) => e.id).join(",")],
    enabled: employees.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_goals")
        .select(
          "id, employee_id, period_month, goal_type, target_value, achieved_value, auto_track, points_per_unit, notes",
        )
        .eq("period_month", period);
      if (error) throw error;
      const goals = (data ?? []) as GoalRow[];
      return Promise.all(
        employees.map(async (emp) => {
          const rows = goals.filter((g) => g.employee_id === emp.id);
          const auto = await computeAutoProgress(emp.id, month);
          const target = rows.reduce((s, g) => s + Number(g.target_value || 0), 0);
          const achieved = rows.reduce((s, g) => s + effectiveAchieved(g, auto), 0);
          const points = rows.reduce((s, g) => s + goalPoints(g, auto), 0);
          return {
            ...emp,
            goals: rows.length,
            pct: target ? Math.min(100, Math.round((achieved / target) * 100)) : 0,
            points,
          };
        }),
      );
    },
  });

  const rows = summary.length
    ? summary
    : employees.map((e) => ({ ...e, goals: 0, pct: 0, points: 0 }));
  const totalPoints = rows.reduce((s, r) => s + r.points, 0);

  const shiftMonth = (delta: number) => {
    const [y = 2026, m = 1] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString("ar-SA-u-ca-gregory", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6" dir="rtl">
      <PageHero
        title="أهداف الموظفين"
        subtitle="متابعة وتحقيق الأهداف الشهرية لفريق العمل — اختر الموظف لفتح صفحته."
        icon={Target}
        stats={[
          { value: String(rows.length), label: "إجمالي الموظفين", icon: Users },
          { value: String(rows.filter((r) => r.goals > 0).length), label: "لديه أهداف هذا الشهر", icon: CircleCheck },
          { value: String(totalPoints), label: "إجمالي النقاط", icon: Star },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="grid size-9 place-items-center rounded-lg hover:bg-muted"
            aria-label="الشهر السابق"
          >
            <ChevronRight className="size-4" />
          </button>
          <label className="relative min-w-[140px] text-center text-[14px] font-bold text-foreground">
            {monthLabel}
            <input
              type="month"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="الشهر"
            />
          </label>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="grid size-9 place-items-center rounded-lg hover:bg-muted"
            aria-label="الشهر التالي"
          >
            <ChevronLeft className="size-4" />
          </button>
        </div>
        {isLoading ? <span className="text-[13px] text-muted-foreground">جارٍ الحساب…</span> : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState text="لا يوجد موظفون نشطون" hint="أضف موظفًا من صفحة الموظفين أولًا." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((emp) => (
            <div
              key={emp.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-card transition-colors hover:border-primary/40"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                    <User className="size-6" />
                  </span>
                  <div>
                    <h2 className="text-[15px] font-bold text-foreground">{emp.full_name}</h2>
                    <p className="text-[12px] text-muted-foreground">{emp.job_title ?? "موظف"}</p>
                  </div>
                </div>
                <Chip tone="success">نشط</Chip>
              </div>
              <div className="mb-4 grid grid-cols-3 gap-2">
                {[
                  { label: "الأهداف", value: String(emp.goals), icon: Target },
                  { label: "الإنجاز", value: `${emp.pct}%`, icon: CircleCheck },
                  { label: "النقاط", value: String(emp.points), icon: Star },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-muted/50 p-2.5 text-center">
                    <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                      <s.icon className="size-3.5" /> {s.label}
                    </p>
                    <p className="mt-1 text-[17px] font-extrabold text-primary">{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="mb-4 flex items-center gap-3">
                <span className="text-[11.5px] text-muted-foreground">نسبة الإنجاز الكلية</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={emp.pct >= 100 ? "h-full bg-success" : "h-full bg-primary"}
                    style={{ width: `${emp.pct}%` }}
                  />
                </div>
                <span className="text-[13px] font-bold text-primary">{emp.pct}%</span>
              </div>
              <div className="mb-4 flex items-center justify-between rounded-xl bg-[color:var(--warning)]/15 px-4 py-3">
                <span className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <Star className="size-5 fill-[color:var(--warning)] text-[color:var(--warning)]" />
                  النقاط المكتسبة
                </span>
                <span className="text-[18px] font-extrabold text-foreground">{emp.points}</span>
              </div>
              <Link
                to="/goals/$employeeId"
                params={{ employeeId: emp.id }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[13px] font-bold text-primary-foreground hover:opacity-90"
              >
                <Eye className="size-4" /> عرض أهداف الموظف
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
