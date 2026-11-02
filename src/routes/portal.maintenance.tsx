import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock, MessageCircle, Send, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Empty, Field, Pill, PortalCard, btnPrimary, inputClass } from "@/components/portal/ui";
import { MAINTENANCE_CATEGORIES, MAINTENANCE_PRIORITIES } from "@/lib/maintenance-notify";
import { createTenantMaintenance, getTenantMaintenance } from "@/lib/portal.functions";
import { whatsappLink } from "@/lib/site-data";

const TITLE = "طلبات الصيانة | بوابة العميل";
const DESC = "ارفع طلب صيانة لوحدتك وتابع حالته والفني وموعد الزيارة من صفحتك.";

export const Route = createFileRoute("/portal/maintenance")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TenantMaintenancePage,
});

const STATUS: Record<string, { label: string; tone: "muted" | "good" | "warn" | "bad" | "info" }> = {
  new: { label: "وصل للمكتب", tone: "warn" },
  assigned: { label: "تم تحديد فني", tone: "info" },
  in_progress: { label: "جارٍ التنفيذ", tone: "info" },
  done: { label: "تم الإصلاح", tone: "good" },
  cancelled: { label: "ملغي", tone: "bad" },
};

const FORM_CATEGORIES = ["plumbing", "electrical", "ac", "elevator", "cleaning", "structure", "other"];
const FORM_PRIORITIES = ["normal", "high", "urgent"];

function TenantMaintenancePage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["tenant-maintenance"],
    queryFn: () => getTenantMaintenance(),
  });
  const [form, setForm] = useState({ contractId: "", category: "other", priority: "normal", description: "" });

  useEffect(() => {
    if (!form.contractId && data?.contracts.length) {
      const first = data.contracts.find((c) => c.status === "active") ?? data.contracts[0];
      if (first) setForm((f) => ({ ...f, contractId: first.id }));
    }
  }, [data, form.contractId]);

  const send = useMutation({
    mutationFn: () => createTenantMaintenance({ data: form }),
    onSuccess: () => {
      toast.success("وصل طلبك للمكتب وسيتواصل معك فريق الصيانة");
      setForm((f) => ({ ...f, description: "", category: "other", priority: "normal" }));
      void qc.invalidateQueries({ queryKey: ["tenant-maintenance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">جاري التحميل…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const place = (contractId: string | null) => {
    const c = data.contracts.find((x) => x.id === contractId);
    if (!c) return "—";
    return [c.property?.name, c.unit?.unit_number ? `وحدة ${c.unit.unit_number}` : null].filter(Boolean).join(" — ") || `عقد ${c.contract_number}`;
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-extrabold">طلبات الصيانة</h1>
        <p className="mt-1 text-sm text-muted-foreground">اكتب المشكلة وتصل فورًا للمكتب وفريق الصيانة، وتابع الحالة من هنا.</p>
      </header>

      <PortalCard title="طلب صيانة جديد" icon={Wrench} subtitle="يصل الطلب للمكتب وموظف الصيانة على الواتساب مباشرة">
        {data.contracts.length === 0 ? (
          <Empty text="لا يوجد عقد إيجار مرتبط بحسابك. تواصل مع المكتب لربط عقدك." />
        ) : (
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (form.description.trim().length < 3) {
                toast.error("اكتب وصف المشكلة");
                return;
              }
              send.mutate();
            }}
          >
            {data.contracts.length > 1 ? (
              <Field label="الوحدة">
                <select
                  className={inputClass}
                  value={form.contractId}
                  onChange={(e) => setForm({ ...form, contractId: e.target.value })}
                >
                  {data.contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {place(c.id)}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="الوحدة">
                <p className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm font-semibold">{place(form.contractId)}</p>
              </Field>
            )}
            <Field label="نوع المشكلة">
              <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {FORM_CATEGORIES.map((k) => (
                  <option key={k} value={k}>
                    {MAINTENANCE_CATEGORIES[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="مدى الاستعجال">
              <select className={inputClass} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {FORM_PRIORITIES.map((k) => (
                  <option key={k} value={k}>
                    {MAINTENANCE_PRIORITIES[k]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="md:col-span-2">
              <Field label="وصف المشكلة">
                <textarea
                  rows={4}
                  maxLength={2000}
                  className={inputClass}
                  placeholder="مثال: تسريب ماء تحت مغسلة المطبخ من أمس"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <button type="submit" disabled={send.isPending} className={btnPrimary}>
                <Send className="size-4" /> {send.isPending ? "جاري الإرسال…" : "إرسال الطلب"}
              </button>
              <a
                href={whatsappLink(undefined, "السلام عليكم، عندي استفسار بخصوص الصيانة")}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
              >
                <MessageCircle className="size-4" /> أو كلّمنا على الواتساب
              </a>
            </div>
          </form>
        )}
      </PortalCard>

      <PortalCard title="طلباتي السابقة" icon={CalendarClock} subtitle="الحالة والفني وموعد الزيارة">
        {data.requests.length === 0 ? (
          <Empty text="لم ترسل أي طلب صيانة بعد." />
        ) : (
          <ul className="divide-y divide-border">
            {data.requests.map((r) => {
              const info = STATUS[r.status] ?? { label: r.status, tone: "muted" as const };
              return (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">
                      {MAINTENANCE_CATEGORIES[r.category ?? ""] ?? "صيانة"} — {place(r.contract_id)}
                    </p>
                    <p className="mt-1 text-muted-foreground">{r.description}</p>
                    <p className="mt-1 text-[11.5px] text-muted-foreground">
                      أُرسل في {new Date(r.created_at).toLocaleDateString("ar-SA")}
                      {r.technician_name ? ` • الفني: ${r.technician_name}` : ""}
                      {r.scheduled_at ? ` • موعد الزيارة: ${new Date(r.scheduled_at).toLocaleString("ar-SA")}` : ""}
                    </p>
                  </div>
                  <Pill tone={info.tone}>{info.label}</Pill>
                </li>
              );
            })}
          </ul>
        )}
      </PortalCard>
    </div>
  );
}
