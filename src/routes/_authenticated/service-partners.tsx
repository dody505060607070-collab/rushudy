import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Handshake, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import partnerImage from "@/assets/almqrin-services.jpg";
import { PageHero } from "@/components/kit/PageHero";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { issueServicePartnerAccess, updatePartnerVideos } from "@/lib/service-partners.functions";

export const Route = createFileRoute("/_authenticated/service-partners")({ head: () => ({ meta: [{ title: "شركاء الخدمات | الرشودي للعقارات" }, { name: "description", content: "إدارة شركات الخدمات وطلبات العملاء وفواتير الشركاء." }, { property: "og:title", content: "شركاء الخدمات | الرشودي للعقارات" }, { property: "og:description", content: "إدارة شركات الخدمات وطلبات العملاء." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: AdminPartners });

function AdminPartners() {
  const qc = useQueryClient(); const [credentials, setCredentials] = useState<{email:string;password:string}|null>(null);
  const data = useQuery({ queryKey: ["admin-service-partners"], queryFn: async () => { const [p,r,i] = await Promise.all([supabase.from("service_partners").select("*"), supabase.from("service_partner_requests").select("*"), supabase.from("service_partner_invoices").select("*")]); if(p.error) throw p.error; return { partners:p.data??[], requests:r.data??[], invoices:i.data??[] }; } });
  const issue = useMutation({ mutationFn: (partnerId:string) => issueServicePartnerAccess({ data:{ partnerId, email:"mokren@gmail.com" } }), onSuccess:(value)=>{setCredentials(value); void qc.invalidateQueries({queryKey:["admin-service-partners"]}); toast.success("تم إصدار حساب الشركة");}, onError:(e)=>toast.error(e instanceof Error?e.message:"تعذّر إصدار الحساب") });
  const videos = useMutation({ mutationFn: (input:{partnerId:string;videoUrls:string[]}) => updatePartnerVideos({ data: input }), onSuccess: () => { void qc.invalidateQueries({queryKey:["admin-service-partners"]}); toast.success("تم حفظ روابط الفيديو"); }, onError:(e)=>toast.error(e instanceof Error?e.message:"تعذّر حفظ الروابط") });
  const partners = data.data?.partners ?? [];
  const requests = data.data?.requests ?? [];
  return <div className="space-y-6">
    <PageHero title="شركاء الخدمات" subtitle="إدارة الشركات وطلبات العملاء والفواتير" icon={Handshake} stats={[{value:String(partners.length),label:"شركة"},{value:String(requests.length),label:"طلب"},{value:String(data.data?.invoices.length??0),label:"فاتورة"}]} />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {partners.map((p)=><article key={p.id} className="surface-card flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3"><img src={partnerImage} alt={p.name} width={1200} height={912} loading="lazy" className="size-14 rounded-full object-cover ring-2 ring-primary/20"/><div><h2 className="text-[16px] font-black">{p.name}</h2><p className="text-[12px] text-muted-foreground">{p.category}</p></div></div>
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] font-semibold text-success"><span className="size-1.5 rounded-full bg-success"/>نشط</span>
        </div>
        {p.description ? <p className="text-[12.5px] text-muted-foreground">{p.description}</p> : null}
        <div className="grid grid-cols-2 gap-2 text-[12px]"><div className="rounded-xl bg-muted/50 px-3 py-2"><p className="text-muted-foreground">رقم التواصل</p><b dir="ltr" className="block text-end">{p.whatsapp_number ?? "—"}</b></div><div className="rounded-xl bg-muted/50 px-3 py-2"><p className="text-muted-foreground">الطلبات</p><b>{requests.filter((r)=>r.partner_id===p.id).length}</b></div></div>
        <details className="rounded-xl border border-border px-3 py-2 text-[12.5px]"><summary className="cursor-pointer font-semibold">روابط الفيديو</summary><textarea dir="ltr" defaultValue={(p.video_urls??[]).join("\n")} onBlur={(e)=>videos.mutate({partnerId:p.id, videoUrls:e.target.value.split("\n").map((v)=>v.trim()).filter(Boolean)})} className="mt-2 min-h-24 w-full rounded-lg border border-border bg-background p-3 text-end text-xs"/><p className="text-[11px] text-muted-foreground">رابط في كل سطر — تُحفظ بعد الخروج من الحقل وتظهر في صفحة الشركة داخل البوابة.</p></details>
        <Button className="mt-auto" onClick={()=>issue.mutate(p.id)} disabled={issue.isPending}><KeyRound className="size-4"/> إصدار/تغيير بيانات الدخول</Button>
      </article>)}
    </div>
    {credentials?<section className="rounded-xl border border-primary/30 bg-primary/5 p-5"><h2 className="font-bold">بيانات الدخول الجديدة — انسخها الآن</h2><p dir="ltr" className="mt-3 text-end font-mono">Email: {credentials.email}</p><p dir="ltr" className="text-end font-mono">Password: {credentials.password}</p><p className="mt-2 text-xs text-muted-foreground">لن يحتفظ النظام بنسخة قابلة للعرض من كلمة المرور.</p></section>:null}
    <section className="surface-card overflow-hidden"><header className="p-4"><h2 className="text-[17px] font-bold">أحدث طلبات الخدمات</h2><p className="text-[12px] text-muted-foreground">آخر الطلبات المرسلة من العملاء لشركات الخدمات</p></header>
      <div className="overflow-x-auto"><table className="w-full text-[12.5px]"><thead className="bg-muted/60 text-muted-foreground"><tr><th className="px-4 py-2.5 text-start">رقم الطلب</th><th className="px-4 py-2.5 text-start">العميل</th><th className="px-4 py-2.5 text-start">نوع الخدمة</th><th className="px-4 py-2.5 text-start">الشركة</th><th className="px-4 py-2.5 text-start">الحالة</th><th className="px-4 py-2.5 text-start">التاريخ</th></tr></thead>
      <tbody>{requests.slice(0,20).map(r=><tr key={r.id} className="border-t border-border"><td className="px-4 py-2.5 font-semibold" dir="ltr">{r.request_number}</td><td className="px-4 py-2.5">{r.customer_name}</td><td className="px-4 py-2.5">{r.service_type}</td><td className="px-4 py-2.5">{partners.find((p)=>p.id===r.partner_id)?.name ?? "—"}</td><td className="px-4 py-2.5"><span className="rounded-full bg-accent-2/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent-2">{r.status}</span></td><td className="px-4 py-2.5">{r.created_at ? new Date(r.created_at).toLocaleDateString("ar-SA") : "—"}</td></tr>)}
      {requests.length===0?<tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">لا توجد طلبات بعد</td></tr>:null}</tbody></table></div>
    </section>
  </div>;
}
