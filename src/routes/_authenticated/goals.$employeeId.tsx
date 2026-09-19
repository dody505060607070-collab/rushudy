import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Plus, Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { EmptyState } from "@/components/kit/LiveTable";
import {
  Field,
  GhostButton,
  Modal,
  PrimaryButton,
  inputClass,
  textareaClass,
} from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { supabase } from "@/integrations/supabase/client";
import {
  computeAutoProgress,
  effectiveAchieved,
  goalPoints,
  goalTypes,
  monthStart,
  type GoalRow,
} from "@/lib/goals";

const TITLE = "صفحة الموظف وأهدافه | الرشودي للعقارات";
const DESC = "بيانات الموظف وأهدافه الشهرية ونسب الإنجاز والنقاط المحتسبة تلقائيًا.";

export const Route = createFileRoute("/_authenticated/goals/$employeeId")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmployeeGoalsPage,
});

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const emptyAuto = { rent: 0, sale: 0, collection: 0, tasks: 0, leads: 0, visits: 0 };

const emptyForm = {
  goal_type: "rent",
  target_value: "",
  achieved_value: "0",
  points_per_unit: "10",
  auto_track: true,
  notes: "",
};

function EmployeeGoalsPage() {
  const { employeeId } = Route.useParams();
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const period = monthStart(month);

  const { data: employee } = useQuery({
    queryKey: ["employee-profile", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, whatsapp, job_title, hire_date, is_active")
        .eq("id", employeeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ["employee-goals", employeeId, period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_goals")
        .select(
          "id, employee_id, period_month, goal_type, target_value, achieved_value, auto_track, points_per_unit, notes",
        )
        .eq("employee_id", employeeId)
        .eq("period_month", period)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as GoalRow[];
    },
  });

  const { data: auto = emptyAuto } = useQuery({
    queryKey: ["employee-auto-progress", employeeId, month],
    queryFn: () => computeAutoProgress(employeeId, month),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["employee-goals", employeeId, period] });
    qc.invalidateQueries({ queryKey: ["goals-summary"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.target_value) throw new Error("اكتب القيمة المستهدفة");
      const { error } = await supabase.from("employee_goals").upsert(
        {
          employee_id: employeeId,
          period_month: period,
          goal_type: form.goal_type,
          target_value: Number(form.target_value || 0),
          achieved_value: Number(form.achieved_value || 0),
          auto_track: form.auto_track,
          points_per_unit: Number(form.points_per_unit || 0),
          notes: form.notes || null,
        },
        { onConflict: "employee_id,period_month,goal_type" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ الهدف");
      setOpen(false);
      setForm(emptyForm);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<GoalRow> }) => {
      const { error } = await supabase.from("employee_goals").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employee_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الهدف");
      invalidate();
    },
  });

  const totalTarget = goals.reduce((s, g) => s + Number(g.target_value || 0), 0);
  const totalAchieved = goals.reduce((s, g) => s + effectiveAchieved(g, auto), 0);
  const totalPoints = goals.reduce((s, g) => s + goalPoints(g, auto), 0);
  const overall = totalTarget ? Math.min(100, Math.round((totalAchieved / totalTarget) * 100)) : 0;

  return (
    <div className="space-y-6" dir="rtl">
      <PageHero
        title={employee?.full_name ?? "صفحة الموظف"}
        subtitle={`${employee?.job_title ?? "موظف"} — أهداف شهرية يدوية مع احتساب تلقائي للإنجاز والنقاط.`}
        icon={Target}
        stats={[
          { value: String(goals.length), label: "هدف هذا الشهر" },
          { value: `${overall}%`, label: "الإنجاز العام" },
          { value: String(totalPoints), label: "النقاط" },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/goals"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary"
        >
          <ArrowRight className="size-4" /> كل الموظفين
        </Link>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className={`${inputClass} max-w-[190px]`}
            aria-label="الشهر"
          />
          <PrimaryButton onClick={() => setOpen(true)}>
            <Plus className="size-4" /> هدف جديد
          </PrimaryButton>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-4 text-[14px] font-bold text-foreground">بيانات الموظف</h2>
        <div className="grid gap-3 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
          <InfoRow label="الاسم" value={employee?.full_name} />
          <InfoRow label="المسمى الوظيفي" value={employee?.job_title} />
          <InfoRow label="البريد" value={employee?.email} ltr />
          <InfoRow label="الجوال" value={employee?.phone} ltr />
          <InfoRow label="الواتساب" value={employee?.whatsapp} ltr />
          <InfoRow label="تاريخ التعيين" value={employee?.hire_date} ltr />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip tone={employee?.is_active ? "success" : "neutral"}>
            {employee?.is_active ? "نشط" : "موقوف"}
          </Chip>
          <Link
            to="/employee-form"
            search={{ id: employeeId }}
            className="text-[12px] font-semibold text-primary"
          >
            تعديل بيانات الموظف
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-1 text-[14px] font-bold text-foreground">الإنجاز التلقائي من النظام</h2>
        <p className="mb-4 text-[12px] text-muted-foreground">
          يُحتسب من عمل الموظف الفعلي داخل النظام خلال الشهر المحدد.
        </p>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {goalTypes
            .filter((g) => g.auto)
            .map((g) => (
              <div key={g.key} className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-[11px] text-muted-foreground">{g.label}</p>
                <p className="text-[16px] font-bold text-foreground">
                  {Number((auto as Record<string, number>)[g.key] ?? 0).toLocaleString("ar-EG")}
                </p>
              </div>
            ))}
        </div>
      </section>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          جارٍ التحميل…
        </div>
      ) : goals.length === 0 ? (
        <EmptyState
          text="لا توجد أهداف لهذا الشهر"
          hint="اضغط «هدف جديد» واكتب أهداف الموظف الشهرية."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {goals.map((goal) => {
            const achieved = effectiveAchieved(goal, auto);
            const pct = goal.target_value
              ? Math.min(100, Math.round((achieved / Number(goal.target_value)) * 100))
              : 0;
            return (
              <article
                key={goal.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-card"
              >
                <header className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[14px] font-bold text-foreground">
                      {goalTypes.find((g) => g.key === goal.goal_type)?.label ?? goal.goal_type}
                    </h3>
                    <p className="text-[12px] text-muted-foreground">
                      {achieved.toLocaleString("ar-EG")} /{" "}
                      {Number(goal.target_value).toLocaleString("ar-EG")}
                      {" — "}
                      {goalPoints(goal, auto)} نقطة
                    </p>
                  </div>
                  <Chip tone={pct >= 100 ? "success" : pct >= 50 ? "info" : "warning"}>{pct}%</Chip>
                </header>
                <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={pct >= 100 ? "h-full bg-success" : "h-full bg-primary"}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {goal.notes ? (
                  <p className="mb-3 text-[12px] text-muted-foreground">{goal.notes}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={goal.auto_track}
                      onChange={(e) =>
                        patch.mutate({ id: goal.id, values: { auto_track: e.target.checked } })
                      }
                    />
                    احتساب تلقائي
                  </label>
                  {!goal.auto_track ? (
                    <input
                      type="number"
                      defaultValue={Number(goal.achieved_value)}
                      onBlur={(e) => {
                        const value = Number(e.target.value || 0);
                        if (value !== Number(goal.achieved_value))
                          patch.mutate({ id: goal.id, values: { achieved_value: value } });
                      }}
                      className={`${inputClass} h-8 max-w-[130px] text-[12px]`}
                      aria-label="تحديث المنجز يدويًا"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => remove.mutate(goal.id)}
                    className="ms-auto text-muted-foreground transition-colors hover:text-destructive"
                    aria-label="حذف الهدف"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="هدف شهري جديد"
        subtitle="اكتب الهدف بنفسك، واختر إن كان الإنجاز يُحتسب تلقائيًا من النظام."
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
          <Field label="نوع الهدف" required>
            <select
              value={form.goal_type}
              onChange={(e) =>
                setForm({
                  ...form,
                  goal_type: e.target.value,
                  auto_track: goalTypes.find((g) => g.key === e.target.value)?.auto ?? false,
                })
              }
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
          <Field label="نقاط الهدف عند اكتماله">
            <input
              type="number"
              value={form.points_per_unit}
              onChange={(e) => setForm({ ...form, points_per_unit: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="المنجز اليدوي">
            <input
              type="number"
              value={form.achieved_value}
              onChange={(e) => setForm({ ...form, achieved_value: e.target.value })}
              className={inputClass}
              disabled={form.auto_track}
            />
          </Field>
          <Field label="طريقة الاحتساب" className="sm:col-span-2">
            <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <input
                type="checkbox"
                checked={form.auto_track}
                onChange={(e) => setForm({ ...form, auto_track: e.target.checked })}
              />
              احتساب الإنجاز تلقائيًا من عمل الموظف داخل النظام
            </label>
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

function InfoRow({
  label,
  value,
  ltr,
}: {
  label: string;
  value?: string | null | undefined;
  ltr?: boolean | undefined;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground" dir={ltr ? "ltr" : undefined}>
        {value || "—"}
      </p>
    </div>
  );
}
