import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Banknote,
  BarChart3,
  Copy,
  ExternalLink,
  Eye,
  Link2,
  Megaphone,
  MessageCircle,
  MousePointerClick,
  Pencil,
  Plus,
  QrCode,
  Target,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { EmptyState } from "@/components/kit/EmptyState";
import { Field, GhostButton, Modal, PrimaryButton, inputClass, textareaClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { StatCard } from "@/components/kit/StatCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { referralUrl } from "@/lib/marketing";

export const Route = createFileRoute("/_authenticated/marketing")({
  head: () => ({
    meta: [
      { title: "التسويق العقاري والمسوقون | الرشودي للعقارات" },
      { name: "description", content: "إدارة المسوقين العقاريين وروابط الإحالة والعملاء والصفقات والعمولات." },
      { property: "og:title", content: "التسويق العقاري والمسوقون | الرشودي للعقارات" },
      { property: "og:description", content: "مركز متابعة المسوقين وروابط الإحالة والتحويلات والعمولات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarketingPage,
});

type Marketer = Tables<"marketers">;
type Lead = Tables<"marketer_leads">;
type Commission = Tables<"marketer_commissions">;
type Visit = Tables<"marketer_referral_visits">;

const emptyForm = {
  full_name: "",
  phone: "",
  email: "",
  referral_code: "",
  status: "active",
  specialty: "",
  regions: "",
  commission_type: "office_commission_percent",
  commission_value: "",
  attribution_days: "30",
  notes: "",
};

const statusLabel: Record<string, string> = { active: "نشط", paused: "موقوف", archived: "مؤرشف" };
const leadStatusLabel: Record<string, string> = { new: "جديد", contacted: "تم التواصل", qualified: "مؤهل", viewing: "معاينة", negotiation: "تفاوض", won: "صفقة ناجحة", lost: "غير مكتمل" };
const commissionTypeLabel: Record<string, string> = { fixed: "مبلغ ثابت", office_commission_percent: "نسبة من عمولة المكتب", deal_percent: "نسبة من قيمة الصفقة" };

function MarketingPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Marketer | null>(null);
  const [qrMarketer, setQrMarketer] = useState<Marketer | null>(null);
  const [qrData, setQrData] = useState("");
  const [form, setForm] = useState({ ...emptyForm });

  const dashboard = useQuery({
    queryKey: ["marketing-dashboard"],
    queryFn: async () => {
      const [marketers, visits, leads, commissions] = await Promise.all([
        supabase.from("marketers").select("*").order("created_at", { ascending: false }),
        supabase.from("marketer_referral_visits").select("*").order("visited_at", { ascending: false }).limit(1000),
        supabase.from("marketer_leads").select("*").order("attributed_at", { ascending: false }),
        supabase.from("marketer_commissions").select("*").order("created_at", { ascending: false }),
      ]);
      const error = marketers.error ?? visits.error ?? leads.error ?? commissions.error;
      if (error) throw error;
      return {
        marketers: (marketers.data ?? []) as Marketer[],
        visits: (visits.data ?? []) as Visit[],
        leads: (leads.data ?? []) as Lead[],
        commissions: (commissions.data ?? []) as Commission[],
      };
    },
  });

  const data = dashboard.data ?? { marketers: [], visits: [], leads: [], commissions: [] };
  const metrics = useMemo(() => {
    const won = data.leads.filter((item) => item.status === "won").length;
    const due = data.commissions.filter((item) => ["due", "approved"].includes(item.status)).reduce((sum, item) => sum + item.amount, 0);
    const paid = data.commissions.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amount, 0);
    return {
      active: data.marketers.filter((item) => item.status === "active").length,
      visits: data.visits.length,
      leads: data.leads.length,
      won,
      conversion: data.visits.length ? (data.leads.length / data.visits.length) * 100 : 0,
      due,
      paid,
    };
  }, [data]);

  useEffect(() => {
    if (!qrMarketer) return;
    let cancelled = false;
    import("qrcode").then(({ toDataURL }) => toDataURL(referralUrl(qrMarketer.referral_code), { width: 360, margin: 2 })).then((url) => {
      if (!cancelled) setQrData(url);
    }).catch(() => setQrData(""));
    return () => { cancelled = true; };
  }, [qrMarketer]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["marketing-dashboard"] });
  const save = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim() || !form.phone.trim()) throw new Error("اسم المسوق ورقم الجوال مطلوبان");
      const code = (form.referral_code.trim() || form.full_name.trim().replace(/\s+/g, "-")).toLowerCase().replace(/[^a-z0-9_-]/g, "");
      if (code.length < 3) throw new Error("اكتب كود رابط بالإنجليزية من 3 أحرف على الأقل");
      const payload = {
        full_name: form.full_name.trim(), phone: form.phone.trim(), email: form.email.trim() || null,
        referral_code: code, status: form.status, specialty: form.specialty.trim() || null,
        regions: form.regions.split("،").map((item) => item.trim()).filter(Boolean),
        commission_type: form.commission_type, commission_value: Number(form.commission_value) || 0,
        attribution_days: Number(form.attribution_days) || 30, notes: form.notes.trim() || null,
      };
      const result = editing
        ? await supabase.from("marketers").update(payload).eq("id", editing.id)
        : await supabase.from("marketers").insert(payload);
      if (result.error) throw result.error;
    },
    onSuccess: () => { toast.success(editing ? "تم تحديث بيانات المسوق" : "تمت إضافة المسوق ورابطه الخاص"); setOpen(false); refresh(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر الحفظ"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const result = await supabase.from("marketers").delete().eq("id", id); if (result.error) throw result.error; },
    onSuccess: () => { toast.success("تم حذف المسوق"); refresh(); },
    onError: () => toast.error("لا يمكن حذف مسوق مرتبط بعملاء أو عمولات؛ أوقفه بدلًا من ذلك"),
  });

  const edit = (item: Marketer) => {
    setEditing(item);
    setForm({ full_name: item.full_name, phone: item.phone, email: item.email ?? "", referral_code: item.referral_code, status: item.status, specialty: item.specialty ?? "", regions: item.regions.join("، "), commission_type: item.commission_type, commission_value: String(item.commission_value), attribution_days: String(item.attribution_days), notes: item.notes ?? "" });
    setOpen(true);
  };

  const copy = async (item: Marketer) => { await navigator.clipboard.writeText(referralUrl(item.referral_code)); toast.success("تم نسخ رابط المسوق"); };

  return (
    <div className="space-y-6">
      <PageHero title="مركز التسويق العقاري" subtitle="روابط إحالة قابلة للقياس، رحلة عميل واضحة، وعمولات تحت اعتماد الإدارة." icon={Megaphone} stats={[{ label: "المسوقون النشطون", value: String(metrics.active) }, { label: "عملاء منسوبون", value: String(metrics.leads) }, { label: "صفقات ناجحة", value: String(metrics.won) }]} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="زيارات روابط المسوقين" value={metrics.visits} icon={MousePointerClick} hint="زيارات مسجلة بدون بيانات شخصية" />
        <StatCard label="نسبة التحويل إلى طلب" value={metrics.conversion} suffix="%" icon={Target} hint="الطلبات ÷ زيارات الروابط" />
        <StatCard label="عمولات مستحقة" value={metrics.due} suffix="ر.س" icon={Banknote} />
        <StatCard label="عمولات مدفوعة" value={metrics.paid} suffix="ر.س" icon={BadgeCheck} />
      </div>

      <section className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div><h2 className="text-base font-bold text-foreground">المسوقون العقاريون</h2><p className="mt-1 text-xs text-muted-foreground">كل مسوق له رابط مستقل وتقارير تحويل وعمولات منفصلة.</p></div>
          <Button onClick={() => { setEditing(null); setForm({ ...emptyForm }); setOpen(true); }}><Plus />إضافة مسوق</Button>
        </div>
        {dashboard.isLoading ? <p className="p-8 text-center text-sm text-muted-foreground">جاري تحميل بيانات التسويق…</p> : data.marketers.length === 0 ? (
          <EmptyState icon={Users} title="لا يوجد مسوقون حتى الآن" description="أضف أول مسوق ليحصل على رابط خاص ويبدأ قياس الزيارات والعملاء والصفقات." action={<Button onClick={() => setOpen(true)}><Plus />إضافة أول مسوق</Button>} className="m-5" />
        ) : (
          <div className="grid gap-4 p-5 lg:grid-cols-2 2xl:grid-cols-3">
            {data.marketers.map((item) => {
              const leads = data.leads.filter((lead) => lead.marketer_id === item.id);
              const visits = data.visits.filter((visit) => visit.marketer_id === item.id).length;
              const won = leads.filter((lead) => lead.status === "won").length;
              const commission = data.commissions.filter((row) => row.marketer_id === item.id && row.status !== "cancelled").reduce((sum, row) => sum + row.amount, 0);
              return <article key={item.id} className="rounded-lg border border-border bg-card p-5 shadow-card">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-foreground">{item.full_name}</h3><Chip tone={item.status === "active" ? "success" : "neutral"}>{statusLabel[item.status] ?? item.status}</Chip></div><p dir="ltr" className="mt-1 text-xs text-muted-foreground">{item.phone}</p></div><div className="flex gap-1"><Button variant="ghost" size="icon-sm" aria-label="تعديل" onClick={() => edit(item)}><Pencil /></Button><Button variant="ghost" size="icon-sm" aria-label="حذف" onClick={() => { if (confirm(`حذف المسوق «${item.full_name}»؟`)) remove.mutate(item.id); }}><Trash2 className="text-destructive" /></Button></div></div>
                <div className="mt-4 rounded-lg border border-border bg-muted/35 p-3"><p className="text-[11px] font-semibold text-muted-foreground">رابط الإحالة</p><p dir="ltr" className="mt-1 truncate text-xs font-semibold text-primary">{referralUrl(item.referral_code)}</p><div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => copy(item)}><Copy />نسخ</Button><Button size="sm" variant="outline" onClick={() => setQrMarketer(item)}><QrCode />QR</Button><Button size="sm" variant="outline" asChild><a href={referralUrl(item.referral_code)} target="_blank" rel="noreferrer"><ExternalLink />فتح</a></Button></div></div>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center"><MiniMetric label="زيارات" value={visits} /><MiniMetric label="عملاء" value={leads.length} /><MiniMetric label="صفقات" value={won} /><MiniMetric label="عمولات" value={commission.toLocaleString("ar-SA")} /></div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4"><p className="text-xs text-muted-foreground">{commissionTypeLabel[item.commission_type]}: <b className="text-foreground">{item.commission_value.toLocaleString("ar-SA")}{item.commission_type === "fixed" ? " ر.س" : "%"}</b></p><Button variant="link" size="sm" asChild><Link to="/marketing/$marketerId" params={{ marketerId: item.id }}>التفاصيل<ExternalLink /></Link></Button></div>
              </article>;
            })}
          </div>
        )}
      </section>

      <section className="surface-card p-6">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary"><Link2 className="size-5" /></span><div><h2 className="text-base font-bold text-foreground">كيف يعمل نظام المسوقين؟</h2><p className="text-xs text-muted-foreground">شرح سريع للفريق من الرابط حتى صرف العمولة.</p></div></div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <GuideStep number="١" icon={UserCheck} title="أنشئ المسوق" text="سجّل بياناته وحدد تخصصه ومناطقه وطريقة حساب العمولة ومدة الإسناد." />
          <GuideStep number="٢" icon={Link2} title="شاركه رابطه" text="أرسل له رابط الموقع العام أو رابط عقار محدد. الرابط يحمل بصمته التسويقية." />
          <GuideStep number="٣" icon={Target} title="تابع رحلة العميل" text="يسجل النظام الزيارة، وعند تقديم طلب صحيح ينسب العميل للمسوق تلقائيًا." />
          <GuideStep number="٤" icon={Banknote} title="اعتمد العمولة" text="لا توجد عمولة على الزيارة وحدها. تُنشأ وتُراجع وتُعتمد وتُدفع من الإدارة." />
        </div>
        <div className="mt-5 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm leading-7 text-foreground"><b>قاعدة واتساب:</b> لا يرسل النظام شيئًا عند إضافة مسوق أو إنشاء رابط. إرسال العقار يتم فقط عندما تختار مسوقًا وتضغط زر الإرسال بنفسك.</div>
      </section>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "تعديل ملف المسوق" : "إضافة مسوق عقاري"} subtitle="بيانات المسوق والرابط وقاعدة العمولة." wide footer={<><GhostButton onClick={() => setOpen(false)}>إلغاء</GhostButton><PrimaryButton onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "جاري الحفظ…" : "حفظ المسوق"}</PrimaryButton></>}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="اسم المسوق" required><input className={inputClass} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="رقم الجوال" required><input dir="ltr" className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="البريد الإلكتروني"><input dir="ltr" type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="كود الرابط" required hint="أحرف إنجليزية وأرقام، مثل: ahmed-01"><input dir="ltr" className={inputClass} value={form.referral_code} onChange={(e) => setForm({ ...form, referral_code: e.target.value })} /></Field>
          <Field label="التخصص"><input className={inputClass} value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="بيع فلل، إيجارات، أراضٍ…" /></Field>
          <Field label="المناطق" hint="افصل بينها بفاصلة عربية"><input className={inputClass} value={form.regions} onChange={(e) => setForm({ ...form, regions: e.target.value })} placeholder="بريدة، عنيزة" /></Field>
          <Field label="نوع العمولة"><select className={inputClass} value={form.commission_type} onChange={(e) => setForm({ ...form, commission_type: e.target.value })}>{Object.entries(commissionTypeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="قيمة العمولة"><input type="number" min="0" step="0.01" className={inputClass} value={form.commission_value} onChange={(e) => setForm({ ...form, commission_value: e.target.value })} /></Field>
          <Field label="مدة حفظ الإحالة" hint="من 1 إلى 365 يومًا"><input type="number" min="1" max="365" className={inputClass} value={form.attribution_days} onChange={(e) => setForm({ ...form, attribution_days: e.target.value })} /></Field>
          <Field label="الحالة"><select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="ملاحظات" className="md:col-span-2"><textarea className={textareaClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={Boolean(qrMarketer)} onClose={() => { setQrMarketer(null); setQrData(""); }} title={`رمز رابط ${qrMarketer?.full_name ?? "المسوق"}`} subtitle="يمكن للمسوق وضعه في الإعلان أو طباعته.">
        <div className="grid place-items-center gap-4">{qrData ? <img src={qrData} alt="رمز QR لرابط المسوق" className="size-64 rounded-lg border border-border" /> : <p className="text-sm text-muted-foreground">جاري إنشاء الرمز…</p>}<Button variant="outline" onClick={() => qrMarketer && copy(qrMarketer)}><Copy />نسخ الرابط</Button></div>
      </Modal>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-md bg-muted/55 px-2 py-2"><p className="text-sm font-extrabold text-foreground">{value}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p></div>;
}

function GuideStep({ number, icon: Icon, title, text }: { number: string; icon: typeof Eye; title: string; text: string }) {
  return <article className="rounded-lg border border-border bg-muted/25 p-4"><div className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4.5" /></span><span className="text-lg font-black text-primary/35">{number}</span></div><h3 className="mt-3 text-sm font-bold text-foreground">{title}</h3><p className="mt-1 text-xs leading-6 text-muted-foreground">{text}</p></article>;
}