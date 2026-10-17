import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, LockOpen, MessageCircle, Send, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PrimaryButton, inputClass } from "@/components/kit/Modal";
import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { sendPushToUsers } from "@/lib/push.functions";
import { cn } from "@/lib/utils";

type Thread = {
  id: string;
  employee_id: string;
  status: string;
  created_at: string;
  employee: { full_name: string; job_title: string | null } | null;
};

type DM = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string | null;
  deleted_at: string | null;
  created_at: string;
  sender: { full_name: string } | null;
};

const THREAD_SELECT = "id, employee_id, status, created_at, employee:employee_id(full_name, job_title)";
const DM_SELECT = "id, thread_id, sender_id, body, deleted_at, created_at, sender:sender_id(full_name)";

export function DirectChats() {
  const qc = useQueryClient();
  const { userId, isSuperAdmin } = useCurrentUser();
  const [selected, setSelected] = useState<string | null>(null);
  const [body, setBody] = useState("");

  const threads = useQuery({
    queryKey: ["direct-threads"],
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direct_threads")
        .select(THREAD_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Thread[];
    },
  });

  const staff = useQuery({
    queryKey: ["profiles", "direct-chat"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, job_title")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const list = threads.data ?? [];
  const activeThread = useMemo(
    () => list.find((t) => t.id === (selected ?? (isSuperAdmin ? null : list[0]?.id))) ?? (isSuperAdmin ? null : list[0] ?? null),
    [list, selected, isSuperAdmin],
  );

  const messages = useQuery({
    queryKey: ["direct-messages", activeThread?.id],
    enabled: Boolean(activeThread?.id),
    refetchInterval: 12_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direct_messages")
        .select(DM_SELECT)
        .eq("thread_id", activeThread!.id)
        .order("created_at")
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as DM[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("direct-messages-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["direct-messages"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_threads" }, () => {
        qc.invalidateQueries({ queryKey: ["direct-threads"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const openThread = useMutation({
    mutationFn: async (employeeId: string) => {
      const existing = list.find((t) => t.employee_id === employeeId);
      if (existing) {
        if (existing.status !== "open") {
          const { error } = await supabase
            .from("direct_threads")
            .update({ status: "open", closed_at: null })
            .eq("id", existing.id);
          if (error) throw error;
        }
        return existing.id;
      }
      const { data, error } = await supabase
        .from("direct_threads")
        .insert({ employee_id: employeeId, created_by: userId ?? null })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      setSelected(id);
      qc.invalidateQueries({ queryKey: ["direct-threads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async (t: Thread) => {
      const next = t.status === "open" ? "closed" : "open";
      const { error } = await supabase
        .from("direct_threads")
        .update({ status: next, closed_at: next === "closed" ? new Date().toISOString() : null })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["direct-threads"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: async () => {
      const text = body.trim();
      if (!text || !activeThread) return;
      const { error } = await supabase
        .from("direct_messages")
        .insert({ thread_id: activeThread.id, sender_id: userId!, body: text });
      if (error) throw error;
      const target = isSuperAdmin ? activeThread.employee_id : null;
      if (target) {
        await supabase.from("notifications").insert({
          user_id: target,
          title: "رسالة خاصة من المدير العام",
          body: text.slice(0, 100),
          link: "/team-chat",
        });
        void sendPushToUsers({
          data: {
            userIds: [target],
            title: "رسالة خاصة من المدير العام",
            body: text.slice(0, 120),
            url: "/team-chat",
            tag: "mithra-direct-chat",
          },
        }).catch(() => undefined);
      }
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["direct-messages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMsg = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("direct_messages")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["direct-messages"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isSuperAdmin && list.length === 0) return null;

  const locked = activeThread ? activeThread.status !== "open" : true;

  return (
    <div className="surface-card overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-accent/40 px-4 py-3">
        <span className="text-[12px] text-muted-foreground">
          {isSuperAdmin ? "خاص بالمدير العام — محادثة منفصلة مع كل موظف" : "محادثتك الخاصة مع المدير العام"}
        </span>
        <span className="flex items-center gap-2 text-[13.5px] font-bold text-foreground">
          المحادثات الخاصة <MessageCircle className="size-4 text-primary" />
        </span>
      </header>

      <div className={cn("grid gap-0", isSuperAdmin ? "lg:grid-cols-[280px_minmax(0,1fr)]" : "")}>
        {isSuperAdmin ? (
          <div className="max-h-[480px] space-y-1 overflow-y-auto border-b border-border p-2 lg:border-b-0 lg:border-s">
            {(staff.data ?? [])
              .filter((p) => p.id !== userId)
              .map((p) => {
                const t = list.find((x) => x.employee_id === p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => (t ? setSelected(t.id) : openThread.mutate(p.id))}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-start transition-colors",
                      t && selected === t.id ? "border-primary bg-primary/5" : "border-transparent hover:bg-accent/50",
                    )}
                  >
                    <span className="text-[11px] text-muted-foreground">
                      {!t ? "بدء محادثة" : t.status === "open" ? "مفتوحة" : "مغلقة"}
                    </span>
                    <span className="min-w-0 truncate text-[13px] font-semibold text-foreground">{p.full_name}</span>
                  </button>
                );
              })}
          </div>
        ) : null}

        <div className="min-w-0">
          {activeThread ? (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
                {isSuperAdmin ? (
                  <button
                    type="button"
                    onClick={() => toggleStatus.mutate(activeThread)}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12px] text-muted-foreground hover:bg-muted"
                  >
                    {activeThread.status === "open" ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
                    {activeThread.status === "open" ? "إغلاق المحادثة" : "إعادة فتح المحادثة"}
                  </button>
                ) : (
                  <span />
                )}
                <span className="text-[13px] font-bold text-foreground">
                  {activeThread.employee?.full_name ?? "المحادثة الخاصة"}
                </span>
              </div>

              <div className="space-y-3 overflow-y-auto p-4" style={{ maxHeight: 420 }}>
                {(messages.data ?? []).length === 0 ? (
                  <p className="py-8 text-center text-[13px] text-muted-foreground">لا توجد رسائل بعد.</p>
                ) : (
                  (messages.data ?? []).map((m) => {
                    const mine = m.sender_id === userId;
                    return (
                      <div key={m.id} className={cn("flex", mine ? "justify-start" : "justify-end")}>
                        <div
                          className={cn(
                            "max-w-[78%] rounded-2xl px-3 py-2 text-[13.5px]",
                            mine ? "bg-primary text-primary-foreground" : "bg-accent text-foreground",
                          )}
                        >
                          <p className="mb-1 text-[11px] opacity-75">{m.sender?.full_name ?? "—"}</p>
                          <p className="whitespace-pre-wrap">{m.deleted_at ? "تم حذف الرسالة" : m.body}</p>
                          <div className="mt-1 flex items-center gap-2 text-[10.5px] opacity-70">
                            <span>{new Date(m.created_at).toLocaleString("ar-SA")}</span>
                            {isSuperAdmin && !m.deleted_at ? (
                              <button type="button" title="حذف" onClick={() => removeMsg.mutate(m.id)}>
                                <Trash2 className="size-3.5" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <footer className="border-t border-border p-3">
                {locked && !isSuperAdmin ? (
                  <p className="rounded-lg bg-muted/40 px-3 py-2 text-center text-[12.5px] text-muted-foreground">
                    تم إغلاق المحادثة من المدير العام.
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <input
                      className={inputClass}
                      placeholder="اكتب رسالة خاصة…"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send.mutate();
                        }
                      }}
                    />
                    <PrimaryButton onClick={() => send.mutate()} disabled={send.isPending}>
                      <Send className="size-4" />
                    </PrimaryButton>
                  </div>
                )}
              </footer>
            </>
          ) : (
            <div className="grid min-h-40 place-items-center p-6 text-center text-[13px] text-muted-foreground">
              اختر موظفًا لبدء محادثة خاصة معه.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
