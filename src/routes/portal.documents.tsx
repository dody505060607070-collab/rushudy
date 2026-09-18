import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlarmClock, FileSignature, FileText, PenLine } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Empty, Field, Pill, PortalCard, Stat, btnGhost, btnPrimary, inputClass, num } from "@/components/portal/ui";
import {
  getOwnerInsights,
  getOwnerWorkspace,
  requestOwnerSignatureOtp,
  setOwnerDocumentExpiry,
  signOwnerDocument,
} from "@/lib/owner-portal.functions";

export const Route = createFileRoute("/portal/documents")({
  head: () => ({
    meta: [
      { title: "مستنداتي والتوقيع | بوابة المالك" },
      { name: "description", content: "أرشيف صكوك ورخص وعقود المالك مع تنبيه انتهاء الصلاحية والتوقيع الإلكتروني برمز تحقق." },
      { property: "og:title", content: "مستنداتي والتوقيع | بوابة المالك" },
      { property: "og:description", content: "أرشيف المستندات وتنبيهات الصلاحية والتوقيع الإلكتروني." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OwnerDocumentsPage,
});

function OwnerDocumentsPage() {
  const qc = useQueryClient();
  const insights = useQuery({ queryKey: ["owner-insights"], queryFn: () => getOwnerInsights() });
  const workspace = useQuery({ queryKey: ["owner-workspace"], queryFn: () => getOwnerWorkspace() });

  const [docTitle, setDocTitle] = useState("");
  const [issued, setIssued] = useState<{ id: string; code: string } | null>(null);
  const [otp, setOtp] = useState("");
  const [signature, setSignature] = useState("");

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["owner-workspace"] });
    void qc.invalidateQueries({ queryKey: ["owner-insights"] });
  };

  const setExpiry = useMutation({
    mutationFn: (input: { id: string; expiresAt: string | null }) => setOwnerDocumentExpiry({ data: input }),
    onSuccess: () => {
      toast.success("تم تحديث تاريخ الصلاحية");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const requestOtp = useMutation({
    mutationFn: () => requestOwnerSignatureOtp({ data: { docTitle: docTitle.trim() } }),
    onSuccess: (res) => {
      setIssued({ id: res.id, code: res.code });
      toast.success("تم إصدار رمز التحقق");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sign = useMutation({
    mutationFn: () => signOwnerDocument({ data: { id: issued!.id, code: otp.trim(), signatureText: signature.trim() } }),
    onSuccess: () => {
      toast.success("تم توقيع المستند");
      setIssued(null);
      setOtp("");
      setSignature("");
      setDocTitle("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const docs = workspace.data?.documents ?? [];
  const expiring = insights.data?.expiringDocs ?? [];
  const signatures = workspace.data?.signatures ?? [];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="مستنداتي" value={num(docs.length)} />
        <Stat label="قاربت على الانتهاء" value={num(expiring.length)} tone={expiring.length ? "warn" : "good"} />
        <Stat label="مستندات موقّعة" value={num(signatures.filter((s) => s.status === "signed").length)} tone="good" />
      </div>

      <PortalCard title="تنبيهات انتهاء الصلاحية" icon={AlarmClock} subtitle="صكوك ورخص تنتهي خلال 120 يومًا">
        {expiring.length === 0 ? (
          <Empty text="لا توجد مستندات قاربت على الانتهاء." />
        ) : (
          <ul className="space-y-2">
            {expiring.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-[12.5px]">
                <span>
                  <span className="font-semibold text-foreground">{d.title}</span>
                  <span className="block text-[11px] text-muted-foreground">تنتهي في {d.expires_at}</span>
                </span>
                <Pill tone={d.daysLeft <= 30 ? "bad" : d.daysLeft <= 60 ? "warn" : "info"}>
                  {d.daysLeft >= 0 ? `متبقٍ ${d.daysLeft} يوم` : "منتهية"}
                </Pill>
              </li>
            ))}
          </ul>
        )}
      </PortalCard>

      <PortalCard title="أرشيف مستنداتي" icon={FileText} subtitle="الصكوك والعقود والرخص — يمكنك تحديد تاريخ انتهاء كل مستند">
        {docs.length === 0 ? (
          <Empty text="لا توجد مستندات مرفوعة بعد." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {docs.map((d) => (
              <article key={d.id} className="rounded-xl border border-border p-4 text-[12.5px]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-foreground">{d.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{d.doc_type} · {String(d.created_at).slice(0, 10)}</p>
                  </div>
                  {d.url ? (
                    <a className={btnGhost} href={d.url} target="_blank" rel="noreferrer">
                      فتح
                    </a>
                  ) : null}
                </div>
                <div className="mt-3 flex items-end gap-2">
                  <div className="flex-1">
                    <Field label="تاريخ انتهاء الصلاحية">
                      <input
                        type="date"
                        className={inputClass}
                        defaultValue={d.expires_at ?? ""}
                        onBlur={(e) => {
                          const value = e.target.value || null;
                          if (value !== (d.expires_at ?? null)) setExpiry.mutate({ id: d.id, expiresAt: value });
                        }}
                      />
                    </Field>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </PortalCard>

      <PortalCard title="التوقيع الإلكتروني" icon={FileSignature} subtitle="وقّع عقود الإدارة والتجديدات من جوالك برمز تحقق">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <Field label="اسم المستند المطلوب توقيعه">
              <input className={inputClass} value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="مثال: عقد إدارة أملاك 2026" />
            </Field>
          </div>
          <button type="button" className={btnPrimary} disabled={requestOtp.isPending || docTitle.trim().length < 3} onClick={() => requestOtp.mutate()}>
            <PenLine className="h-4 w-4" /> إصدار رمز التحقق
          </button>
        </div>

        {issued ? (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-[12.5px] text-foreground">
              رمز التحقق الخاص بك: <span className="font-extrabold tracking-widest">{issued.code}</span> — صالح لمدة 10 دقائق.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="أدخل رمز التحقق">
                <input className={inputClass} inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value)} />
              </Field>
              <Field label="اكتب اسمك كتوقيع">
                <input className={inputClass} value={signature} onChange={(e) => setSignature(e.target.value)} />
              </Field>
            </div>
            <button type="button" className={`${btnPrimary} mt-3`} disabled={sign.isPending} onClick={() => sign.mutate()}>
              توقيع المستند
            </button>
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          {signatures.length === 0 ? (
            <Empty text="لا توجد مستندات موقّعة بعد." />
          ) : (
            signatures.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-[12.5px]">
                <span>
                  <span className="font-semibold text-foreground">{s.doc_title}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {s.signed_at ? `وُقّع في ${String(s.signed_at).slice(0, 10)}` : "بانتظار التوقيع"}
                  </span>
                </span>
                <Pill tone={s.status === "signed" ? "good" : s.status === "cancelled" ? "bad" : "warn"}>
                  {s.status === "signed" ? "موقّع" : s.status === "cancelled" ? "ملغي" : "قيد التوقيع"}
                </Pill>
              </div>
            ))
          )}
        </div>
      </PortalCard>
    </div>
  );
}
