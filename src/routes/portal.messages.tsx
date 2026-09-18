import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, Copy, Link2, MessageSquare, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Empty, Field, Pill, PortalCard, Stat, btnGhost, btnPrimary, inputClass, num } from "@/components/portal/ui";
import {
  createOwnerShareLink,
  getOwnerWorkspace,
  markOwnerNotificationsRead,
  revokeOwnerShareLink,
  sendOwnerMessage,
} from "@/lib/owner-portal.functions";

export const Route = createFileRoute("/portal/messages")({
  head: () => ({
    meta: [
      { title: "رسائلي وإشعاراتي | بوابة المالك" },
      { name: "description", content: "مركز رسائل المالك مع المكتب، الإشعارات، ومشاركة تقرير الأداء برابط مؤقت." },
      { property: "og:title", content: "رسائلي وإشعاراتي | بوابة المالك" },
      { property: "og:description", content: "مراسلة المكتب ومتابعة الإشعارات ومشاركة تقرير الأداء." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OwnerMessagesPage,
});

function OwnerMessagesPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["owner-workspace"], queryFn: () => getOwnerWorkspace() });
  const [body, setBody] = useState("");
  const [label, setLabel] = useState("");
  const [days, setDays] = useState("7");

  const refresh = () => qc.invalidateQueries({ queryKey: ["owner-workspace"] });

  const send = useMutation({
    mutationFn: () => sendOwnerMessage({ data: { body: body.trim() } }),
    onSuccess: () => {
      setBody("");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const readAll = useMutation({
    mutationFn: () => markOwnerNotificationsRead({ data: {} }),
    onSuccess: () => refresh(),
  });

  const createLink = useMutation({
    mutationFn: () => createOwnerShareLink({ data: { label: label.trim(), days: Number(days) } }),
    onSuccess: (res) => {
      const url = `${window.location.origin}/owner-report/${res.token}`;
      void navigator.clipboard?.writeText(url);
      toast.success("تم إنشاء الرابط ونسخه");
      setLabel("");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeOwnerShareLink({ data: { id } }),
    onSuccess: () => {
      toast.success("تم إلغاء الرابط");
      void refresh();
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">جاري التحميل…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const unread = data.notifications.filter((n) => !n.is_read);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="رسائل" value={num(data.messages.length)} />
        <Stat label="إشعارات غير مقروءة" value={num(unread.length)} tone={unread.length ? "warn" : "good"} />
        <Stat label="روابط مشاركة فعّالة" value={num(data.shareLinks.filter((l) => !l.revoked).length)} />
      </div>

      <PortalCard title="مركز الرسائل مع المكتب" icon={MessageSquare} subtitle="كل مراسلاتك في مكان واحد بدل رسائل متفرقة">
        <div className="max-h-[22rem] space-y-2 overflow-y-auto rounded-xl border border-border bg-muted/30 p-3">
          {data.messages.length === 0 ? (
            <Empty text="ابدأ المحادثة برسالتك الأولى." />
          ) : (
            data.messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-[12.5px] ${
                  m.sender === "owner" ? "ms-auto bg-primary text-primary-foreground" : "bg-card text-foreground border border-border"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.body}</p>
                <span className={`mt-1 block text-[10.5px] ${m.sender === "owner" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {String(m.created_at).slice(0, 16).replace("T", " ")}
                </span>
              </div>
            ))
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[16rem] flex-1">
            <Field label="رسالتك">
              <input
                className={inputClass}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && body.trim().length > 1) send.mutate();
                }}
                placeholder="اكتب رسالتك للمكتب…"
              />
            </Field>
          </div>
          <button type="button" className={btnPrimary} disabled={send.isPending || body.trim().length < 2} onClick={() => send.mutate()}>
            <Send className="h-4 w-4" /> إرسال
          </button>
        </div>
      </PortalCard>

      <PortalCard
        title="الإشعارات"
        icon={Bell}
        subtitle="دفعة وصلت، عقد قارب على الانتهاء، بلاغ صيانة جديد"
        action={
          unread.length ? (
            <button type="button" className={btnGhost} onClick={() => readAll.mutate()}>
              تعليم الكل كمقروء
            </button>
          ) : null
        }
      >
        {data.notifications.length === 0 ? (
          <Empty text="لا توجد إشعارات." />
        ) : (
          <ul className="space-y-2">
            {data.notifications.map((n) => (
              <li
                key={n.id}
                className={`rounded-lg border px-3 py-2 text-[12.5px] ${n.is_read ? "border-border" : "border-primary/40 bg-primary/5"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">{n.title}</span>
                  <span className="text-[11px] text-muted-foreground">{String(n.created_at).slice(0, 10)}</span>
                </div>
                {n.body ? <p className="mt-1 text-muted-foreground">{n.body}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </PortalCard>

      <PortalCard title="مشاركة تقرير أدائي" icon={Link2} subtitle="رابط مؤقت للمحاسب أو الشريك — بيانات ملخصة فقط بدون بيانات المستأجرين">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="وصف الرابط">
            <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="المحاسب" />
          </Field>
          <Field label="مدة الصلاحية (أيام)">
            <input className={inputClass} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <button type="button" className={btnPrimary} disabled={createLink.isPending} onClick={() => createLink.mutate()}>
              <Link2 className="h-4 w-4" /> إنشاء رابط
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {data.shareLinks.length === 0 ? (
            <Empty text="لا توجد روابط مشاركة." />
          ) : (
            data.shareLinks.map((l) => {
              const url = `${window.location.origin}/owner-report/${l.token}`;
              const expired = new Date(l.expires_at).getTime() < Date.now();
              return (
                <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-[12.5px]">
                  <span>
                    <span className="font-semibold text-foreground">{l.label ?? "رابط تقرير"}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      ينتهي {String(l.expires_at).slice(0, 10)} · {num(l.views ?? 0)} مشاهدة
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Pill tone={l.revoked ? "bad" : expired ? "warn" : "good"}>{l.revoked ? "ملغي" : expired ? "منتهٍ" : "فعّال"}</Pill>
                    {!l.revoked && !expired ? (
                      <>
                        <button
                          type="button"
                          className={btnGhost}
                          onClick={() => {
                            void navigator.clipboard?.writeText(url);
                            toast.success("تم نسخ الرابط");
                          }}
                        >
                          <Copy className="h-4 w-4" /> نسخ
                        </button>
                        <button type="button" className={btnGhost} onClick={() => revoke.mutate(l.id)}>
                          <Trash2 className="h-4 w-4" /> إلغاء
                        </button>
                      </>
                    ) : null}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </PortalCard>
    </div>
  );
}
