import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageCircle, MonitorSmartphone, QrCode, RefreshCw, Smartphone, Unlink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getWhatsAppLinkStatus, unlinkWhatsApp } from "@/lib/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/whatsapp-link")({
  head: () => ({
    meta: [
      { title: "ربط واتساب | الرشودي للعقارات" },
      {
        name: "description",
        content: "ربط رقم واتساب بالنظام عبر رمز QR لإرسال التذكيرات مباشرة من الرقم.",
      },
      { property: "og:title", content: "ربط واتساب | الرشودي للعقارات" },
      {
        property: "og:description",
        content: "ربط رقم واتساب بالنظام عبر رمز QR لإرسال التذكيرات مباشرة من الرقم.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: WhatsAppLinkPage,
});

function WhatsAppLinkPage() {
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getWhatsAppLinkStatus);
  const unlink = useServerFn(unlinkWhatsApp);
  const [line, setLine] = useState<1 | 2>(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["whatsapp-link-status", line],
    queryFn: () => fetchStatus({ data: { line } }),
    refetchInterval: 5000,
  });

  const unlinkMutation = useMutation({
    mutationFn: () => unlink({ data: { line } }),
    onSuccess: (res) => {
      if (res.ok) toast.success("تم فصل الرقم — امسح رمز QR جديد");
      else toast.error(res.error ?? "تعذر الفصل");
      void qc.invalidateQueries({ queryKey: ["whatsapp-link-status"] });
    },
  });

  const connected = data?.connection === "open";

  return (
    <div dir="rtl" className="space-y-5">
      <header className="flex items-center gap-3">
        <span className="grid size-14 place-items-center rounded-2xl bg-success text-primary-foreground shadow-md"><MessageCircle className="size-7" /></span>
        <div>
          <h1 className="text-[26px] font-extrabold text-foreground">ربط واتساب</h1>
          <p className="text-[13px] text-muted-foreground">اربط الرقم مرة واحدة بمسح رمز QR، وبعدها كل زر «إرسال» يرسل الرسالة فورًا من نفس الرقم.</p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {([
          [1, "الرقم الأساسي", "كل الرسائل والتذكيرات كما هي"],
          [2, "رقم ملاك البيع", "رسالة الجمعة 4 العصر كل أسبوعين فقط"],
        ] as const).map(([v, t, d]) => (
          <button
            key={v}
            type="button"
            onClick={() => setLine(v)}
            className={`rounded-2xl border px-4 py-2 text-start ${line === v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"}`}
          >
            <span className="block text-[13px] font-bold">{t}</span>
            <span className={`block text-[11px] ${line === v ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{d}</span>
          </button>
        ))}
      </div>

      <section className="surface-card grid gap-6 p-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <h2 className="text-[22px] font-extrabold">ربط واتساب في 3 خطوات سهلة</h2>
          <p className="text-[13px] text-muted-foreground">اربط رقم واتساب لتمكين إرسال الرسائل وإدارتها مباشرة من النظام.</p>
          {[
            { n: 1, t: "افتح واتساب", d: "افتح تطبيق واتساب على هاتفك المحمول.", i: Smartphone },
            { n: 2, t: "الأجهزة المرتبطة", d: "الإعدادات ← الأجهزة المرتبطة ← ربط جهاز.", i: MonitorSmartphone },
            { n: 3, t: "امسح الرمز", d: "وجّه الكاميرا على رمز QR الظاهر هنا.", i: QrCode },
          ].map((x) => (
            <div key={x.n} className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[color:var(--warning)]/15 text-[17px] font-extrabold text-[color:var(--warning)]">{x.n}</span>
              <div className="flex flex-1 items-center gap-3 rounded-2xl border border-border bg-card p-4">
                <span className="grid size-10 place-items-center rounded-xl bg-[color:var(--warning)]/10 text-[color:var(--warning)]"><x.i className="size-5" /></span>
                <div><p className="text-[14px] font-bold">{x.t}</p><p className="text-[12px] text-muted-foreground">{x.d}</p></div>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => qc.invalidateQueries({ queryKey: ["whatsapp-link-status"] })} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-[14px] font-bold text-primary-foreground hover:opacity-90">
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} /> تحديث الاتصال
          </button>
          <p className="text-[12px] text-muted-foreground">ملاحظة: هذا ربط عبر واتساب ويب. إن انقطع الاتصال، لن تُرسل الرسائل حتى يُعاد مسح رمز QR.</p>
        </div>
        <div className="space-y-4 rounded-2xl border border-border p-5">
          <div className={`rounded-2xl p-4 ${connected ? "bg-success/10" : "bg-primary/[0.06]"}`}>
            <p className={`flex items-center gap-2 text-[15px] font-bold ${connected ? "text-success" : "text-primary"}`}>● {connected ? "متصل" : "غير متصل"}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">{connected ? "الرقم مرتبط ويعمل" : "لم يتم ربط حساب واتساب بعد"}</p>
          </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> جارٍ التحقق من الحالة…
          </div>
        ) : !data?.configured ? (
          <div className="space-y-3 text-sm">
            <p className="font-semibold text-destructive">خدمة الربط غير مُفعّلة بعد</p>
            <p className="text-muted-foreground">
              أضف إعدادات خدمة واتساب في النظام: <code>WHATSAPP_API_URL</code> و
              <code>WHATSAPP_API_KEY</code> و<code>WHATSAPP_INSTANCE</code>. بعدها سيظهر رمز QR هنا
              مباشرة.
            </p>
          </div>
        ) : connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Smartphone className="size-5" />
              </span>
              <div>
                <p className="font-semibold">الرقم مرتبط ويعمل</p>
                <p className="text-[13px] text-muted-foreground" dir="ltr">
                  {data.me ? `+${data.me}` : "—"}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => unlinkMutation.mutate()}
              disabled={unlinkMutation.isPending}
            >
              <Unlink className="me-2 size-4" /> فصل الرقم
            </Button>
          </div>
        ) : data.qr ? (
          <div className="space-y-4">
            <p className="text-sm font-semibold">امسح الرمز من تطبيق واتساب</p>
            <ol className="list-inside list-decimal space-y-1 text-[13px] text-muted-foreground">
              <li>افتح واتساب على الجوال</li>
              <li>الإعدادات ← الأجهزة المرتبطة ← ربط جهاز</li>
              <li>وجّه الكاميرا على الرمز بالأسفل</li>
            </ol>
            <img
              src={data.qr}
              alt="رمز QR لربط رقم واتساب بالنظام"
              className="mx-auto size-64 rounded-lg border bg-white p-2"
            />
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> جارٍ تجهيز رمز QR…
            </div>
            {data.error ? <p className="text-[13px] text-destructive">{data.error}</p> : null}
          </div>
        )}

        </div>
      </section>
    </div>
  );
}
