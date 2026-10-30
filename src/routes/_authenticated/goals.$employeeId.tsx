import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Pencil, Plus, RotateCcw, Target, Trash2 } from "lucide-react";
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
import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { incrementAchievement } from "@/lib/goal-increment";
import {
  computeAutoProgress,
  effectiveAchieved,
  emptyAutoProgress,
  goalPoints,
  goalTypes,
  goalUnit,
  monthStart,
  percentOf,
  remainingOf,
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

/** يقبل الأرقام العربية/الفارسية والفواصل، ويرفض أي شيء غير رقم صحيح غير سالب. */
function toNum(v: string | number) {
  const s = String(v ?? "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٬,\s]/g, "")
    .replace("٫", ".");
  const n = s === "" ? 0 : Number(s);
  return Number.isFinite(n) ? n : NaN;
}

const emptyForm = {
  goal_type: "rent",
  target_value: "",
  achieved_value: "0",
  points_per_unit: "10",
  auto_track: true,
  notes: "",
};

function monthShift(month: string, delta: number) {
  const [y = 2026, m = 1] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function EmployeeGoalsPage() {
  const { employeeId } = Route.useParams();
  const qc = useQueryClient();
  const { isSuperAdmin, can } = useCurrentUser();
  const canManage = isSuperAdmin || can("employees", "manage");
  const [month, setMonth] = useState(currentMonth());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [increments, setIncrements] = useState<Record<string, string>>({});
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

  const { data: auto = emptyAutoProgress } = useQuery({
    queryKey: ["employee-auto-progress", employeeId, month],
    queryFn: () => computeAutoProgress(employeeId, month),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["employee-goals", employeeId, period] });
    qc.invalidateQueries({ queryKey: ["goals-summary"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const target = toNum(form.target_value);
      const achievedValue = toNum(form.achieved_value);
      const points = toNum(form.points_per_unit);
      if (!form.target_value || !Number.isFinite(target) || target <= 0)
        throw new Error("اكتب القيمة المستهدفة رقمًا أكبر من صفر");
      if (!Number.isFinite(achievedValue) || achievedValue < 0)
        throw new Error("المنجز اليدوي يجب أن يكون صفرًا أو أكثر");
      if (!Number.isFinite(points) || points < 0)
        throw new Error("نقاط الهدف يجب أن تكون صفرًا أو أكثر");
      if (goals.some(g => g.goal_type === form.goal_type)) throw new Error("هذا الهدف موجود لهذا الشهر؛ يمكنك زيادة إنجازه من بطاقته دون تصفيره");
      const { error } = await supabase.from("employee_goals").insert(
        {
          employee_id: employeeId,
          period_month: period,
          goal_type: form.goal_type,
          target_value: target,
          achieved_value: achievedValue,
          auto_track: form.auto_track,
          points_per_unit: points,
          notes: form.notes || null,
        },
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

  const increment = useMutation({
    mutationFn: async ({ goal, amount }: { goal: GoalRow; amount: number }) => {
      if (!canManage) throw new Error("ليست لديك صلاحية تعديل الأهداف");
      for (let attempt = 0; attempt < 4; attempt++) {
        const current = await supabase.from("employee_goals").select("achieved_value,auto_track").eq("id", goal.id).single();
        if (current.error) throw current.error;
        const base = current.data.auto_track ? effectiveAchieved({ ...goal, ...current.data }, auto) : current.data.achieved_value;
        const value = incrementAchievement(base, amount);
        const result = await supabase.from("employee_goals").update({ achieved_value: value, auto_track: false }).eq("id", goal.id).eq("achieved_value", current.data.achieved_value).eq("auto_track", current.data.auto_track).select("id");
        if (result.error) throw result.error;
        if (result.data?.length) return;
      }
      throw new Error("تزامنت إضافة أخرى؛ حاول مرة أخرى");
    },
    onSuccess: () => { invalidate(); toast.success("تمت إضافة الإنجاز إلى الرصيد السابق"); },
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

  const saveManualValue = (goal: GoalRow) => {
    const value = toNum(editValue);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("اكتب رقمًا صحيحًا صفرًا أو أكثر");
      return;
    }
    patch.mutate({ id: goal.id, values: { achieved_value: value, auto_track: false } });
    setEditingId(null);
    setEditValue("");
  };

  const totalTarget = goals.reduce((s, g) => s + Number(g.target_value || 0), 0);
  const totalAchieved = goals.reduce((s, g) => s + effectiveAchieved(g, auto), 0);
  const totalPoints = goals.reduce((s, g) => s + goalPoints(g, auto), 0);
  const totalRemaining = remainingOf(totalAchieved, totalTarget);
  const overall = percentOf(totalAchieved, totalTarget);

  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString("ar-SA-u-ca-gregory", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6" dir="rtl">
      <PageHero
        title={employee?.full_name ?? "صفحة الموظف"}
        subtitle={`${employee?.job_title ?? "موظف"} — أهداف شهرية يدوية مع احتساب تلقائي للإنجاز والنقاط.`}
        icon={Target}
        stats={[
          { value: String(goals.length), label: "هدف هذا الشهر" },
          { value: `${overall}%`, label: "الإنجاز العام" },
          { value: `${totalAchieved.toLocaleString("ar-EG")} / ${totalTarget.toLocaleString("ar-EG")}`, label: "المنجز / المستهدف" },
          { value: String(totalRemaining.toLocaleString("ar-EG")), label: "المتبقي" },
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonth((m) => monthShift(m, -1))}
            className="grid size-9 place-items-center rounded-lg border border-border bg-card hover:bg-muted"
            aria-label="الشهر السابق"
          >
            <ArrowRight className="size-4 rotate-180" />
          </button>
          <label className="relative min-w-[140px] rounded-lg border border-border bg-card px-3 py-2 text-center text-[13px] font-bold text-foreground">
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
            onClick={() => setMonth((m) => monthShift(m, 1))}
            className="grid size-9 place-items-center rounded-lg border border-border bg-card hover:bg-muted"
            aria-label="الشهر التالي"
          >
            <ArrowRight className="size-4" />
          </button>
          {canManage ? <PrimaryButton onClick={() => setOpen(true)}>
            <Plus className="size-4" /> هدف جديد
          </PrimaryButton> : null}
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
            const target = Number(goal.target_value || 0);
            const pct = percentOf(achieved, target);
            const remaining = remainingOf(achieved, target);
            const typeDef = goalTypes.find((g) => g.key === goal.goal_type);
            const isAutoSource = typeDef?.auto ?? false;
            const isEditing = editingId === goal.id;
            return (
              <article
                key={goal.id}
                className="brand-break rounded-2xl border border-border bg-card p-5 shadow-card"
              >
                <header className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="text-[14px] font-bold text-foreground">
                        {typeDef?.label ?? goal.goal_type}
                      </h3>
                      <Chip tone={goal.auto_track && isAutoSource ? "info" : "neutral"}>
                        {goal.auto_track && isAutoSource ? "تلقائي من النظام" : "يدوي"}
                      </Chip>
                    </div>
                    <p className="text-[12px] text-muted-foreground">
                      المستهدف: {target.toLocaleString("ar-EG")} {goalUnit(goal.goal_type)}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      المُنجز: {achieved.toLocaleString("ar-EG")} — المتبقي:{" "}
                      {remaining.toLocaleString("ar-EG")} — {goalPoints(goal, auto)} نقطة
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
                <div className="flex flex-wrap items-center gap-2">
                  {canManage ? (
                    <>
                      <div className="flex w-full flex-wrap items-center gap-2 border-b border-border pb-3">
                        {[1, 2].map(amount => <Button key={amount} size="sm" variant="outline" disabled={increment.isPending} onClick={() => increment.mutate({ goal, amount })}><Plus className="size-3.5" />{amount}</Button>)}
                        <input aria-label={`إضافة إنجاز ${typeDef?.label ?? goal.goal_type}`} inputMode="decimal" value={increments[goal.id] ?? ""} onChange={e => setIncrements(v => ({ ...v, [goal.id]: e.target.value }))} className={`${inputClass} h-9 max-w-24`} placeholder="إضافة" />
                        <Button size="sm" disabled={increment.isPending} onClick={() => increment.mutate({ goal, amount: toNum(increments[goal.id] ?? "") })}><Plus />إضافة إنجاز</Button>
                      </div>
                      {isAutoSource && goal.auto_track ? (
                        isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className={`${inputClass} h-8 max-w-[110px] text-[12px]`}
                              placeholder="الرقم الفعلي"
                              aria-label="تعديل الرقم يدويًا"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => saveManualValue(goal)}
                              className="rounded-lg bg-primary px-2.5 py-1.5 text-[11.5px] font-semibold text-primary-foreground hover:opacity-90"
                            >
                              حفظ
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setEditValue("");
                              }}
                              className="rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] text-muted-foreground hover:bg-muted"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(goal.id);
                              setEditValue(String(achieved));
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] font-semibold text-foreground hover:bg-muted"
                          >
                            <Pencil className="size-3.5" /> تعديل الرقم
                          </button>
                        )
                      ) : null}
                      {isAutoSource && !goal.auto_track ? (
                        <button
                          type="button"
                          onClick={() => patch.mutate({ id: goal.id, values: { auto_track: true } })}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] font-semibold text-primary hover:bg-primary/10"
                        >
                          <RotateCcw className="size-3.5" /> رجوع للحساب التلقائي
                        </button>
                      ) : null}
                      {!isAutoSource ? (
                        isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className={`${inputClass} h-8 max-w-[110px] text-[12px]`}
                              aria-label="تحديث المنجز يدويًا"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => saveManualValue(goal)}
                              className="rounded-lg bg-primary px-2.5 py-1.5 text-[11.5px] font-semibold text-primary-foreground hover:opacity-90"
                            >
                              حفظ
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null);
                                setEditValue("");
                              }}
                              className="rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] text-muted-foreground hover:bg-muted"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(goal.id);
                              setEditValue(String(achieved));
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] font-semibold text-foreground hover:bg-muted"
                          >
                            <Pencil className="size-3.5" /> تعديل الرقم
                          </button>
                        )
                      ) : null}
                    </>
                  ) : null}
                  {canManage ? <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("هل أنت متأكد من الحذف؟")) remove.mutate(goal.id);
                    }}
                    className="ms-auto text-muted-foreground transition-colors hover:text-destructive"
                    aria-label="حذف الهدف"
                  >
                    <Trash2 className="size-4" />
                  </button> : null}
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
              type="text"
              inputMode="decimal"
              value={form.target_value}
              onChange={(e) => setForm({ ...form, target_value: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="نقاط الهدف عند اكتماله">
            <input
              type="text"
              inputMode="decimal"
              value={form.points_per_unit}
              onChange={(e) => setForm({ ...form, points_per_unit: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="المنجز اليدوي">
            <input
              type="text"
              inputMode="decimal"
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
