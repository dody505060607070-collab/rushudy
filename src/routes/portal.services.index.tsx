import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Handshake, Loader2, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import partnerImage from "@/assets/almqrin-services.jpg";
import { Button } from "@/components/ui/button";
import { createServiceRequest, getMyServiceRequests, getServicePartners } from "@/lib/service-partners.functions";
import { getPortalOverview } from "@/lib/portal.functions";

export const Route = createFileRoute("/portal/services/")({
  ssr: false,
  head: () => ({ meta: [
    { title: "شركاؤنا وخدماتنا | بوابة عميل الرشودي" },
    { name: "description", content: "اطلب خدمات التنظيف ونقل الأثاث من شركاء الرشودي وتابع طلبك وفاتورتك." },
    { property: "og:title", content: "شركاؤنا وخدماتنا | بوابة عميل الرشودي" },
    { property: "og:description", content: "خدمات مختارة لعملاء الرشودي من شركات موثوقة." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: ServicesPage,
});

const statusLabels: Record<string, string> = { new: "جديد", accepted: "مقبول", in_progress: "قيد التنفيذ", completed: "مكتمل", cancelled: "ملغي" };

function ServicesPage() {
  const qc = useQueryClient();
  const partners = useQuery({ queryKey: ["service-partners"], queryFn: () => getServicePartners() });
  const overview = useQuery({ queryKey: ["portal-overview"], queryFn: () => getPortalOverview() });
  const activity = useQuery({ queryKey: ["portal-service-requests"], queryFn: () => getMyServiceRequests() });
  const [selected, setSelected] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [serviceType, setServiceType] = useState("غسيل الأثاث");
  const [details, setDetails] = useState("");
  const [phone, setPhone] = useState("");
  const [contractId, setContractId] = useState("");
  const partner = partners.data?.find((p) => p.id === selected);
  const submit = useMutation({
    mutationFn: () => createServiceRequest({ data: { partnerId: selected ?? "", address, serviceType, details, phone: phone || overview.data?.contact?.phone || "", ...(contractId ? { contractId } : {}) } }),
    onSuccess: (request) => {
      void qc.invalidateQueries({ queryKey: ["portal-service-requests"] });
      const text = [`طلب خدمة جديد من الرشودي`, `رقم الطلب: ${request.request_number}`, `العميل: ${overview.data?.contact?.full_name ?? "عميل"}`, `الجوال: ${phone || overview.data?.contact?.phone || "—"}`, `العنوان: ${address}`, `الخدمة: ${serviceType}`, `التفاصيل: ${details}`].join("\n");
      const digits = (partner?.whatsapp_number ?? "").replace(/\D/g, "");
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
      toast.success("تم حفظ الطلب وفتح رسالته الجاهزة على واتساب");
      setDetails(""); setAddress(""); setSelected(null);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر حفظ الطلب"),
  });
  const contracts = overview.data?.contracts ?? [];
  return <div className="space-y-6">
    <header><h1 className="flex items-center gap-2 text-xl font-black"><Handshake className="size-6 text-primary" /> شركاؤنا وخدماتنا</h1><p className="mt-1 text-sm text-muted-foreground">اختر الشركة المناسبة، اكتب طلبك، ثم أكّد فتح الرسالة الجاهزة للشركة.</p></header>
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{partners.data?.map((item) => <article key={item.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-card"><img src={item.image_key === "almqrin-services" ? partnerImage : partnerImage} alt={item.name} width={1200} height={912} loading="lazy" className="aspect-[4/3] w-full object-cover" /><div className="p-5"><p className="text-xs font-bold text-primary">{item.category}</p><h2 className="mt-1 text-lg font-black">{item.name}</h2><p className="mt-2 text-sm leading-7 text-muted-foreground">{item.description}</p><div className="mt-3 flex flex-wrap gap-2">{item.services.map((s) => <span key={s} className="rounded-full bg-muted px-3 py-1 text-xs">{s}</span>)}</div><Button className="mt-5 w-full" onClick={() => { setSelected(item.id); setPhone(overview.data?.contact?.phone ?? ""); }}>اطلب الخدمة <ArrowLeft className="size-4" /></Button></div></article>)}</div>
    {selected && partner ? <section className="rounded-xl border border-border bg-card p-5"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">طلب من {partner.name}</h2><p className="text-xs text-muted-foreground">لن يُفتح واتساب إلا بعد ضغطك على التأكيد.</p></div><Button variant="ghost" onClick={() => setSelected(null)}>إغلاق</Button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">العنوان<input className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3" value={address} onChange={(e) => setAddress(e.target.value)} /></label><label className="text-sm font-semibold">رقم الجوال<input dir="ltr" className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-end" value={phone} onChange={(e) => setPhone(e.target.value)} /></label><label className="text-sm font-semibold">الخدمة<select className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3" value={serviceType} onChange={(e) => setServiceType(e.target.value)}>{partner.services.map((s) => <option key={s}>{s}</option>)}</select></label><label className="text-sm font-semibold">العقد (اختياري)<select className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3" value={contractId} onChange={(e) => setContractId(e.target.value)}><option value="">بدون عقد</option>{contracts.map((c) => <option key={c.id} value={c.id}>عقد {c.contract_number}</option>)}</select></label><label className="text-sm font-semibold sm:col-span-2">المشكلة أو تفاصيل المطلوب<textarea className="mt-1 min-h-28 w-full rounded-lg border border-border bg-background p-3" value={details} onChange={(e) => setDetails(e.target.value)} /></label></div><Button className="mt-4" disabled={submit.isPending || !address || !details} onClick={() => submit.mutate()}>{submit.isPending ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />} تأكيد وفتح واتساب</Button></section> : null}
    <section><h2 className="text-base font-bold">طلباتي السابقة</h2><div className="mt-3 space-y-2">{activity.data?.requests.map((r) => <article key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"><div><p className="font-bold">{r.request_number} — {r.partner?.name}</p><p className="text-xs text-muted-foreground">{r.service_type} • {r.address}</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{statusLabels[r.status] ?? r.status}</span></article>)}</div></section>
  </div>;
}
