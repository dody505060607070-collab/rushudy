import { useQuery } from "@tanstack/react-query";
import { Mic, MicOff, Phone, PhoneIncoming, PhoneOff, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getCallIceServers } from "@/lib/calls.functions";
import { cn } from "@/lib/utils";

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

  const peers = useRef(new Map<string, Peer>());
  const local = useRef<MediaStream | null>(null);
  const room = useRef<RealtimeChannel | null>(null);
  const ring = useRef<RealtimeChannel | null>(null);
  const ice = useRef<RTCIceServer[]>([]);
  const audioBox = useRef<HTMLDivElement>(null);
  const roomRef = useRef<string | null>(null);
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
        const p = payload as { room: string; name: string };
        if (p.room === roomRef.current) toast.message(`${p.name} رفض المكالمة`);
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
        audioBox.current?.appendChild(el);
      }
      el.srcObject = e.streams[0] ?? null;
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") closePeer(id);
    };
    peers.current.set(id, { pc, name });
    syncMembers();
    return pc;
  };

  const leave = useCallback(() => {
    for (const id of [...peers.current.keys()]) closePeer(id);
    local.current?.getTracks().forEach((t) => t.stop());
    local.current = null;
    if (room.current) void supabase.removeChannel(room.current);
    room.current = null;
    setRoomId(null);
    setMuted(false);
    setMembers([]);
  }, [closePeer]);

  useEffect(() => () => leave(), [leave]);

  const invite = (rid: string, to: string[]) =>
    ring.current?.send({ type: "broadcast", event: "invite", payload: { room: rid, from: userId, fromName: myName, to } });

  const join = async (rid: string) => {
    if (!userId || roomRef.current) return false;
    setJoining(true);
    try {
      const [{ iceServers }, stream] = await Promise.all([
        getCallIceServers(),
        navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }),
      ]);
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
      toast.error(
        (e as Error).name === "NotAllowedError" ? "اسمح للمتصفح باستخدام الميكروفون" : `تعذّر بدء المكالمة: ${(e as Error).message}`,
      );
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
    if (await join(rid)) void invite(rid, targets);
  };

  const accept = async () => {
    const inv = incoming;
    setIncoming(null);
    if (inv) await join(inv.room);
  };

  const decline = () => {
    if (incoming) void ring.current?.send({ type: "broadcast", event: "decline", payload: { room: incoming.room, name: myName } });
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
      <div ref={audioBox} className="hidden" />
      {roomId ? (
        <>
          <span className="rounded-full bg-primary-foreground/15 px-2.5 py-1 text-[11px] text-primary-foreground" title={members.map((m) => m.name).join("، ")}>
            {members.length ? members.map((m) => m.name).join("، ") : "جارٍ الاتصال…"}
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
        </>
      ) : (
        <button type="button" title="اتصال بموظف" disabled={joining} onClick={() => setPickerOpen(true)} className={btn} aria-label="اتصال">
          <Phone className="size-[18px]" />
        </button>
      )}

      {pickerOpen ? (
        <div className="absolute end-0 top-11 z-50 w-72 rounded-2xl border border-border bg-popover p-3 text-popover-foreground shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-bold">{roomId ? "إضافة للمكالمة" : "اختر من تتصل به"}</p>
            <button type="button" onClick={() => setPickerOpen(false)} className="text-muted-foreground" aria-label="إغلاق">
              <X className="size-4" />
            </button>
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {(staff.data ?? [])
              .filter((p) => !members.some((m) => m.id === p.id))
              .map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={picked.includes(p.id)}
                    onChange={(e) => setPicked((cur) => (e.target.checked ? [...cur, p.id] : cur.filter((x) => x !== p.id)))}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold">{p.full_name}</span>
                    {p.job_title ? <span className="block truncate text-[10.5px] text-muted-foreground">{p.job_title}</span> : null}
                  </span>
                </label>
              ))}
            {staff.isLoading ? <p className="p-2 text-[12px] text-muted-foreground">جارٍ التحميل…</p> : null}
          </div>
          <button
            type="button"
            disabled={!picked.length || joining}
            onClick={() => void startOrAdd()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2 text-[13px] font-bold text-primary-foreground disabled:opacity-50"
          >
            <Phone className="size-4" /> {roomId ? "إضافة" : "اتصال"} {picked.length ? `(${picked.length})` : ""}
          </button>
        </div>
      ) : null}

      {incoming ? (
        <div className="fixed inset-x-0 top-4 z-[100] mx-auto flex w-[min(92vw,22rem)] items-center gap-3 rounded-2xl border border-border bg-popover p-3 text-popover-foreground shadow-2xl">
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
      ) : null}
    </div>
  );
}
