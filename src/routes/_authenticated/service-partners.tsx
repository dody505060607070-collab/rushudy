import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Handshake, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import partnerImage from "@/assets/almqrin-services.jpg";
import { PageHero } from "@/components/kit/PageHero";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { issueServicePartnerAccess } from "@/lib/service-partners.functions";

export const Route = createFileRoute("/_authenticated/service-partners")({ head: () => ({ meta: [{ title: "شركاء الخدمات | الرشودي للعقارات" }, { name: "description", content: "إدارة شركات الخدمات وطلبات العملاء وفواتير الشركاء." }, { property: "og:title", content: "شركاء الخدمات | الرشودي للعقارات" }, { property: "og:description", content: "إدارة شركات الخدمات وطلبات العملاء." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: AdminPartners });

function AdminPartners() {
  const qc = useQueryClient(); const [credentials, setCredentials] = useState<{email:string;password:string}|null>(null);
  const data = useQuery({ queryKey: ["admin-service-partners"], queryFn: async () => { const [p,r,i] = await Promise.all([supabase.from("service_partners").select("*"), supabase.from("service_partner_requests").select("*"), supabase.from("service_partner_invoices").select("*")]); if(p.error) throw p.error; return { partners:p.data??[], requests:r.data??[], invoices:i.data??[] }; } });
  const issue = useMutation({ mutationFn: (partnerId:string) => issueServicePartnerAccess({ data:{ partnerId, email:"mokren@gmail.com" } }), onSuccess:(value)=>{setCredentials(value); void qc.invalidateQueries({queryKey:["admin-service-partners"]}); toast.success("تم إصدار حساب الشركة");}, onError:(e)=>toast.error(e instanceof Error?e.message:"تعذّر إصدار الحساب") });
  return <div className="space-y-6"><PageHero title="شركاء الخدمات" subtitle="إدارة الشركات وطلبات العملاء والفواتير" icon={Handshake} stats={[{value:String(data.data?.partners.length??0),label:"شركة"},{value:String(data.data?.requests.length??0),label:"طلب"},{value:String(data.data?.invoices.length??0),label:"فاتورة"}]} />{data.data?.partners.map((p)=><article key={p.id} className="grid gap-5 rounded-xl border border-border bg-card p-5 md:grid-cols-[180px_1fr_auto]"><img src={partnerImage} alt={p.name} width={1200} height={912} loading="lazy" className="aspect-[4/3] w-full rounded-lg object-cover"/><div><h2 className="text-lg font-black">{p.name}</h2><p className="text-sm text-muted-foreground">{p.category} • {p.whatsapp_number}</p><p className="mt-2 text-sm">{p.description}</p></div><Button onClick={()=>issue.mutate(p.id)} disabled={issue.isPending}><KeyRound className="size-4"/> إصدار/تغيير بيانات الدخول</Button></article>)}{credentials?<section className="rounded-xl border border-primary/30 bg-primary/5 p-5"><h2 className="font-bold">بيانات الدخول الجديدة — انسخها الآن</h2><p dir="ltr" className="mt-3 text-end font-mono">Email: {credentials.email}</p><p dir="ltr" className="text-end font-mono">Password: {credentials.password}</p><p className="mt-2 text-xs text-muted-foreground">لن يحتفظ النظام بنسخة قابلة للعرض من كلمة المرور.</p></section>:null}<section className="space-y-2"><h2 className="font-bold">أحدث الطلبات</h2>{data.data?.requests.slice(0,20).map(r=><div key={r.id} className="flex flex-wrap justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm"><b>{r.request_number} — {r.customer_name}</b><span>{r.service_type}</span><span>{r.status}</span></div>)}</section></div>;
}