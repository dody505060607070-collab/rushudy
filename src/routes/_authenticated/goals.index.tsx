import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Target } from "lucide-react";

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
          const auto = rows.length ? await computeAutoProgress(emp.id, month) : {};
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

  return (
    <div className="space-y-6" dir="rtl">
      <PageHero
        title="أهداف الموظفين"
        subtitle="اختر الموظف لفتح صفحته وإضافة أهدافه الشهرية ومتابعة نقاطه."
        icon={Target}
        stats={[
          { value: String(rows.length), label: "موظف" },
          { value: String(rows.filter((r) => r.goals > 0).length), label: "لديه أهداف هذا الشهر" },
          { value: String(totalPoints), label: "إجمالي النقاط" },
        ]}
      />

      <div className="flex items-center justify-between gap-3">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className={`${inputClass} max-w-[200px]`}
          aria-label="الشهر"
        />
        {isLoading ? <span className="text-[13px] text-muted-foreground">جارٍ الحساب…</span> : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState text="لا يوجد موظفون نشطون" hint="أضف موظفًا من صفحة الموظفين أولًا." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((emp) => (
            <Link
              key={emp.id}
              to="/goals/$employeeId"
              params={{ employeeId: emp.id }}
              className="group rounded-2xl border border-border bg-card p-5 shadow-card transition-colors hover:border-primary"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-bold text-foreground">{emp.full_name}</h2>
                  <p className="text-[12px] text-muted-foreground">{emp.job_title ?? "موظف"}</p>
                </div>
                <Chip tone={emp.pct >= 100 ? "success" : emp.pct >= 50 ? "info" : "warning"}>
                  {emp.pct}%
                </Chip>
              </div>
              <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={emp.pct >= 100 ? "h-full bg-success" : "h-full bg-primary"}
                  style={{ width: `${emp.pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                <span>{emp.goals} هدف هذا الشهر</span>
                <span className="font-semibold text-foreground">{emp.points} نقطة</span>
              </div>
              <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-primary">
                فتح صفحة الموظف <ArrowLeft className="size-3.5" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
