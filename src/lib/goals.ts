import { supabase } from "@/integrations/supabase/client";

/** أنواع الأهداف الشهرية للموظفين */
export const goalTypes: { key: string; label: string; unit: string; auto: boolean }[] = [
  { key: "rent", label: "صفقات تأجير", unit: "عقد", auto: true },
  { key: "sale", label: "صفقات بيع", unit: "عقد", auto: true },
  { key: "collection", label: "تحصيل (ريال)", unit: "ريال", auto: true },
  { key: "tasks", label: "مهام مكتملة", unit: "مهمة", auto: true },
  { key: "leads", label: "عملاء جدد", unit: "عميل", auto: true },
  { key: "visits", label: "معاينات", unit: "معاينة", auto: true },
  { key: "custom", label: "هدف يدوي مخصص", unit: "وحدة", auto: false },
];

export function goalLabel(key: string) {
  return goalTypes.find((g) => g.key === key)?.label ?? key;
}

export function monthStart(month: string) {
  return `${month}-01`;
}

export function monthRange(month: string) {
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

export type AutoProgress = {
  rent: number;
  sale: number;
  collection: number;
  tasks: number;
  leads: number;
  visits: number;
};

/** يحسب الإنجاز التلقائي للموظف خلال شهر محدد من بيانات النظام. */
export async function computeAutoProgress(
  employeeId: string,
  month: string,
): Promise<AutoProgress> {
  const { start, end } = monthRange(month);
  const result: AutoProgress = { rent: 0, sale: 0, collection: 0, tasks: 0, leads: 0, visits: 0 };

  const [contractsRes, dealsRes, allContractsRes, assigneesRes, contactsRes, visitsRes] = await Promise.all([
    supabase
      .from("contracts")
      .select("id, contract_type")
      .eq("created_by", employeeId)
      .gte("created_at", start)
      .lt("created_at", end),
    supabase
      .from("property_deal_events")
      .select("id, event_type")
      .eq("employee_id", employeeId)
      .gte("event_date", start.slice(0, 10))
      .lt("event_date", end.slice(0, 10))
      .in("event_type", ["rent", "sale"]),
    supabase.from("contracts").select("id").eq("created_by", employeeId).limit(500),
    supabase
      .from("task_assignees")
      .select("task:task_id(status, submitted_at)")
      .eq("user_id", employeeId),
    supabase
      .from("contacts")
      .select("id")
      .eq("created_by", employeeId)
      .gte("created_at", start)
      .lt("created_at", end),
    supabase
      .from("unit_visits")
      .select("id")
      .eq("created_by", employeeId)
      .gte("created_at", start)
      .lt("created_at", end),
  ]);

  for (const row of contractsRes.data ?? []) {
    if (row.contract_type === "sale") result.sale += 1;
    else result.rent += 1;
  }
  for (const row of dealsRes.data ?? []) {
    if (row.event_type === "sale") result.sale += 1;
    else result.rent += 1;
  }

  result.leads = (contactsRes.data ?? []).length;
  result.visits = (visitsRes.data ?? []).length;

  for (const row of assigneesRes.data ?? []) {
    const task = (Array.isArray(row.task) ? row.task[0] : row.task) as {
      status: string;
      submitted_at: string | null;
    } | null;
    if (!task?.submitted_at) continue;
    if (!["done", "approved"].includes(task.status)) continue;
    if (task.submitted_at >= start && task.submitted_at < end) result.tasks += 1;
  }

  const contractIds = (allContractsRes.data ?? []).map((c) => c.id);
  if (contractIds.length) {
    const { data: payments } = await supabase
      .from("contract_payments")
      .select("amount_paid, updated_at")
      .in("contract_id", contractIds)
      .gte("updated_at", start)
      .lt("updated_at", end);
    result.collection = (payments ?? []).reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
  }

  return result;
}

export type GoalRow = {
  id: string;
  employee_id: string;
  period_month: string;
  goal_type: string;
  target_value: number;
  achieved_value: number;
  auto_track: boolean;
  points_per_unit: number;
  notes: string | null;
};

/** القيمة المعتمدة للإنجاز: تلقائية أو يدوية. */
export function effectiveAchieved(goal: GoalRow, auto: AutoProgress) {
  if (goal.auto_track && goal.goal_type in auto)
    return Number((auto as Record<string, number>)[goal.goal_type] ?? 0);
  return Number(goal.achieved_value || 0);
}

/** النقاط المكتسبة = نسبة الإنجاز × نقاط الهدف (بحد أقصى 150%). */
export function goalPoints(goal: GoalRow, auto: AutoProgress) {
  const achieved = effectiveAchieved(goal, auto);
  const target = Number(goal.target_value || 0);
  if (!target) return 0;
  const ratio = Math.min(1.5, achieved / target);
  return Math.round(ratio * Number(goal.points_per_unit || 0));
}
