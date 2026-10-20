import { Mic, MicOff, Phone, PhoneOff, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getCallIceServers } from "@/lib/calls.functions";
import { cn } from "@/lib/utils";

type RealtimeChannel = ReturnType<typeof supabase.channel>;
type Peer = { pc: RTCPeerConnection; name: string; stream?: MediaStream };
type Signal = { from: string; to: string; kind: "offer" | "answer" | "ice"; payload: unknown };

/** مكالمة صوتية جماعية بين الموظفين داخل النظام. */
export function StaffCall() {
  const { userId, profile } = useCurrentUser();
  const myName = profile?.full_name ?? "موظف";
  const [inCall, setInCall] = useState(false);
  const [joining, setJoining] = useState(false);
  const [muted, setMuted] = useState(false);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [ringFrom, setRingFrom] = useState<string | null>(null);
  const [roomCount, setRoomCount] = useState(0);

  const peers = useRef(new Map<string, Peer>());
  const local = useRef<MediaStream | null>(null);
  const room = useRef<RealtimeChannel | null>(null);
  const ice = useRef<RTCIceServer[]>([]);
  const audioBox = useRef<HTMLDivElement>(null);

  // قناة الرنين: تُعلِم الموجودين في الصفحة أن مكالمة بدأت
  const ringChan = useRef<RealtimeChannel | null>(null);
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel("staff-call-ring", { config: { broadcast: { self: false }, presence: { key: userId } } })
      .on("broadcast", { event: "ring" }, ({ payload }) => {
        const p = payload as { name: string };
        setRingFrom(p.name);
      })
      .on("broadcast", { event: "room" }, ({ payload }) => {
        setRoomCount((payload as { count: number }).count);
      })
      .subscribe();
    ringChan.current = ch;
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
    setInCall(false);
    setMuted(false);
    setMembers([]);
  }, [closePeer]);

  useEffect(() => () => leave(), [leave]);

  const join = async () => {
    if (!userId || inCall) return;
    setJoining(true);
    setRingFrom(null);
    try {
      const [{ iceServers }, stream] = await Promise.all([
        getCallIceServers(),
        navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }),
      ]);
      ice.current = iceServers as RTCIceServer[];
      local.current = stream;

      const ch = supabase.channel("staff-call-room", {
        config: { broadcast: { self: false }, presence: { key: userId } },
      });
      room.current = ch;

      ch.on("presence", { event: "sync" }, () => {
        const state = ch.presenceState<{ name: string }>();
        const ids = Object.keys(state);
        void ringChan.current?.send({ type: "broadcast", event: "room", payload: { count: ids.length } });
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
      setInCall(true);
      void ringChan.current?.send({ type: "broadcast", event: "ring", payload: { name: myName } });
    } catch (e) {
      leave();
      toast.error(
        (e as Error).name === "NotAllowedError" ? "اسمح للمتصفح باستخدام الميكروفون" : `تعذّر بدء المكالمة: ${(e as Error).message}`,
      );
    } finally {
      setJoining(false);
    }
  };

  const toggleMute = () => {
    const next = !muted;
    local.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  };

  return (
    <div className="flex items-center gap-2">
      <div ref={audioBox} className="hidden" />
      {ringFrom && !inCall ? (
        <span className="hidden animate-pulse rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary sm:inline">
          {ringFrom} بدأ مكالمة
        </span>
      ) : null}
      {inCall ? (
        <>
          <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground" title={members.map((m) => m.name).join("، ")}>
            <Users className="size-3.5" /> {members.length + 1}
          </span>
          <button
            type="button"
            title={muted ? "إلغاء الكتم" : "كتم الصوت"}
            onClick={toggleMute}
            className={cn(
              "grid size-9 place-items-center rounded-full border border-border",
              muted ? "bg-destructive/10 text-destructive" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          </button>
          <button
            type="button"
            title="إنهاء المكالمة"
            onClick={leave}
            className="grid size-9 place-items-center rounded-full bg-destructive text-destructive-foreground"
          >
            <PhoneOff className="size-4" />
          </button>
        </>
      ) : (
        <button
          type="button"
          title={roomCount > 0 || ringFrom ? "انضم للمكالمة" : "بدء مكالمة جماعية"}
          disabled={joining}
          onClick={() => void join()}
          className={cn(
            "grid size-9 place-items-center rounded-full border border-border text-primary hover:bg-primary/10",
            ringFrom && "animate-pulse bg-primary text-primary-foreground",
          )}
        >
          <Phone className="size-4" />
        </button>
      )}
    </div>
  );
}
