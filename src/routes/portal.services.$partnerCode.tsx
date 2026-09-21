import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Loader2, MessageCircle, Phone, PlayCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import partnerImage from "@/assets/almqrin-services.jpg";
import { Button } from "@/components/ui/button";
import { getPortalOverview } from "@/lib/portal.functions";
import { createServiceRequest, getServicePartnerByCode } from "@/lib/service-partners.functions";

export const Route = createFileRoute("/portal/services/$partnerCode")({
  ssr: false,
  head: () => ({ meta: [
    { title: "صفحة شركة الخدمات | بوابة الرشودي" },
    { name: "description", content: "معلومات شركة الخدمات وخدماتها وأرقام تواصلها وفيديوهاتها وطلب الخدمة مباشرة." },
    { property: "og:title", content: "صفحة شركة الخدمات | بوابة الرشودي" },
    { property: "og:description", content: "تفاصيل شركة الخدمات المعتمدة لدى الرشودي وطلب خدمتها." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: PartnerPage,
});

/** يحوّل رابط يوتيوب إلى رابط تضمين قابل للتشغيل داخل الصفحة. */
function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
  if (yt?.[1]) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo?.[1]) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

function PartnerPage() {
  const { partnerCode } = Route.useParams();
  const qc = useQueryClient();
  const partnerQuery = useQuery({
    queryKey: ["service-partner", partnerCode],
    queryFn: () => getServicePartnerByCode({ data: { code: partnerCode } }),
  });
  const overview = useQuery({ queryKey: ["portal-overview"], queryFn: () => getPortalOverview() });
  const partner = partnerQuery.data;

  const [address, setAddress] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [details, setDetails] = useState("");
  const [phone, setPhone] = useState("");
  const [contractId, setContractId] = useState("");
  const contracts = overview.data?.contracts ?? [];

  const submit = useMutation({
    mutationFn: () =>
      createServiceRequest({
        data: {
          partnerId: partner?.id ?? "",
          address,
          serviceType: serviceType || partner?.services?.[0] || "خدمة",
          details,
          phone: phone || overview.data?.contact?.phone || "",
          ...(contractId ? { contractId } : {}),
        },
      }),
    onSuccess: (request) => {
      void qc.invalidateQueries({ queryKey: ["portal-service-requests"] });
      const text = [
        "طلب خدمة جديد من الرشودي",
        `رقم الطلب: ${request.request_number}`,
        `العميل: ${overview.data?.contact?.full_name ?? "عميل"}`,
        `الجوال: ${phone || overview.data?.contact?.phone || "—"}`,
        `العنوان: ${address}`,
        `الخدمة: ${serviceType || partner?.services?.[0] || "خدمة"}`,
        `التفاصيل: ${details}`,
      ].join("\n");
      const digits = (partner?.whatsapp_number ?? "").replace(/\D/g, "");
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
      toast.success("تم حفظ الطلب وفتح رسالته الجاهزة على واتساب");
      setDetails("");
      setAddress("");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر حفظ الطلب"),
  });

  if (partnerQuery.isLoading) return <Loader2 className="size-6 animate-spin text-primary" />;
  if (partnerQuery.error) return <p className="text-destructive">{(partnerQuery.error as Error).message}</p>;
  if (!partner) return null;

  const videos = partner.video_urls ?? [];

  return (
    <div className="space-y-6">
      <Link to="/portal/services" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
        <ArrowRight className="size-4" /> رجوع إلى شركاؤنا وخدماتنا
      </Link>

      <header className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <img src={partnerImage} alt={partner.name} width={1600} height={900} className="h-56 w-full object-cover" />
        <div className="p-5">
          <p className="text-xs font-bold text-primary">{partner.category}</p>
          <h1 className="mt-1 text-2xl font-black">{partner.name}</h1>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">{partner.description}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {partner.services.map((s) => (
              <span key={s} className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{s}</span>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a href={`tel:${partner.whatsapp_number}`} dir="ltr">
                <Phone className="size-4" /> {partner.whatsapp_number}
              </a>
            </Button>
            <Button asChild variant="outline">
              <a
                href={`https://wa.me/${(partner.whatsapp_number ?? "").replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="size-4" /> واتساب الشركة
              </a>
            </Button>
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <PlayCircle className="size-5 text-primary" /> فيديوهات الشركة
        </h2>
        {videos.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">لا توجد فيديوهات مضافة لهذه الشركة حتى الآن.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {videos.map((url) => {
              const embed = embedUrl(url);
              return embed ? (
                <iframe
                  key={url}
                  src={embed}
                  title={`${partner.name} - فيديو`}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                  allowFullScreen
                  className="aspect-video w-full rounded-lg border border-border"
                />
              ) : (
                <video key={url} src={url} controls preload="metadata" className="aspect-video w-full rounded-lg border border-border" />
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold">اطلب الخدمة من {partner.name}</h2>
        <p className="text-xs text-muted-foreground">لن يُفتح واتساب إلا بعد ضغطك على التأكيد.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            العنوان
            <input
              className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
          <label className="text-sm font-semibold">
            رقم الجوال
            <input
              dir="ltr"
              className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-end"
              value={phone || overview.data?.contact?.phone || ""}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label className="text-sm font-semibold">
            الخدمة
            <select
              className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3"
              value={serviceType || partner.services[0] || ""}
              onChange={(e) => setServiceType(e.target.value)}
            >
              {partner.services.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            العقد (اختياري)
            <select
              className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3"
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
            >
              <option value="">بدون عقد</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>عقد {c.contract_number}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            المشكلة أو تفاصيل المطلوب
            <textarea
              className="mt-1 min-h-28 w-full rounded-lg border border-border bg-background p-3"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </label>
        </div>
        <Button className="mt-4" disabled={submit.isPending || !address || !details} onClick={() => submit.mutate()}>
          {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />} تأكيد وفتح واتساب
        </Button>
      </section>
    </div>
  );
}
