import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ShieldCheck, Wrench, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Empty, Field, Pill, PortalCard, Stat, btnGhost, btnPrimary, inputClass, money, num } from "@/components/portal/ui";
import { decideOwnerApproval, getOwnerInsights, getOwnerWorkspace } from "@/lib/owner-portal.functions";
import { createOwnerRequest } from "@/lib/portal.functions";

export const Route = createFileRoute("/portal/care")({
  head: () => ({
    meta: [
      { title: "الصيانة والاعتمادات | بوابة المالك" },
      { name: "description", content: "متابعة بلاغات صيانة وحداتك واعتماد المصروفات والمستأجرين المقترحين قبل التنفيذ." },
      { property: "og:title", content: "الصيانة والاعتمادات | بوابة المالك" },
      { property: "og:description", content: "بلاغات الصيانة بالتكلفة والحالة، واعتمادات المالك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OwnerCarePage,
});

const MAINT_STATUS: Record<string, { label: string; tone: "muted" | "good" | "warn" | "bad" | "info" }> = {
  new: { label: "جديد", tone: "warn" },
  assigned: { label: "مُسند لفني", tone: "info" },
  in_progress: { label: "قيد التنفيذ", tone: "info" },
  done: { label: "مكتمل", tone: "good" },
  cancelled: { label: "ملغي", tone: "bad" },
};

const APPROVAL_KIND: Record<string, string> = {
  expense: "مصروف صيانة",
  tenant: "مستأجر مقترح",
  renewal: "تجديد عقد",
  other: "طلب آخر",
};

function OwnerCarePage() {
  const qc = useQueryClient();
  const insights = useQuery({ queryKey: ["owner-insights"], queryFn: () => getOwnerInsights() });
  const workspace = useQuery({ queryKey: ["owner-workspace"], queryFn: () => getOwnerWorkspace() });
  const [note, setNote] = useState<Record<string, string>>({});
  const [issue, setIssue] = useState("");

  const decide = useMutation({
    mutationFn: (input: { id: string; decision: "approved" | "rejected"; note?: string }) => decideOwnerApproval({ data: input }),
    onSuccess: () => {
      toast.success("تم تسجيل قرارك");
      void qc.invalidateQueries({ queryKey: ["owner-workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const report = useMutation({
    mutationFn: () => createOwnerRequest({ data: { kind: "maintenance", title: issue.trim() } }),
    onSuccess: () => {
      toast.success("تم إرسال البلاغ للمكتب");
      setIssue("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (insights.isLoading) return <p className="text-sm text-muted-foreground">جاري التحميل…</p>;
  if (insights.error) return <p className="text-sm text-destructive">{(insights.error as Error).message}</p>;
  const data = insights.data;
  if (!data) return null;

  const maintenance = data.maintenance ?? [];
  const totalCost = maintenance.reduce((s, m) => s + Number(m.cost ?? 0), 0);
  const open = maintenance.filter((m) => !["done", "cancelled"].includes(m.status));
  const pending = (workspace.data?.approvals ?? []).filter((a) => a.status === "pending");
  const decided = (workspace.data?.approvals ?? []).filter((a) => a.status !== "pending");
  const limit = Number(workspace.data?.preferences?.expense_approval_limit ?? 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="بلاغات مفتوحة" value={num(open.length)} tone={open.length ? "warn" : "good"} />
        <Stat label="إجمالي البلاغات" value={num(maintenance.length)} />
        <Stat label="تكلفة الصيانة" value={money(totalCost)} />
        <Stat label="اعتمادات بانتظارك" value={num(pending.length)} tone={pending.length ? "bad" : "good"} />
      </div>

      <PortalCard
        title="اعتمادات بانتظار قرارك"
        icon={ShieldCheck}
        subtitle={limit > 0 ? `يُطلب اعتمادك لأي مصروف يتجاوز ${money(limit)}` : "اعتماد المصروفات والمستأجرين قبل التنفيذ"}
      >
        {pending.length === 0 ? (
          <Empty text="لا توجد طلبات بانتظار قرارك." />
        ) : (
          <ul className="space-y-3">
            {pending.map((a) => (
              <li key={a.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13px] font-bold text-foreground">{a.title}</span>
                  <Pill tone="warn">{APPROVAL_KIND[a.kind] ?? "طلب"}</Pill>
                </div>
                {a.details ? <p className="mt-1 text-[12px] text-muted-foreground">{a.details}</p> : null}
                {a.amount ? <p className="mt-1 text-[12.5px] font-bold text-foreground">المبلغ: {money(a.amount)}</p> : null}
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="min-w-[14rem] flex-1">
                    <Field label="ملاحظة (اختياري)">
                      <input
                        className={inputClass}
                        value={note[a.id] ?? ""}
                        onChange={(e) => setNote((s) => ({ ...s, [a.id]: e.target.value }))}
                      />
                    </Field>
                  </div>
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ id: a.id, decision: "approved", note: note[a.id] ?? "" })}
                  >
                    <CheckCircle2 className="h-4 w-4" /> موافقة
                  </button>
                  <button
                    type="button"
                    className={btnGhost}
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ id: a.id, decision: "rejected", note: note[a.id] ?? "" })}
                  >
                    <XCircle className="h-4 w-4" /> رفض
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {decided.length ? (
          <div className="mt-4 space-y-2 border-t border-border pt-3">
            <p className="text-[11.5px] font-semibold text-muted-foreground">قرارات سابقة</p>
            {decided.slice(0, 8).map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-[12px]">
                <span className="text-foreground">{a.title}</span>
                <Pill tone={a.status === "approved" ? "good" : "bad"}>{a.status === "approved" ? "معتمد" : "مرفوض"}</Pill>
              </div>
            ))}
          </div>
        ) : null}
      </PortalCard>

      <PortalCard title="بلاغات صيانة وحداتي" icon={Wrench} subtitle="الفني والتكلفة والحالة وصور قبل وبعد والتقييم">
        {maintenance.length === 0 ? (
          <Empty text="لا توجد بلاغات صيانة على عقاراتك." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {maintenance.map((m) => {
              const info = MAINT_STATUS[m.status] ?? MAINT_STATUS["new"]!;
              return (
                <article key={m.id} className="rounded-xl border border-border p-4 text-[12.5px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-foreground">{m.category}</span>
                    <Pill tone={info.tone}>{info.label}</Pill>
                  </div>
                  <p className="mt-1 text-muted-foreground">{m.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11.5px] text-muted-foreground">
                    <span>التكلفة: <span className="font-bold text-foreground">{money(Number(m.cost ?? 0))}</span></span>
                    <span>الأولوية: {m.priority}</span>
                    {m.rating ? <span>التقييم: {m.rating}/5</span> : null}
                    <span>{String(m.created_at).slice(0, 10)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </PortalCard>

      <PortalCard title="بلّغ عن مشكلة في أحد عقاراتي" icon={Wrench} subtitle="يصل البلاغ لفريق الصيانة مباشرة">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <Field label="وصف المشكلة">
              <input className={inputClass} value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="مثال: تسريب في سباكة الدور الثاني" />
            </Field>
          </div>
          <button type="button" className={btnPrimary} disabled={report.isPending || issue.trim().length < 3} onClick={() => report.mutate()}>
            إرسال البلاغ
          </button>
        </div>
      </PortalCard>
    </div>
  );
}
