/** نغمات المكالمة (رنين للمتصل، ونغمة مكالمة واردة) — تُولَّد بالمتصفح بدون ملفات صوت. */
type Stop = () => void;

let ctx: AudioContext | null = null;
function audio() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

function beep(freqs: number[], start: number, dur: number, vol: number) {
  const c = ctx!;
  const g = c.createGain();
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.02);
  g.gain.setValueAtTime(vol, start + dur - 0.03);
  g.gain.linearRampToValueAtTime(0, start + dur);
  g.connect(c.destination);
  for (const f of freqs) {
    const o = c.createOscillator();
    o.frequency.value = f;
    o.connect(g);
    o.start(start);
    o.stop(start + dur);
  }
}

function loop(pattern: () => void, every: number): Stop {
  if (!audio()) return () => {};
  pattern();
  const t = window.setInterval(pattern, every);
  return () => window.clearInterval(t);
}

/** صوت «توت… توت» عند المتصل حتى يرد الطرف الآخر. */
export function playRingback(): Stop {
  return loop(() => {
    const now = ctx!.currentTime;
    beep([425], now, 1, 0.12);
  }, 3000);
}

/** نغمة رنين عند المستقبِل للمكالمة الواردة. */
export function playRingtone(): Stop {
  return loop(() => {
    const now = ctx!.currentTime;
    beep([880, 660], now, 0.35, 0.18);
    beep([880, 660], now + 0.5, 0.35, 0.18);
  }, 2000);
}

/** يفتح الصوت أول ما المستخدم يلمس الصفحة (شرط الموبايل). */
export function unlockCallAudio() {
  audio();
}
