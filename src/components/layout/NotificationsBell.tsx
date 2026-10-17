import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Notif = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export function NotificationsBell() {
  const { userId } = useCurrentUser();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const list = useQuery({
    queryKey: ["my-notifications", userId],
    enabled: Boolean(userId),
    refetchInterval: 90_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, link, is_read, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as Notif[];
    },
  });

  const unread = (list.data ?? []).filter((n) => !n.is_read).length;

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        const notification = payload.new as Notif;
        void qc.invalidateQueries({ queryKey: ["my-notifications", userId] });
        void qc.invalidateQueries({ queryKey: ["notifications-center"] });
        toast(notification.title, { description: notification.body ?? undefined });
        try {
          const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (AudioContextCtor) {
            const context = new AudioContextCtor(); const oscillator = context.createOscillator(); const gain = context.createGain();
            oscillator.frequency.setValueAtTime(880, context.currentTime); oscillator.frequency.exponentialRampToValueAtTime(1320, context.currentTime + 0.18);
            gain.gain.setValueAtTime(0.22, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.45);
            oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.45);
          }
        } catch { /* قد يمنع المتصفح الصوت قبل أول تفاعل */ }
        if ("Notification" in window && Notification.permission === "granted") new Notification(notification.title, { body: notification.body ?? "لديك إشعار جديد" });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [qc, userId]);

  const markRead = useMutation({
    mutationFn: async (id?: string) => {
      const q = supabase.from("notifications").update({ is_read: true }).eq("user_id", userId!);
      const { error } = id ? await q.eq("id", id) : await q.eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-notifications", userId] }),
  });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative grid size-9 place-items-center rounded-full text-primary-foreground/80 transition-colors hover:bg-primary-foreground/15 hover:text-primary-foreground"
        aria-label="الإشعارات"
      >
        <Bell className="size-[18px]" />
        {unread > 0 ? (
          <span className="absolute -end-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="إغلاق"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute start-0 z-40 mt-2 w-[320px] overflow-hidden rounded-xl border border-border bg-card shadow-xl">
            <header className="flex items-center justify-between border-b border-border bg-accent/40 px-3 py-2">
              <button
                type="button"
                onClick={() => markRead.mutate(undefined)}
                className="flex items-center gap-1 text-[12px] text-primary"
              >
                <CheckCheck className="size-3.5" /> تعليم الكل كمقروء
              </button>
              <span className="text-[13px] font-bold">الإشعارات</span>
            </header>
            <div className="max-h-[360px] overflow-y-auto">
              {(list.data ?? []).length === 0 ? (
                <p className="p-6 text-center text-[13px] text-muted-foreground">لا توجد إشعارات.</p>
              ) : (
                (list.data ?? []).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      markRead.mutate(n.id);
                      setOpen(false);
                      if (n.link) navigate({ to: n.link });
                    }}
                    className={cn(
                      "block w-full border-b border-border px-3 py-2 text-end transition-colors hover:bg-accent/50",
                      !n.is_read && "bg-primary/5",
                    )}
                  >
                    <p className="text-[13px] font-semibold text-foreground">{n.title}</p>
                    {n.body ? <p className="text-[12px] text-muted-foreground">{n.body}</p> : null}
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(n.created_at).toLocaleString("ar-SA")}
                    </p>
                  </button>
                ))
              )}
            </div>
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="block bg-accent/40 py-2 text-center text-[12.5px] text-primary"
            >
              عرض كل الإشعارات
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
