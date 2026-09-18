import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Target, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { EmptyState } from "@/components/kit/LiveTable";
import { Field, GhostButton, Modal, PrimaryButton, inputClass, textareaClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";

const TITLE = "أهداف الموظفين | الرشودي للعقارات";
const DESC = "لوحة أهداف شهرية لكل موظف مع نسبة الإنجاز في التأجير والبيع والتحصيل والمهام.";

export const Route = createFileRoute("/_authenticated/goals")({
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
  component: GoalsPage,
});

const goalTypes: { key: string; label: string }[] = [
  { key: "rent", label: "صفقات تأجير" },
  { key: "sale", label: "صفقات بيع" },
  { key: "collection", label: "تحصيل (ريال)" },
  { key: "tasks", label: "مهام مكتملة" },
  { key: "leads", label: "عملاء جدد" },
  { key: "visits", label: "معاينات" },
];

type Goal = {
  id: string;
  employee_id: string;
  period_month: string;
  goal_type: string;
  target_value: number;
  achieved_value: number;
  notes: string | null;
  employee: { full_name: string } | null;
};

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function GoalsPage() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(monthKey().slice(0, 7));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    employee_id: "",
    goal_type: "rent",
    target_value: "",
    achieved_value: "0",
    notes: "",
  });

  const period = `${month}-01`;

  const { data: employees = [] } = useQuery({
    queryKey: ["goal-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, job_title")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ["employee-goals", period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_goals")
        .select("id, employee_id, period_month, goal_type, target_value, achieved_value, notes, employee:employee_id(full_name)")
        .eq("period_month", period)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Goal[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.employee_id) throw new Error("اختر الموظف");
      const { error } = await supabase.from("employee_goals").upsert(
        {
          employee_id: form.employee_id,
          period_month: period,
          goal_type: form.goal_type,
          target_value: Number(form.target_value || 0),
          achieved_value: Number(form.achieved_value || 0),
          notes: form.notes || null,
        },
        { onConflict: "employee_id,period_month,goal_type" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ الهدف");
      setOpen(false);
      setForm({ employee_id: "", goal_type: "rent", target_value: "", achieved_value: "0", notes: "" });
      qc.invalidateQueries({ queryKey: ["employee-goals", period] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateAchieved = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number }) => {
      const { error } = await supabase.from("employee_goals").update({ achieved_value: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employee-goals", period] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employee_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["employee-goals", period] });
    },
  });

  const byEmployee = useMemo(() => {
    const map = new Map<string, { name: string; rows: Goal[] }>();
    for (const goal of goals) {
      const key = goal.employee_id;
      if (!map.has(key)) map.set(key, { name: goal.employee?.full_name ?? "موظف", rows: [] });
      map.get(key)!.rows.push(goal);
    }
    return [...map.values()];
  }, [goals]);

  const totalTarget = goals.reduce((sum, g) => sum + Number(g.target_value || 0), 0);
  const totalAchieved = goals.reduce((sum, g) => sum + Number(g.achieved_value || 0), 0);
  const overall = totalTarget ? Math.round((totalAchieved / totalTarget) * 100) : 0;

  return (
    <div className="space-y-6" dir="rtl">
      <PageHero
        title="لوحة أهداف الموظفين"
        subtitle="حدد هدفًا شهريًا لكل موظف وتابع نسبة الإنجاز أولًا بأول."
        icon={Target}
        stats={[
          { value: String(byEmployee.length), label: "موظف بأهداف" },
          { value: String(goals.length), label: "هدف هذا الشهر" },
          { value: `${overall}%`, label: "الإنجاز العام" },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className={`${inputClass} max-w-[200px]`}
        />
        <PrimaryButton onClick={() => setOpen(true)}>
          <Plus className="size-4" /> هدف جديد
        </PrimaryButton>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">جارٍ التحميل…</div>
      ) : byEmployee.length === 0 ? (
        <EmptyState text="لا توجد أهداف لهذا الشهر" hint="أضف هدفًا لكل موظف لمتابعة إنجازه." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {byEmployee.map((group) => {
            const t = group.rows.reduce((s, g) => s + Number(g.target_value || 0), 0);
            const a = group.rows.reduce((s, g) => s + Number(g.achieved_value || 0), 0);
            const pct = t ? Math.min(100, Math.round((a / t) * 100)) : 0;
            return (
              <section key={group.name} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <header className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-foreground">{group.name}</h2>
                  <Chip tone={pct >= 100 ? "success" : pct >= 50 ? "info" : "warning"}>{pct}% إنجاز</Chip>
                </header>
                <div className="space-y-4">
                  {group.rows.map((goal) => {
                    const p = goal.target_value
                      ? Math.min(100, Math.round((Number(goal.achieved_value) / Number(goal.target_value)) * 100))
                      : 0;
                    return (
                      <div key={goal.id} className="space-y-2">
                        <div className="flex items-center justify-between gap-2 text-[13px]">
                          <span className="font-semibold text-foreground">
                            {goalTypes.find((g) => g.key === goal.goal_type)?.label ?? goal.goal_type}
                          </span>
                          <span className="text-muted-foreground">
                            {Number(goal.achieved_value).toLocaleString("ar-EG")} / {Number(goal.target_value).toLocaleString("ar-EG")}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={p >= 100 ? "h-full bg-success" : "h-full bg-primary"}
                            style={{ width: `${p}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            defaultValue={Number(goal.achieved_value)}
                            onBlur={(e) => {
                              const value = Number(e.target.value || 0);
                              if (value !== Number(goal.achieved_value)) updateAchieved.mutate({ id: goal.id, value });
                            }}
                            className={`${inputClass} h-8 max-w-[140px] text-[12px]`}
                            aria-label="تحديث المنجز"
                          />
                          <button
                            type="button"
                            onClick={() => remove.mutate(goal.id)}
                            className="text-muted-foreground transition-colors hover:text-destructive"
                            aria-label="حذف الهدف"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="هدف شهري جديد"
        subtitle="سيُحفظ الهدف على الشهر المحدد في الأعلى."
        footer={
          <>
            <GhostButton onClick={() => setOpen(false)}>إلغاء</GhostButton>
            <PrimaryButton onClick={() => save.mutate()} disabled={save.isPending}>
              حفظ الهدف
            </PrimaryButton>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الموظف" required>
            <select
              value={form.employee_id}
              onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
              className={inputClass}
            >
              <option value="">اختر الموظف</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="نوع الهدف" required>
            <select
              value={form.goal_type}
              onChange={(e) => setForm({ ...form, goal_type: e.target.value })}
              className={inputClass}
            >
              {goalTypes.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="القيمة المستهدفة" required>
            <input
              type="number"
              value={form.target_value}
              onChange={(e) => setForm({ ...form, target_value: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="المنجز حتى الآن">
            <input
              type="number"
              value={form.achieved_value}
              onChange={(e) => setForm({ ...form, achieved_value: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="ملاحظات" className="sm:col-span-2">
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={textareaClass}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
