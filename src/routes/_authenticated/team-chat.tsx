import { uploadMedia, mediaUrl } from "@/lib/media";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Info, Loader2, MessagesSquare, Paperclip, Pencil, Pin, Reply, Search, Send, Smile, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { DirectChats } from "@/components/chat/DirectChats";
import { PageHero } from "@/components/kit/PageHero";
import { PrimaryButton, inputClass } from "@/components/kit/Modal";
import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { mithraa } from "@/integrations/mithraa/client";
import { signInToMithraa, signOutMithraa, useMithraaSession } from "@/integrations/mithraa/useMithraaSession";
import { clearMithraaLink, getMithraaLink, saveMithraaLink } from "@/lib/mithraa-link.functions";
import { sendPushToUsers } from "@/lib/push.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/team-chat")({
  head: () => ({
    meta: [
      { title: "شات الموظفين | الرشودي للعقارات" },
      { name: "description", content: "محادثة جماعية داخلية لجميع موظفي الشركة." },
      { property: "og:title", content: "شات الموظفين | الرشودي للعقارات" },
      { property: "og:description", content: "محادثة جماعية داخلية لجميع موظفي الشركة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamChatPage,
});

type Msg = {
  id: string;
  sender_id: string;
  body: string | null;
  reply_to: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  edited_at: string | null;
  is_pinned: boolean;
  deleted_at: string | null;
  created_at: string;
  channel: string;
  sender: { full_name: string; job_title: string | null; avatar_url: string | null } | null;
};

const EMOJIS = ["👍", "🙏", "🔥", "✅", "❤️", "😀", "😅", "🎉", "📌", "📞", "🏠", "💰", "⏰", "📄"];

export function TeamChatPage() {
  const qc = useQueryClient();
  const { userId, isSuperAdmin, profile } = useCurrentUser();
  const { mithraaUser, ready } = useMithraaSession();
  const chatUserId = mithraaUser?.id;
  const [activeChannel, setActiveChannel] = useState<"rashoudi" | "shared">("rashoudi");
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [editing, setEditing] = useState<Msg | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const [autoDone, setAutoDone] = useState(false);
  const autoTried = useRef(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [membersOpenMobile, setMembersOpenMobile] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  // دخول تلقائي للشات المشترك ببيانات الربط المحفوظة (ربط مرة واحدة فقط)
  useEffect(() => {
    if (!ready || chatUserId || autoTried.current) return;
    autoTried.current = true;
    void (async () => {
      try {
        const link = await getMithraaLink();
        if (link.linked) await signInToMithraa(link.email, link.password, profile?.full_name);
      } catch {
        /* لا شيء — تظهر بطاقة الربط */
      } finally {
        setAutoDone(true);
      }
    })();
  }, [ready, chatUserId, profile?.full_name]);

  const messages = useQuery({
    queryKey: ["group-messages", activeChannel, chatUserId],
    enabled: Boolean(chatUserId),
    refetchInterval: 4000,
    queryFn: async () => {
      const { data, error } = await mithraa
        .from("group_messages")
        .select("id, sender_id, body, reply_to, is_pinned, deleted_at, created_at, channel, attachment_path, attachment_name, edited_at, sender:sender_id(full_name, job_title, avatar_url)")
        .eq("channel", activeChannel)
        .order("created_at")
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Msg[];
    },
  });

  const staff = useQuery({
    queryKey: ["profiles", "team-chat", activeChannel, chatUserId],
    enabled: Boolean(chatUserId),
    queryFn: async () => {
      const { data, error } = await mithraa
        .from("profiles")
        .select("id, full_name, job_title, avatar_url, org")
        .eq("is_active", true)
        .in("org", activeChannel === "shared" ? ["rashoudi", "mithraa"] : ["rashoudi"])
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string; job_title: string | null; avatar_url: string | null; org: string }[];
    },
  });

  // بث لحظي لرسائل المجموعة من قاعدة مثراء
  useEffect(() => {
    if (!chatUserId) return;
    const channel = mithraa
      .channel("group-messages-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "group_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["group-messages", activeChannel, chatUserId] });
      })
      .subscribe();
    return () => {
      void mithraa.removeChannel(channel);
    };
  }, [qc, activeChannel, chatUserId]);

  const all = messages.data ?? [];
  const byId = useMemo(() => new Map(all.map((m) => [m.id, m])), [all]);
  const pinned = all.filter((m) => m.is_pinned && !m.deleted_at);
  const rows = useMemo(() => {
    const q = search.trim();
    return q ? all.filter((m) => (m.body ?? "").includes(q)) : all;
  }, [all, search]);
  const channelLabel = activeChannel === "shared" ? "الشات المشترك" : "فريق الرشودي";
  const initialsOf = (name: string) =>
    name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("") || "؟";
  const dayLabel = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const formatted = d.toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long" });
    return isToday ? `اليوم ${formatted}` : formatted;
  };
  const filteredStaff = useMemo(() => {
    const q = memberSearch.trim();
    const list = staff.data ?? [];
    return q ? list.filter((p) => p.full_name.includes(q)) : list;
  }, [staff.data, memberSearch]);

  useEffect(() => {
    if (!search) bottom.current?.scrollIntoView({ block: "end" });
  }, [all.length, search]);

  const send = useMutation({
    mutationFn: async () => {
      const text = body.trim();
      if (!text) return;
      if (!chatUserId) throw new Error("سجّل الدخول إلى الشات المشترك أولًا");
      if (editing) {
        const { error } = await mithraa
          .from("group_messages")
          .update({ body: text, edited_at: new Date().toISOString() })
          .eq("id", editing.id);
        if (error) throw error;
        return;
      }
      const { error } = await mithraa.from("group_messages").insert({
        sender_id: chatUserId,
        body: text,
        reply_to: replyTo?.id ?? null,
        channel: activeChannel,
      });
      if (error) throw error;

      // الإشعارات المحلية للموظفين في قاعدة الرشودي فقط
      const mentions = text.match(/@([\p{L}\d_]+)/gu) ?? [];
      const { data: local } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("is_active", true)
        .eq("org", "rashoudi");
      if (mentions.length) {
        const targets = (local ?? []).filter(
          (s) => s.id !== userId && mentions.some((m) => s.full_name.includes(m.slice(1))),
        );
        if (targets.length) {
          await supabase.from("notifications").insert(
            targets.map((t) => ({
              user_id: t.id,
              title: "تمت الإشارة إليك في شات الموظفين",
              body: text.slice(0, 100),
              link: "/team-chat",
            })),
          );
        }
      }
      const others = (local ?? []).map((s) => s.id).filter((id) => id !== userId);
      if (others.length) {
        void sendPushToUsers({
          data: {
            userIds: others,
            title: "رسالة جديدة في شات الموظفين",
            body: text.slice(0, 120),
            url: "/team-chat",
            tag: `rashoudi-team-chat-${activeChannel}`,
          },
        }).catch(() => undefined);
      }
    },
    onSuccess: () => {
      setBody("");
      setReplyTo(null);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["group-messages", activeChannel, chatUserId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: { is_pinned?: boolean; deleted_at?: string | null } }) => {
      const { error } = await mithraa.from("group_messages").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["group-messages", activeChannel, chatUserId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const sendFile = async (file: File) => {
    if (!chatUserId) {
      toast.error("سجّل الدخول إلى الشات المشترك أولًا");
      return;
    }
    setUploading(true);
    try {
      const path = `team-chat/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      await uploadMedia("internal-files", path, file);
      const { error } = await mithraa.from("group_messages").insert({
        sender_id: chatUserId,
        body: body.trim() || null,
        attachment_path: path,
        attachment_name: file.name,
        reply_to: replyTo?.id ?? null,
        channel: activeChannel,
      });
      if (error) throw error;
      setBody("");
      setReplyTo(null);
      qc.invalidateQueries({ queryKey: ["group-messages", activeChannel, chatUserId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const openAttachment = async (path: string) => {
    try {
      window.open(await mediaUrl("internal-files", path), "_blank", "noopener");
    } catch {
      toast.error("تعذّر فتح المرفق");
    }
  };

  return (
    <>
      <PageHero
        title="شات الموظفين"
        subtitle="محادثة جماعية داخلية لكل الموظفين — غير متاحة للعملاء."
        icon={MessagesSquare}
        stats={[{ value: String(all.length), label: "رسالة" }]}
      />

      {ready && autoDone && !chatUserId ? <MithraaSignIn fullName={profile?.full_name} /> : null}

      <div className="surface-card flex h-[calc(100dvh-15rem)] min-h-[560px] flex-col overflow-hidden">
        <nav className="flex items-center gap-2 overflow-x-auto border-b border-border px-3 py-2">
          {([
            ["rashoudi", "فريق الرشودي"],
            ["shared", "الشات المشترك"],
          ] as ["rashoudi" | "shared", string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveChannel(value)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-[11.5px] font-bold",
                activeChannel === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
          {chatUserId ? (
            <button
              type="button"
              onClick={() => {
                void clearMithraaLink().catch(() => undefined);
                void signOutMithraa();
              }}
              className="ms-auto shrink-0 rounded-full border border-border px-3 py-1 text-[10.5px] text-muted-foreground"
            >
              فصل حساب الشات
            </button>
          ) : null}
        </nav>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* عمود المحادثة الرئيسي */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <header className="flex items-center gap-3 border-b border-border bg-accent/30 px-4 py-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Users className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-bold text-foreground">{channelLabel}</h2>
                <p className="truncate text-[11.5px] text-muted-foreground">
                  {staff.data?.length ?? 0} أعضاء{pinned.length ? ` • ${pinned.length} رسالة مثبتة` : ""}
                </p>
              </div>
              <button
                type="button"
                title="بحث"
                onClick={() => setSearchOpen((v) => !v)}
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted",
                  searchOpen && "bg-muted text-foreground",
                )}
              >
                <Search className="size-4" />
              </button>
              <button
                type="button"
                title="معلومات الأعضاء"
                onClick={() => setMembersOpenMobile((v) => !v)}
                className="grid size-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted lg:hidden"
              >
                <Info className="size-4" />
              </button>
            </header>

            {searchOpen ? (
              <div className="border-b border-border px-4 py-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    autoFocus
                    className={inputClass}
                    placeholder="بحث داخل المحادثة…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            ) : null}

            {pinned.length ? (
              <div className="flex items-start gap-2 border-b border-border bg-warning/10 px-4 py-2 text-[12.5px]">
                <Pin className="mt-0.5 size-3.5 shrink-0 text-warning" />
                <p className="truncate">
                  <span className="font-bold">{pinned.at(-1)?.sender?.full_name}</span>: {pinned.at(-1)?.body}
                </p>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4">
              {rows.length === 0 ? (
                <p className="grid h-full place-items-center text-sm text-muted-foreground">لا توجد رسائل بعد.</p>
              ) : null}
              {rows.map((m, idx) => {
                const mine = m.sender_id === chatUserId;
                const parent = m.reply_to ? byId.get(m.reply_to) : null;
                const prev = rows[idx - 1];
                const showDaySeparator = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
                return (
                  <div key={m.id} className="space-y-3">
                    {showDaySeparator ? (
                      <div className="flex items-center justify-center">
                        <span className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">{dayLabel(m.created_at)}</span>
                      </div>
                    ) : null}
                    <div className={cn("flex items-start gap-2", mine ? "flex-row" : "flex-row-reverse")}>
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-[12px] font-bold text-primary">
                        {initialsOf(m.sender?.full_name ?? "؟")}
                      </span>
                      <div
                        className={cn(
                          "max-w-[78%] rounded-2xl px-3 py-2 text-[13.5px] shadow-sm",
                          mine ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground",
                        )}
                      >
                        <p className="mb-1 text-[11.5px] font-bold opacity-80">
                          {m.sender?.full_name ?? "—"}
                          {m.sender?.job_title ? ` • ${m.sender.job_title}` : ""}
                        </p>
                        {parent ? (
                          <p className="mb-1 rounded-lg bg-background/25 px-2 py-1 text-[11.5px] opacity-80">
                            ردًا على {parent.sender?.full_name}: {(parent.body ?? "").slice(0, 60)}
                          </p>
                        ) : null}
                        <p className="whitespace-pre-wrap">{m.deleted_at ? "تم حذف الرسالة" : m.body}</p>
                        {!m.deleted_at && m.attachment_path ? (
                          <button
                            type="button"
                            onClick={() => openAttachment(m.attachment_path!)}
                            className="mt-1.5 flex w-full items-center gap-2 rounded-xl bg-background/25 px-2.5 py-2 text-start text-[12px]"
                          >
                            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-background/40">
                              <Paperclip className="size-3.5" />
                            </span>
                            <span className="truncate underline underline-offset-2">{m.attachment_name ?? "مرفق"}</span>
                          </button>
                        ) : null}
                        {m.edited_at ? <span className="text-[10.5px] opacity-70">(معدّلة)</span> : null}
                        <div className="mt-1 flex items-center gap-2 text-[10.5px] opacity-70">
                          <span>{new Date(m.created_at).toLocaleString("ar-SA")}</span>
                          {!m.deleted_at ? (
                            <>
                              <button type="button" onClick={() => setReplyTo(m)} title="رد">
                                <Reply className="size-3.5" />
                              </button>
                              {isSuperAdmin ? (
                                <button
                                  type="button"
                                  title="تثبيت"
                                  onClick={() => patch.mutate({ id: m.id, values: { is_pinned: !m.is_pinned } })}
                                >
                                  <Pin className="size-3.5" />
                                </button>
                              ) : null}
                              {mine ? (
                                <button
                                  type="button"
                                  title="تعديل"
                                  onClick={() => {
                                    setEditing(m);
                                    setBody(m.body ?? "");
                                  }}
                                >
                                  <Pencil className="size-3.5" />
                                </button>
                              ) : null}
                              {mine || isSuperAdmin ? (
                                <button
                                  type="button"
                                  title="حذف"
                                  onClick={() =>
                                    patch.mutate({ id: m.id, values: { deleted_at: new Date().toISOString() } })
                                  }
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottom} />
            </div>

            <footer className="space-y-2 border-t border-border p-3">
              {replyTo ? (
                <p className="flex items-center justify-between rounded-lg bg-accent px-3 py-1.5 text-[12px]">
                  <button type="button" onClick={() => setReplyTo(null)} className="text-muted-foreground">
                    إلغاء
                  </button>
                  <span>رد على {replyTo.sender?.full_name}</span>
                </p>
              ) : null}
              {editing ? (
                <p className="flex items-center justify-between rounded-lg bg-warning/15 px-3 py-1.5 text-[12px]">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      setBody("");
                    }}
                    className="text-muted-foreground"
                  >
                    إلغاء
                  </button>
                  <span>تعديل رسالتك</span>
                </p>
              ) : null}
              {emojiOpen ? (
                <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/30 p-2 text-lg">
                  {EMOJIS.map((e) => (
                    <button key={e} type="button" onClick={() => setBody((b) => b + e)}>
                      {e}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void sendFile(f);
                  }}
                />
                <button
                  type="button"
                  title="إرفاق ملف"
                  onClick={() => fileRef.current?.click()}
                  className="grid size-10 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted"
                >
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
                </button>
                <button
                  type="button"
                  title="رموز"
                  onClick={() => setEmojiOpen((v) => !v)}
                  className="grid size-10 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted"
                >
                  <Smile className="size-4" />
                </button>
                <input
                  className={cn(inputClass, "rounded-full")}
                  placeholder={`اكتب رسالة لفريق ${channelLabel}… استخدم @اسم الموظف للإشارة`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send.mutate();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => send.mutate()}
                  disabled={send.isPending}
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50"
                >
                  {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </button>
              </div>
            </footer>
          </div>

          {/* عمود الأعضاء */}
          <aside
            className={cn(
              "w-full shrink-0 flex-col border-border bg-muted/10 lg:flex lg:w-72 lg:border-s",
              membersOpenMobile ? "flex border-t" : "hidden lg:flex",
            )}
          >
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-bold text-foreground">{channelLabel}</h3>
              <p className="text-[11px] text-muted-foreground">
                {(staff.data ?? []).filter((p) => p.id === chatUserId).length} أعضاء متصلين من أصل {staff.data?.length ?? 0}
              </p>
            </div>
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className={inputClass}
                  placeholder="البحث في الأعضاء…"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {filteredStaff.length === 0 ? (
                <p className="p-4 text-center text-[12.5px] text-muted-foreground">لا يوجد أعضاء مطابقون.</p>
              ) : (
                filteredStaff.map((p) => (
                  <div key={p.id} className="flex items-center gap-2.5 border-b border-border/60 px-3 py-2.5 last:border-b-0">
                    <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-[11.5px] font-bold text-primary">
                      {initialsOf(p.full_name)}
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -end-0.5 size-2.5 rounded-full border-2 border-card",
                          p.id === chatUserId ? "bg-success" : "bg-muted-foreground/40",
                        )}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-bold text-foreground">{p.full_name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{p.job_title ?? "—"}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>

      <DirectChats />
    </>
  );
}

/** بطاقة ربط حساب الشات المشترك (قاعدة مثراء). */
function MithraaSignIn({ fullName }: { fullName?: string | undefined }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await signInToMithraa(email.trim(), password, fullName);
      await saveMithraaLink({ data: { email: email.trim(), password } });
      toast.success("تم ربط حساب الشات المشترك — لن تحتاج الربط مرة أخرى");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="surface-card mb-3 flex flex-col gap-2 p-3 lg:flex-row lg:items-center">
      <div className="min-w-0 lg:w-64 lg:shrink-0">
        <h2 className="text-[12.5px] font-bold">ربط حساب الشات المشترك — مرة واحدة فقط</h2>
        <p className="truncate text-[11px] text-muted-foreground" title="سجّل دخولك ببريدك وكلمة مرورك لدى منصة مثراء مرة واحدة فقط ليعمل تلقائيًا بعدها">
          يُحفظ الربط مشفّرًا ويعمل تلقائيًا بعدها على كل جهاز.
        </p>
      </div>
      <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input className={inputClass} type="email" placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={inputClass} type="password" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} />
        <PrimaryButton onClick={() => void submit()} disabled={busy || !email || !password}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : "ربط"}
        </PrimaryButton>
      </div>
    </div>
  );
}
