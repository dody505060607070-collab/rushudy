import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Banknote, BriefcaseBusiness, CheckCircle2, Clock3, Copy, Link2, MousePointerClick, Plus, Target, UserRound, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { EmptyState } from "@/components/kit/EmptyState";
import { Field, GhostButton, Modal, PrimaryButton, inputClass, textareaClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { StatCard } from "@/components/kit/StatCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { referralUrl } from "@/lib/marketing";

export const Route = createFileRoute("/_authenticated/marketing/$marketerId")({
  head: () => ({
    meta: [
      { title: "ملف المسوق | الرشودي للعقارات" },
      { name: "description", content: "تفاصيل أداء المسوق والعملاء المنسوبين والصفقات والعمولات." },
      { property: "og:title", content: "ملف المسوق | الرشودي للعقارات" },
      { property: "og:description", content: "متابعة رحلة العملاء ونتائج المسوق والعمولات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarketerDetailsPage,
});

const leadStatuses = [
  ["new", "جديد"], ["contacted", "تم التواصل"], ["qualified", "مؤهل"], ["viewing", "معاينة"], ["negotiation", "تفاوض"], ["won", "صفقة ناجحة"], ["lost", "غير مكتمل"],
] as const;
const commissionStatuses = [["expected", "متوقعة"], ["due", "مستحقة"], ["approved", "معتمدة"], ["paid", "مدفوعة"], ["cancelled", "ملغاة"]] as const;

function MarketerDetailsPage() {
  const { marketerId } = Route.useParams();
  const queryClient = useQueryClient();
  const [commissionOpen, setCommissionOpen] = useState(false);
  const [commission, setCommission] = useState({ lead_id: "", amount: "", basis_amount: "", due_date: "", notes: "" });
  const query = useQuery({
    queryKey: ["marketer-detail", marketerId],
    queryFn: async () => {
      const [marketer, visits, leads, commissions, shares] = await Promise.all([
        supabase.from("marketers").select("*").eq("id", marketerId).single(),
        supabase.from("marketer_referral_visits").select("id, landing_path, property_id, visited_at").eq("marketer_id", marketerId).order("visited_at", { ascending: false }).limit(500),
        supabase.from("marketer_leads").select("*").eq("marketer_id", marketerId).order("attributed_at", { ascending: false }),
        supabase.from("marketer_commissions").select("*").eq("marketer_id", marketerId).order("created_at", { ascending: false }),
        supabase.from("marketer_property_shares").select("id, property_id, sent_at, channel").eq("marketer_id", marketerId).order("sent_at", { ascending: false }),
      ]);
      const error = marketer.error ?? visits.error ?? leads.error ?? commissions.error ?? shares.error;
      if (error) throw error;
      return { marketer: marketer.data, visits: visits.data ?? [], leads: leads.data ?? [], commissions: commissions.data ?? [], shares: shares.data ?? [] };
    },
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["marketer-detail", marketerId] });

  const updateLead = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => { const result = await supabase.from("marketer_leads").update({ status }).eq("id", id); if (result.error) throw result.error; },
    onSuccess: () => { toast.success("تم تحديث مرحلة العميل"); refresh(); },
  });
  const updateCommission = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => { const result = await supabase.from("marketer_commissions").update({ status, paid_at: status === "paid" ? new Date().toISOString() : null }).eq("id", id); if (result.error) throw result.error; },
    onSuccess: () => { toast.success("تم تحديث حالة العمولة"); refresh(); },
  });
  const createCommission = useMutation({
    mutationFn: async () => {
      if (!commission.amount || Number(commission.amount) <= 0) throw new Error("أدخل قيمة العمولة");
      const result = await supabase.from("marketer_commissions").insert({ marketer_id: marketerId, lead_id: commission.lead_id || null, amount: Number(commission.amount), basis_amount: Number(commission.basis_amount) || 0, due_date: commission.due_date || null, notes: commission.notes.trim() || null });
      if (result.error) throw result.error;
    },
    onSuccess: () => { toast.success("تم تسجيل العمولة كمتوقعة للمراجعة"); setCommissionOpen(false); setCommission({ lead_id: "", amount: "", basis_amount: "", due_date: "", notes: "" }); refresh(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر تسجيل العمولة"),
  });

  if (query.isLoading) return <div className="surface-card p-12 text-center text-sm text-muted-foreground">جاري تحميل ملف المسوق…</div>;
  if (query.error || !query.data?.marketer) return <EmptyState icon={UserRound} title="تعذّر فتح ملف المسوق" description="قد يكون الملف محذوفًا أو لا تملك صلاحية عرضه." />;
  const { marketer, visits, leads, commissions, shares } = query.data;
  const won = leads.filter((item) => item.status === "won").length;
  const totalCommission = commissions.filter((item) => item.status !== "cancelled").reduce((sum, item) => sum + item.amount, 0);
  const paid = commissions.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amount, 0);
  const link = referralUrl(marketer.referral_code);

  return <div className="space-y-6">
    <div><Button variant="ghost" asChild><Link to="/marketing"><ArrowRight />العودة إلى المسوقين</Link></Button></div>
    <PageHero title={marketer.full_name} subtitle={`${marketer.specialty ?? "مسوق عقاري"} • ${marketer.phone}`} icon={UserRound} stats={[{ label: "زيارات الرابط", value: String(visits.length) }, { label: "العملاء", value: String(leads.length) }, { label: "صفقات ناجحة", value: String(won) }]} />
    <section className="surface-card flex flex-wrap items-center justify-between gap-4 p-5"><div className="min-w-0"><p className="text-xs font-semibold text-muted-foreground">الرابط الشخصي للمسوق</p><p dir="ltr" className="mt-1 truncate text-sm font-bold text-primary">{link}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={async () => { await navigator.clipboard.writeText(link); toast.success("تم نسخ الرابط"); }}><Copy />نسخ الرابط</Button><Button asChild><a href={link} target="_blank" rel="noreferrer"><Link2 />فتح الرابط</a></Button></div></section>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="معدل التحويل" value={visits.length ? leads.length / visits.length * 100 : 0} suffix="%" icon={Target} /><StatCard label="عقارات مرسلة" value={shares.length} icon={BriefcaseBusiness} /><StatCard label="إجمالي العمولات" value={totalCommission} suffix="ر.س" icon={Banknote} /><StatCard label="العمولات المدفوعة" value={paid} suffix="ر.س" icon={CheckCircle2} /></div>

    <section className="surface-card overflow-hidden"><header className="flex items-center justify-between border-b border-border p-5"><div><h2 className="font-bold text-foreground">العملاء المنسوبون</h2><p className="mt-1 text-xs text-muted-foreground">حدث المرحلة يدويًا مع تقدم العميل في رحلة البيع أو الإيجار.</p></div><Chip tone="primary">{leads.length} عميل</Chip></header>{leads.length === 0 ? <EmptyState icon={Users} title="لم يصل عملاء من الرابط بعد" description="تظهر الطلبات هنا عند إرسال العميل نموذج عرض أو طلب عقار من خلال رابط المسوق." className="m-5" /> : <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-right text-xs"><thead className="bg-muted/50 text-muted-foreground"><tr><th className="p-3">العميل</th><th className="p-3">المصدر</th><th className="p-3">القيمة المتوقعة</th><th className="p-3">تاريخ الإسناد</th><th className="p-3">المرحلة</th></tr></thead><tbody>{leads.map((item) => <tr key={item.id} className="border-t border-border"><td className="p-3"><b className="text-foreground">{item.customer_name ?? "عميل"}</b><p dir="ltr" className="text-muted-foreground">{item.customer_phone ?? "—"}</p></td><td className="p-3">{item.source === "listing_request" ? "عرض عقار" : item.source === "supply_request" ? "طلب عقار" : "إحالة"}</td><td className="p-3">{item.estimated_value.toLocaleString("ar-SA")} ر.س</td><td className="p-3">{new Date(item.attributed_at).toLocaleDateString("ar-SA")}</td><td className="p-3"><select className={inputClass} value={item.status} onChange={(e) => updateLead.mutate({ id: item.id, status: e.target.value })}>{leadStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td></tr>)}</tbody></table></div>}</section>

    <section className="surface-card overflow-hidden"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div><h2 className="font-bold text-foreground">العمولات</h2><p className="mt-1 text-xs text-muted-foreground">العمولة لا تُعتمد تلقائيًا؛ تمر بالمراجعة والاعتماد ثم إثبات الدفع.</p></div><Button onClick={() => setCommissionOpen(true)}><Plus />تسجيل عمولة</Button></header>{commissions.length === 0 ? <EmptyState icon={Banknote} title="لا توجد عمولات مسجلة" description="سجّل العمولة بعد وجود طلب أو صفقة، ثم اعتمدها من الإدارة." className="m-5" /> : <div className="grid gap-3 p-5 lg:grid-cols-2">{commissions.map((item) => <article key={item.id} className="rounded-lg border border-border p-4"><div className="flex items-start justify-between"><div><p className="text-xl font-extrabold text-foreground">{item.amount.toLocaleString("ar-SA")} <span className="text-xs text-muted-foreground">ر.س</span></p><p className="mt-1 text-xs text-muted-foreground">أساس الحساب: {item.basis_amount.toLocaleString("ar-SA")} ر.س</p></div><Chip tone={item.status === "paid" ? "success" : item.status === "cancelled" ? "danger" : item.status === "approved" ? "primary" : "warning"}>{commissionStatuses.find(([value]) => value === item.status)?.[1] ?? item.status}</Chip></div>{item.notes ? <p className="mt-3 text-xs leading-6 text-muted-foreground">{item.notes}</p> : null}<div className="mt-4"><select className={inputClass} value={item.status} onChange={(e) => updateCommission.mutate({ id: item.id, status: e.target.value })}>{commissionStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></article>)}</div>}</section>

    <section className="surface-card p-5"><h2 className="font-bold text-foreground">آخر نشاط للرابط</h2><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visits.slice(0, 9).map((visit) => <div key={visit.id} className="flex items-center gap-3 rounded-lg border border-border p-3"><span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><MousePointerClick className="size-4" /></span><div className="min-w-0"><p dir="ltr" className="truncate text-xs font-semibold text-foreground">{visit.landing_path}</p><p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="size-3" />{new Date(visit.visited_at).toLocaleString("ar-SA")}</p></div></div>)}</div></section>

    <Modal open={commissionOpen} onClose={() => setCommissionOpen(false)} title="تسجيل عمولة للمراجعة" subtitle="لن تُعتمد أو تُدفع تلقائيًا." footer={<><GhostButton onClick={() => setCommissionOpen(false)}>إلغاء</GhostButton><PrimaryButton onClick={() => createCommission.mutate()} disabled={createCommission.isPending}>حفظ كعمولة متوقعة</PrimaryButton></>}><div className="grid gap-4"><Field label="العميل المرتبط"><select className={inputClass} value={commission.lead_id} onChange={(e) => setCommission({ ...commission, lead_id: e.target.value })}><option value="">بدون ربط بعميل</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.customer_name ?? lead.customer_phone ?? "عميل"}</option>)}</select></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="قيمة العمولة" required><input type="number" min="0" className={inputClass} value={commission.amount} onChange={(e) => setCommission({ ...commission, amount: e.target.value })} /></Field><Field label="أساس الحساب"><input type="number" min="0" className={inputClass} value={commission.basis_amount} onChange={(e) => setCommission({ ...commission, basis_amount: e.target.value })} /></Field></div><Field label="تاريخ الاستحقاق"><input type="date" className={inputClass} value={commission.due_date} onChange={(e) => setCommission({ ...commission, due_date: e.target.value })} /></Field><Field label="ملاحظات"><textarea className={textareaClass} value={commission.notes} onChange={(e) => setCommission({ ...commission, notes: e.target.value })} /></Field></div></Modal>
  </div>;
}