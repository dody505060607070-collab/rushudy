import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useAuth";

let sharedCtx: AudioContext | null = null;
let ringtone: HTMLAudioElement | null = null;
let ringtoneUrl: string | null = null;

function getCtx(): AudioContext | null {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedCtx) sharedCtx = new Ctx();
    if (sharedCtx.state === "suspended") void sharedCtx.resume();
    return sharedCtx;
  } catch {
    return null;
  }
}

/** توليد نغمة رنين قوية (WAV) لتشغيلها على الموبايل عبر عنصر <audio>. */
function buildRingtoneUrl(): string {
  if (ringtoneUrl) return ringtoneUrl;
  const rate = 44100;
  const dur = 1.6;
  const n = Math.floor(rate * dur);
  const buf = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  str(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, n * 2, true);

  // أربع نبضات صاعدة قوية (جرس تنبيه واضح)
  const notes = [784, 988, 1175, 1568];
  const noteLen = dur / notes.length;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const idx = Math.min(notes.length - 1, Math.floor(t / noteLen));
    const local = t - idx * noteLen;
    const f = notes[idx]!;
    const env = Math.exp(-local * 6) * (local < 0.005 ? local / 0.005 : 1);
    const sample =
      (Math.sin(2 * Math.PI * f * t) * 0.6 +
        Math.sin(2 * Math.PI * f * 2 * t) * 0.25 +
        Math.sin(2 * Math.PI * f * 3 * t) * 0.15) *
      env *
      0.95;
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
  }
  ringtoneUrl = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  return ringtoneUrl;
}

function getRingtone(): HTMLAudioElement | null {
  try {
    if (!ringtone) {
      ringtone = new Audio(buildRingtoneUrl());
      ringtone.preload = "auto";
      ringtone.volume = 1;
    }
    return ringtone;
  } catch {
    return null;
  }
}

/** فتح الصوت بعد أول تفاعل من المستخدم — ضروري جدًا على الموبايل. */
function unlockAudio() {
  const ctx = getCtx();
  if (ctx) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.00001, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.01);
    } catch {
      /* تجاهل */
    }
  }
  const el = getRingtone();
  if (el) {
    const prev = el.volume;
    el.volume = 0;
    el
      .play()
      .then(() => {
        el.pause();
        el.currentTime = 0;
        el.volume = prev;
      })
      .catch(() => {
        el.volume = prev;
      });
  }
}

/** نغمة تنبيه قوية تعمل على الموبايل والكمبيوتر. */
function playChime() {
  const el = getRingtone();
  if (el) {
    try {
      el.currentTime = 0;
      el.volume = 1;
      void el.play().catch(() => playChimeWebAudio());
    } catch {
      playChimeWebAudio();
    }
  } else {
    playChimeWebAudio();
  }
  if ("vibrate" in navigator) navigator.vibrate?.([200, 100, 200, 100, 300]);
}

function playChimeWebAudio() {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-18, now);
    comp.ratio.setValueAtTime(12, now);
    comp.connect(ctx.destination);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1, now);
    gain.connect(comp);

    [784, 988, 1175, 1568].forEach((freq, i) => {
      const t = now + i * 0.18;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t);
      const oGain = ctx.createGain();
      oGain.gain.setValueAtTime(0.9, t);
      oGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(oGain);
      oGain.connect(gain);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  } catch {
    /* تجاهل */
  }
}

/** إشعار نظام يظهر حتى لو التبويب في الخلفية. */
function systemNotify(title: string, body: string) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const n = new Notification(title, {
      body,
      icon: "/favicon.png",
      badge: "/favicon.png",
      tag: "mithra-chat",
      silent: false,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    if ("vibrate" in navigator) navigator.vibrate?.([120, 60, 120]);
  } catch {
    /* تجاهل */
  }
}

async function senderName(id: string | null | undefined) {
  if (!id) return "زميل";
  const { data } = await supabase.from("profiles").select("full_name").eq("id", id).maybeSingle();
  return data?.full_name ?? "زميل";
}

/** إشعار وصوت لأي رسالة جديدة في شات الموظفين أو محادثات الأنشطة. */
export function useChatAlerts() {
  const { userId, isSuperAdmin } = useCurrentUser();
  const qc = useQueryClient();
  const meRef = useRef<string | undefined>(undefined);
  meRef.current = userId;

  // إذن إشعارات المتصفح + فتح الصوت بعد أول تفاعل (الموبايل يشترط تفاعل المستخدم)
  useEffect(() => {
    const onInteract = () => {
      unlockAudio();
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        void Notification.requestPermission();
      }
    };
    // نكرّر المحاولة مع كل تفاعل حتى يفتح المتصفح الصوت فعليًا
    window.addEventListener("touchstart", onInteract);
    window.addEventListener("pointerdown", onInteract);
    window.addEventListener("keydown", onInteract);
    return () => {
      window.removeEventListener("touchstart", onInteract);
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("keydown", onInteract);
    };
  }, []);

  useEffect(() => {
    let myOrg = "rashoudi";
    void supabase.from("profiles").select("org").eq("id", meRef.current ?? "").maybeSingle().then(({ data }) => {
      if (data?.org) myOrg = data.org;
    });
    const notify = async (senderId: string | null, body: string | null, source: string, messageChannel?: string) => {
      if (!senderId || senderId === meRef.current) return;
      if (messageChannel && !isSuperAdmin && messageChannel !== "shared" && messageChannel !== myOrg) return;
      const name = await senderName(senderId);
      const text = (body ?? "مرفق جديد").slice(0, 120);
      playChime();
      systemNotify(`${name} — ${source}`, text);
      toast.message(`${name} — ${source}`, { description: text });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["nav-counts"] });
    };

    const channel = supabase
      .channel("chat-alerts")

      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages" },
        (payload) => {
          const row = payload.new as { sender_id: string; body: string | null; channel: string };
          void notify(row.sender_id, row.body, "شات الموظفين", row.channel);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_messages" },
        (payload) => {
          const row = payload.new as { sender_id: string; body: string | null };
          void notify(row.sender_id, row.body, "محادثة خاصة");
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload) => {
          const row = payload.new as { sender_id: string; body: string | null };
          void notify(row.sender_id, row.body, "رسالة خاصة");
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc, isSuperAdmin]);
}
