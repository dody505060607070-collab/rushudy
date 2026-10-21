import { useQuery } from "@tanstack/react-query";
import { Mic, MicOff, Minimize2, Phone, PhoneIncoming, PhoneOff, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getCallIceServers } from "@/lib/calls.functions";
import { sendPushToUsers } from "@/lib/push.functions";
import { cn } from "@/lib/utils";
import { playRingback, playRingtone, unlockCallAudio } from "@/lib/call-tones";

const RING_TIMEOUT = 45_000;

type RealtimeChannel = ReturnType<typeof supabase.channel>;
type Peer = { pc: RTCPeerConnection; name: string };
type Signal = { from: string; to: string; kind: "offer" | "answer" | "ice"; payload: unknown };
type Invite = { room: string; from: string; fromName: string; to: string[] };

/** مكالمات صوتية بين الموظفين: تختار شخصًا أو أكثر، وتقدر تضيف غيرهم أثناء المكالمة. */
export function StaffCall() {
  const { userId, profile } = useCurrentUser();
  const myName = profile?.full_name ?? "موظف";
  const [roomId, setRoomId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [muted, setMuted] = useState(false);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [incoming, setIncoming] = useState<Invite | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [micHelp, setMicHelp] = useState<null | { kind: string; retryRoom: string | null; targets: string[] }>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const peers = useRef(new Map<string, Peer>());
  const local = useRef<MediaStream | null>(null);
  const room = useRef<RealtimeChannel | null>(null);
  const ring = useRef<RealtimeChannel | null>(null);
  const ice = useRef<RTCIceServer[]>([]);
  const audioBox = useRef<HTMLDivElement>(null);
  const roomRef = useRef<string | null>(null);
  const pending = useRef<string[]>([]);
  const leaveRef = useRef<() => void>(() => {});
  roomRef.current = roomId;

  const staff = useQuery({
    queryKey: ["call-staff"],
    enabled: pickerOpen,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, job_title").order("full_name");
      return (data ?? []).filter((p) => p.id !== userId);
    },
  });

  // قناة الدعوات: تصل لكل موظف فاتح النظام
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel("staff-call-invites", { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "invite" }, ({ payload }) => {
        const inv = payload as Invite;
        if (!inv.to.includes(userId) || roomRef.current === inv.room) return;
        if (roomRef.current) {
          toast.message(`${inv.fromName} يتصل بك`, { description: "أنت في مكالمة أخرى الآن" });
          return;
        }
        setIncoming(inv);
      })
      .on("broadcast", { event: "decline" }, ({ payload }) => {
        const p = payload as { room: string; name: string; from?: string };
        if (p.room !== roomRef.current) return;
        toast.message(`${p.name} رفض المكالمة`);
        pending.current = pending.current.filter((id) => id !== p.from);
        // كل اللي اتصلنا بيهم رفضوا ومحدش في المكالمة → ننهيها
        if (pending.current.length === 0 && peers.current.size === 0) leaveRef.current();
      })
      .on("broadcast", { event: "cancel" }, ({ payload }) => {
        const p = payload as { room: string };
        setIncoming((cur) => (cur?.room === p.room ? null : cur));
      })
      .subscribe();
    ring.current = ch;
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [userId]);

  const syncMembers = useCallback(() => {
    setMembers([...peers.current.entries()].map(([id, p]) => ({ id, name: p.name })));
  }, []);

  const closePeer = useCallback(
    (id: string) => {
      const p = peers.current.get(id);
      if (!p) return;
      p.pc.close();
      peers.current.delete(id);
      document.getElementById(`call-audio-${id}`)?.remove();
      syncMembers();
    },
    [syncMembers],
  );

  const send = (sig: Omit<Signal, "from">) =>
    room.current?.send({ type: "broadcast", event: "signal", payload: { ...sig, from: userId } });

  const makePeer = (id: string, name: string) => {
    const existing = peers.current.get(id);
    if (existing) return existing.pc;
    const pc = new RTCPeerConnection({ iceServers: ice.current });
    local.current?.getTracks().forEach((t) => pc.addTrack(t, local.current!));
    pc.onicecandidate = (e) => {
      if (e.candidate) void send({ to: id, kind: "ice", payload: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      let el = document.getElementById(`call-audio-${id}`) as HTMLAudioElement | null;
      if (!el) {
        el = document.createElement("audio");
        el.id = `call-audio-${id}`;
        el.autoplay = true;
        el.setAttribute("playsinline", "true");
        audioBox.current?.appendChild(el);
      }
      el.srcObject = e.streams[0] ?? null;
      void el.play().catch(() => setNeedsTap(true));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") closePeer(id);
    };
    peers.current.set(id, { pc, name });
    syncMembers();
    return pc;
  };

  const leave = useCallback(() => {
    // لو محدش رد لسه: نوقف الرنين عند الطرف الآخر
    if (roomRef.current && peers.current.size === 0) {
      void ring.current?.send({ type: "broadcast", event: "cancel", payload: { room: roomRef.current } });
    }
    pending.current = [];
    for (const id of [...peers.current.keys()]) closePeer(id);
    local.current?.getTracks().forEach((t) => t.stop());
    local.current = null;
    if (room.current) void supabase.removeChannel(room.current);
    room.current = null;
    roomRef.current = null;
    setRoomId(null);
    setMuted(false);
    setMinimized(false);
    setMembers([]);
  }, [closePeer]);
  leaveRef.current = leave;

  useEffect(() => () => leave(), [leave]);

  // المتصل: صوت رنين لحد ما حد يرد، ولو محدش رد خلال 45 ثانية تنتهي المكالمة
  const ringing = !!roomId && members.length === 0;
  useEffect(() => {
    if (!ringing) return;
    const stop = playRingback();
    const t = window.setTimeout(() => {
      toast.message("لم يتم الرد على المكالمة");
      leaveRef.current();
    }, RING_TIMEOUT);
    return () => {
      stop();
      window.clearTimeout(t);
    };
  }, [ringing]);

  // فتح النظام من إشعار المكالمة → نعرض شاشة الرد
  useEffect(() => {
    if (!userId) return;
    const u = new URL(window.location.href);
    const rid = u.searchParams.get("call");
    if (!rid) return;
    const at = Number(u.searchParams.get("at") ?? 0);
    const from = u.searchParams.get("from") ?? "زميل";
    u.searchParams.delete("call"); u.searchParams.delete("from"); u.searchParams.delete("at");
    window.history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
    if (Date.now() - at > RING_TIMEOUT + 15_000) {
      toast.message(`فاتتك مكالمة من ${from}`);
      return;
    }
    if (!roomRef.current) setIncoming({ room: rid, from: "", fromName: from, to: [userId] });
  }, [userId]);

  // المستقبِل: نغمة مكالمة واردة، وتختفي بعد 45 ثانية لو ما ردّش
  useEffect(() => {
    if (!incoming) return;
    const stop = playRingtone();
    const t = window.setTimeout(() => setIncoming(null), RING_TIMEOUT);
    return () => {
      stop();
      window.clearTimeout(t);
    };
  }, [incoming]);

  // الموبايل لا يشغّل أي صوت قبل أول لمسة على الصفحة
  useEffect(() => {
    const on = () => unlockCallAudio();
    window.addEventListener("pointerdown", on, { once: true });
    return () => window.removeEventListener("pointerdown", on);
  }, []);

  const invite = (rid: string, to: string[]) => {
    pending.current = [...new Set([...pending.current, ...to])];
    // إشعار على الموبايل حتى لو النظام مقفول أو الشاشة مطفية
    const q = new URLSearchParams({ call: rid, from: myName, at: String(Date.now()) });
    void sendPushToUsers({
      data: { userIds: to, title: "📞 مكالمة واردة", body: `${myName} يتصل بك — اضغط للرد`, url: `/team-chat?${q}`, tag: `call-${rid}` },
    }).catch(() => undefined);
    return ring.current?.send({ type: "broadcast", event: "invite", payload: { room: rid, from: userId, fromName: myName, to } });
  };

  /** يطلب الميكروفون فورًا عند الضغط (شرط أندرويد وآيفون). */
  const getMic = async () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      const err = new Error("unsupported");
      err.name = "Unsupported";
      throw err;
    }
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      // بعض الأجهزة ترفض الإعدادات الإضافية — نعيد بطلب بسيط
      if ((e as Error).name === "OverconstrainedError" || (e as Error).name === "TypeError") {
        return navigator.mediaDevices.getUserMedia({ audio: true });
      }
      throw e;
    }
  };

  const join = async (rid: string, targets: string[] = []) => {
    if (!userId || roomRef.current) return false;
    setJoining(true);
    try {
      const stream = await getMic();
      const { iceServers } = await getCallIceServers();
      ice.current = iceServers as RTCIceServer[];
      local.current = stream;

      const ch = supabase.channel(`staff-call-${rid}`, {
        config: { broadcast: { self: false }, presence: { key: userId } },
      });
      room.current = ch;

      ch.on("presence", { event: "sync" }, () => {
        const state = ch.presenceState<{ name: string }>();
        const ids = Object.keys(state);
        for (const id of ids) {
          if (id === userId || peers.current.has(id)) continue;
          const name = state[id]?.[0]?.name ?? "زميل";
          // الأصغر رقمًا يبدأ الاتصال لتجنّب التكرار
          if (userId < id) {
            const pc = makePeer(id, name);
            void pc.createOffer().then(async (offer) => {
              await pc.setLocalDescription(offer);
              void send({ to: id, kind: "offer", payload: { sdp: offer, name: myName } });
            });
          }
        }
        for (const id of [...peers.current.keys()]) if (!ids.includes(id)) closePeer(id);
      });

      ch.on("broadcast", { event: "signal" }, async ({ payload }) => {
        const s = payload as Signal;
        if (s.to !== userId) return;
        try {
          if (s.kind === "offer") {
            const p = s.payload as { sdp: RTCSessionDescriptionInit; name: string };
            const pc = makePeer(s.from, p.name);
            await pc.setRemoteDescription(p.sdp);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            void send({ to: s.from, kind: "answer", payload: answer });
          } else if (s.kind === "answer") {
            await peers.current.get(s.from)?.pc.setRemoteDescription(s.payload as RTCSessionDescriptionInit);
          } else {
            await peers.current.get(s.from)?.pc.addIceCandidate(s.payload as RTCIceCandidateInit);
          }
        } catch (e) {
          console.error("call signal error", e);
        }
      });

      await new Promise<void>((resolve, reject) => {
        ch.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await ch.track({ name: myName });
            resolve();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error("تعذّر الاتصال"));
        });
      });
      setRoomId(rid);
      roomRef.current = rid;
      return true;
    } catch (e) {
      leave();
      const n = (e as Error).name;
      const kind =
        n === "NotAllowedError" || n === "SecurityError" ? "denied"
        : n === "NotFoundError" ? "nodevice"
        : n === "NotReadableError" ? "busy"
        : n === "Unsupported" ? "unsupported"
        : "other";
      setMicHelp({ kind, retryRoom: rid, targets });
      return false;
    } finally {
      setJoining(false);
    }
  };

  const startOrAdd = async () => {
    if (!picked.length) return;
    const targets = picked;
    setPickerOpen(false);
    setPicked([]);
    if (roomRef.current) {
      void invite(roomRef.current, targets);
      toast.success("تم إرسال الدعوة");
      return;
    }
    const rid = crypto.randomUUID();
    if (await join(rid, targets)) void invite(rid, targets);
  };

  const accept = async () => {
    const inv = incoming;
    setIncoming(null);
    if (inv) await join(inv.room);
  };

  const decline = () => {
    if (incoming) void ring.current?.send({ type: "broadcast", event: "decline", payload: { room: incoming.room, name: myName, from: userId } });
    setIncoming(null);
  };

  const toggleMute = () => {
    const next = !muted;
    local.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  };

  const btn = "grid size-9 place-items-center rounded-full text-primary-foreground/80 transition-colors hover:bg-primary-foreground/15 hover:text-primary-foreground";

  return (
    <div className="relative flex items-center gap-1">
      <div ref={audioBox} className="pointer-events-none fixed size-px overflow-hidden opacity-0" aria-hidden />
      {roomId ? (
        <>
          {/* كمبيوتر: أزرار المكالمة في الشريط العلوي */}
          <div className="hidden items-center gap-1 sm:flex">
            <span className="max-w-48 truncate rounded-full bg-primary-foreground/15 px-2.5 py-1 text-[11px] text-primary-foreground" title={members.map((m) => m.name).join("، ")}>
              {members.length ? members.map((m) => m.name).join("، ") : "يرن… في انتظار الرد"}
            </span>
            <button type="button" title={muted ? "إلغاء الكتم" : "كتم الصوت"} onClick={toggleMute} className={cn(btn, muted && "bg-destructive/80")}>
              {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </button>
            <button type="button" title="إضافة شخص للمكالمة" onClick={() => setPickerOpen(true)} className={btn}>
              <UserPlus className="size-4" />
            </button>
            <button type="button" title="إنهاء المكالمة" onClick={leave} className="grid size-9 place-items-center rounded-full bg-destructive text-destructive-foreground">
              <PhoneOff className="size-4" />
            </button>
          </div>
          {/* موبايل: علامة صغيرة فوق تفتح شاشة المكالمة */}
          <button type="button" onClick={() => setMinimized(false)} className="grid size-9 place-items-center rounded-full bg-primary-foreground/20 text-primary-foreground ring-2 ring-gold sm:hidden" aria-label="فتح المكالمة">
            <Phone className="size-4 animate-pulse" />
          </button>
          {minimized ? (
            /* موبايل: المكالمة مصغّرة كأيقونة عائمة */
            <button
              type="button"
              onClick={() => setMinimized(false)}
              aria-label="تكبير المكالمة"
              className="fixed bottom-24 start-4 z-[100] flex items-center gap-2 rounded-full bg-primary py-2 pe-4 ps-2 text-primary-foreground shadow-2xl sm:hidden"
            >
              <span className="grid size-10 place-items-center rounded-full bg-primary-foreground/20"><Phone className="size-5 animate-pulse" /></span>
              <span className="max-w-36 truncate text-[13px] font-bold">{members.length ? members.map((m) => m.name).join("، ") : "يرن…"}</span>
            </button>
          ) : (
            /* موبايل: شاشة مكالمة كاملة */
            <div dir="rtl" className="fixed inset-0 z-[100] flex flex-col bg-primary px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] text-primary-foreground sm:hidden">
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setMinimized(true)} className="flex items-center gap-1 rounded-full bg-primary-foreground/15 px-3 py-2 text-[13px] font-bold" aria-label="تصغير">
                  <Minimize2 className="size-4" /> تصغير
                </button>
                <span className="text-[13px] text-primary-foreground/80">{members.length ? "المكالمة شغالة" : "يرن… في انتظار الرد"}</span>
              </div>
              <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                <span className={cn("grid size-28 place-items-center rounded-full bg-primary-foreground/15 text-4xl font-extrabold", !members.length && "animate-pulse")}>
                  {members.length ? (members[0]!.name.trim()[0] ?? "؟") : <Phone className="size-12" />}
                </span>
                <p className="max-w-full break-words text-2xl font-extrabold">{members.length ? members.map((m) => m.name).join("، ") : "جارٍ الاتصال"}</p>
                <p className="text-[15px] text-primary-foreground/80">{members.length ? `${members.length + 1} في المكالمة` : "بنتصل…"}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <button type="button" onClick={toggleMute} className="flex flex-col items-center gap-2 text-[13px] font-bold">
                  <span className={cn("grid size-16 place-items-center rounded-full", muted ? "bg-primary-foreground text-primary" : "bg-primary-foreground/15")}>
                    {muted ? <MicOff className="size-7" /> : <Mic className="size-7" />}
                  </span>
                  {muted ? "إلغاء الكتم" : "كتم"}
                </button>
                <button type="button" onClick={() => setPickerOpen(true)} className="flex flex-col items-center gap-2 text-[13px] font-bold">
                  <span className="grid size-16 place-items-center rounded-full bg-primary-foreground/15"><UserPlus className="size-7" /></span>
                  إضافة شخص
                </button>
                <button type="button" onClick={leave} className="flex flex-col items-center gap-2 text-[13px] font-bold">
                  <span className="grid size-16 place-items-center rounded-full bg-destructive text-destructive-foreground"><PhoneOff className="size-7" /></span>
                  إنهاء
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <button type="button" title="اتصال بموظف" disabled={joining} onClick={() => setPickerOpen(true)} className={btn} aria-label="اتصال">
          <Phone className="size-[18px]" />
        </button>
      )}

      {pickerOpen ? (
        <>
        <button type="button" aria-label="إغلاق" onClick={() => setPickerOpen(false)} className="fixed inset-0 z-[115] bg-foreground/40 sm:hidden" />
        <div dir="rtl" className="fixed inset-x-0 bottom-0 z-[120] flex max-h-[80vh] flex-col rounded-t-3xl border border-border bg-popover p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-popover-foreground shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:end-0 sm:top-11 sm:z-50 sm:w-72 sm:rounded-2xl sm:p-3">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted sm:hidden" />
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[15px] font-bold sm:text-[13px]">{roomId ? "إضافة للمكالمة" : "اختر من تتصل به"}</p>
            <button type="button" onClick={() => setPickerOpen(false)} className="text-muted-foreground" aria-label="إغلاق">
              <X className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto sm:max-h-64 sm:flex-none">
            {(staff.data ?? [])
              .filter((p) => !members.some((m) => m.id === p.id))
              .map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-3 hover:bg-muted sm:gap-2 sm:rounded-lg sm:py-1.5">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 sm:size-4"
                    checked={picked.includes(p.id)}
                    onChange={(e) => setPicked((cur) => (e.target.checked ? [...cur, p.id] : cur.filter((x) => x !== p.id)))}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold sm:text-[12.5px]">{p.full_name}</span>
                    {p.job_title ? <span className="block truncate text-[12px] text-muted-foreground sm:text-[10.5px]">{p.job_title}</span> : null}
                  </span>
                </label>
              ))}
            {staff.isLoading ? <p className="p-2 text-[12px] text-muted-foreground">جارٍ التحميل…</p> : null}
          </div>
          <button
            type="button"
            disabled={!picked.length || joining}
            onClick={() => void startOrAdd()}
            className="mt-3 flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-[15px] sm:mt-2 sm:py-2 sm:text-[13px] font-bold text-primary-foreground disabled:opacity-50"
          >
            <Phone className="size-4" /> {roomId ? "إضافة" : "اتصال"} {picked.length ? `(${picked.length})` : ""}
          </button>
        </div>
        </>
      ) : null}

      {needsTap && roomId ? (
        <button
          type="button"
          onClick={() => {
            audioBox.current?.querySelectorAll("audio").forEach((a) => void a.play().catch(() => undefined));
            setNeedsTap(false);
          }}
          className="fixed inset-x-0 bottom-36 z-[105] sm:bottom-6 mx-auto w-fit rounded-full bg-primary px-5 py-3 text-[13px] font-bold text-primary-foreground shadow-2xl"
        >
          اضغط هنا لتشغيل صوت المكالمة
        </button>
      ) : null}

      {micHelp ? (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-foreground/40 p-4" dir="rtl">
          <div className="w-full max-w-sm rounded-2xl bg-popover p-5 text-popover-foreground shadow-2xl">
            <h3 className="mb-2 flex items-center gap-2 text-[15px] font-extrabold"><MicOff className="size-5 text-destructive" /> {MIC_TEXT[micHelp.kind]?.title ?? MIC_TEXT["other"]!.title}</h3>
            <p className="mb-3 text-[12.5px] text-muted-foreground">{MIC_TEXT[micHelp.kind]?.body ?? MIC_TEXT["other"]!.body}</p>
            {micHelp.kind === "denied" ? (
              <ul className="mb-3 space-y-2 text-[12px]">
                <li className="rounded-lg bg-muted p-2"><b>أندرويد (كروم):</b> اضغط القفل 🔒 جنب عنوان الموقع ← الأذونات ← الميكروفون ← سماح.</li>
                <li className="rounded-lg bg-muted p-2"><b>آيفون (سفاري):</b> اضغط «aA» جنب العنوان ← إعدادات موقع الويب ← الميكروفون ← سماح. أو: الإعدادات ← سفاري ← الميكروفون.</li>
                <li className="rounded-lg bg-muted p-2"><b>لو التطبيق مثبّت على الشاشة:</b> إعدادات الجوال ← التطبيقات ← المتصفح ← الأذونات ← الميكروفون ← سماح.</li>
                <li className="rounded-lg bg-muted p-2"><b>كمبيوتر:</b> اضغط القفل 🔒 جنب العنوان ← الميكروفون ← سماح، ثم حدّث الصفحة.</li>
              </ul>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const h = micHelp;
                  setMicHelp(null);
                  if (!h.retryRoom) return;
                  void join(h.retryRoom, h.targets).then((ok) => {
                    if (ok && h.targets.length) void invite(h.retryRoom!, h.targets);
                  });
                }}
                className="flex-1 rounded-xl bg-primary py-2 text-[13px] font-bold text-primary-foreground"
              >
                حاول مرة أخرى
              </button>
              <button type="button" onClick={() => setMicHelp(null)} className="rounded-xl border border-border px-4 py-2 text-[13px]">
                إغلاق
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {incoming ? (
        <>
          {/* موبايل: شاشة مكالمة كاملة */}
          <div dir="rtl" className="fixed inset-0 z-[130] flex flex-col items-center justify-between bg-primary px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-20 text-primary-foreground sm:hidden">
            <div className="flex flex-col items-center gap-4 text-center">
              <span className="grid size-24 animate-pulse place-items-center rounded-full bg-primary-foreground/15">
                <PhoneIncoming className="size-11" />
              </span>
              <p className="max-w-full truncate text-2xl font-extrabold">{incoming.fromName}</p>
              <p className="text-[15px] text-primary-foreground/80">مكالمة واردة…</p>
            </div>
            <div className="flex w-full max-w-xs items-center justify-between">
              <button type="button" onClick={decline} className="flex flex-col items-center gap-2 text-[14px] font-bold" aria-label="رفض">
                <span className="grid size-16 place-items-center rounded-full bg-destructive text-destructive-foreground"><PhoneOff className="size-7" /></span>
                رفض
              </button>
              <button type="button" onClick={() => void accept()} className="flex flex-col items-center gap-2 text-[14px] font-bold" aria-label="رد">
                <span className="grid size-16 animate-bounce place-items-center rounded-full bg-success text-primary-foreground"><Phone className="size-7" /></span>
                رد
              </button>
            </div>
          </div>
          {/* كمبيوتر: تنبيه صغير فوق */}
          <div className="fixed inset-x-0 top-4 z-[100] mx-auto hidden w-[22rem] items-center gap-3 rounded-2xl border border-border bg-popover p-3 text-popover-foreground shadow-2xl sm:flex">
            <span className="grid size-10 shrink-0 animate-pulse place-items-center rounded-full bg-success text-primary-foreground">
              <PhoneIncoming className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold">{incoming.fromName}</p>
              <p className="text-[11px] text-muted-foreground">مكالمة واردة</p>
            </div>
            <button type="button" onClick={() => void accept()} className="grid size-9 place-items-center rounded-full bg-success text-primary-foreground" aria-label="رد">
              <Phone className="size-4" />
            </button>
            <button type="button" onClick={decline} className="grid size-9 place-items-center rounded-full bg-destructive text-destructive-foreground" aria-label="رفض">
              <PhoneOff className="size-4" />
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

const MIC_TEXT: Record<string, { title: string; body: string }> = {
  denied: { title: "الميكروفون مقفول", body: "المتصفح منع الميكروفون. افتحه بالخطوات دي ثم اضغط «حاول مرة أخرى»:" },
  nodevice: { title: "لا يوجد ميكروفون", body: "لم نجد ميكروفون في الجهاز. وصّل سماعة بها مايك أو جرّب جهازًا آخر." },
  busy: { title: "الميكروفون مشغول", body: "تطبيق آخر يستخدم الميكروفون الآن (مكالمة أو تسجيل). اقفله ثم حاول مرة أخرى." },
  unsupported: { title: "المتصفح لا يدعم المكالمات", body: "افتح النظام من كروم أو سفاري مباشرة (وليس من داخل واتساب أو فيسبوك) ثم حاول مرة أخرى." },
  other: { title: "تعذّر تشغيل الميكروفون", body: "حدث خطأ أثناء تشغيل الميكروفون. اضغط «حاول مرة أخرى»." },
};
