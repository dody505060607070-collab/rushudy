import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { History, Settings2, Smartphone, UserCog } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Empty, Field, Pill, PortalCard, btnPrimary, inputClass, money, num } from "@/components/portal/ui";
import { getOwnerWorkspace, saveOwnerPreferences } from "@/lib/owner-portal.functions";

export const Route = createFileRoute("/portal/settings")({
  head: () => ({
    meta: [
      { title: "إعداداتي وأماني | بوابة المالك" },
      { name: "description", content: "تفضيلات المالك، حد اعتماد المصروفات، المفوضون بالاطلاع، وسجل الدخول الأمني." },
      { property: "og:title", content: "إعداداتي وأماني | بوابة المالك" },
      { property: "og:description", content: "تفضيلات التقارير والتنبيهات والمفوضين وسجل الدخول." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OwnerSettingsPage,
});

const FREQ: { value: string; label: string }[] = [
  { value: "none", label: "بدون تقارير" },
  { value: "monthly", label: "شهري" },
  { value: "quarterly", label: "ربع سنوي" },
  { value: "yearly", label: "سنوي" },
];

function OwnerSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["owner-workspace"], queryFn: () => getOwnerWorkspace() });

  const [language, setLanguage] = useState("ar");
  const [currency, setCurrency] = useState("SAR");
  const [reportFrequency, setReportFrequency] = useState("monthly");
  const [limit, setLimit] = useState("1000");
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(false);

  useEffect(() => {
    const p = data?.preferences;
    if (!p) return;
    setLanguage(p.language ?? "ar");
    setCurrency(p.currency ?? "SAR");
    setReportFrequency(p.report_frequency ?? "monthly");
    setLimit(String(p.expense_approval_limit ?? 1000));
    setNotifyWhatsapp(Boolean(p.notify_whatsapp));
    setNotifyEmail(Boolean(p.notify_email));
  }, [data?.preferences]);

  const save = useMutation({
    mutationFn: () =>
      saveOwnerPreferences({
        data: {
          language,
          currency,
          reportFrequency,
          expenseApprovalLimit: Number(limit),
          notifyWhatsapp,
          notifyEmail,
        },
      }),
    onSuccess: () => {
      toast.success("تم حفظ تفضيلاتك");
      void qc.invalidateQueries({ queryKey: ["owner-workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">جاري التحميل…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <PortalCard title="تفضيلاتي" icon={Settings2} subtitle="اللغة، عملة العرض، تكرار التقارير، وحد اعتماد المصروفات">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="لغة البوابة">
            <select className={inputClass} value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </Field>
          <Field label="عملة العرض">
            <select className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="SAR">ريال سعودي</option>
              <option value="USD">دولار أمريكي</option>
              <option value="AED">درهم إماراتي</option>
            </select>
          </Field>
          <Field label="تكرار التقارير المرسلة">
            <select className={inputClass} value={reportFrequency} onChange={(e) => setReportFrequency(e.target.value)}>
              {FREQ.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="حد اعتماد المصروفات (يُطلب إذني فوقه)">
            <input className={inputClass} inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-[12.5px]">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={notifyWhatsapp} onChange={(e) => setNotifyWhatsapp(e.target.checked)} />
            أرغب في تنبيهات واتساب
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
            أرغب في تنبيهات البريد
          </label>
        </div>
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          لا تُرسل أي رسالة واتساب تلقائيًا؛ التنبيهات تُرسل فقط عند اعتماد فريق المكتب لإرسالها.
        </p>

        <button type="button" className={`${btnPrimary} mt-3`} disabled={save.isPending} onClick={() => save.mutate()}>
          حفظ التفضيلات
        </button>
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          حد الاعتماد الحالي: <span className="font-bold text-foreground">{money(Number(limit || 0))}</span>
        </p>
      </PortalCard>

      <PortalCard title="المفوّضون بالاطلاع" icon={UserCog} subtitle="شريك أو أحد الورثة أو المحاسب — صلاحية عرض فقط">
        {data.delegates.length === 0 ? (
          <Empty text="لا يوجد مفوضون حاليًا. يمكنك إضافة مفوّض من صفحة أدواتي." />
        ) : (
          <ul className="space-y-2">
            {data.delegates.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-[12.5px]">
                <span>
                  <span className="font-semibold text-foreground">{d.delegate?.full_name ?? "مفوّض"}</span>
                  <span className="block text-[11px] text-muted-foreground">{d.delegate?.phone ?? ""}</span>
                </span>
                <Pill tone={d.is_active ? "good" : "muted"}>{d.is_active ? "فعّال" : "موقوف"}</Pill>
              </li>
            ))}
          </ul>
        )}
      </PortalCard>

      <PortalCard title="سجل الدخول" icon={History} subtitle={`آخر ${num(data.loginEvents?.length ?? 0)} عملية دخول لحسابك`}>
        {(data.loginEvents ?? []).length === 0 ? (
          <Empty text="لا توجد عمليات دخول مسجلة بعد." />
        ) : (
          <ul className="space-y-2">
            {(data.loginEvents ?? []).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-[12px]">
                <span className="text-muted-foreground">{e.path ?? "/portal"}</span>
                <span className="text-muted-foreground">{String(e.created_at).slice(0, 16).replace("T", " ")}</span>
              </li>
            ))}
          </ul>
        )}
      </PortalCard>

      <PortalCard title="تطبيق البوابة على جوالك" icon={Smartphone} subtitle="ثبّت البوابة كتطبيق لتصلك الإشعارات فورًا">
        <ol className="list-decimal space-y-1 pe-5 text-[12.5px] text-muted-foreground">
          <li>افتح البوابة من متصفح جوالك.</li>
          <li>اضغط قائمة المتصفح ثم «إضافة إلى الشاشة الرئيسية».</li>
          <li>ستظهر أيقونة البوابة على جوالك وتعمل كتطبيق مستقل.</li>
        </ol>
      </PortalCard>
    </div>
  );
}
