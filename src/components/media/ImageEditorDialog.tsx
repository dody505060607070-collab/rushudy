import { useEffect, useRef, useState } from "react";
import { FlipHorizontal, Loader2, RotateCcw, RotateCw, X } from "lucide-react";

type Props = {
  url: string;
  open: boolean;
  onClose: () => void;
  onSave: (file: File) => Promise<void> | void;
};

type Rect = { x: number; y: number; w: number; h: number }; // كنِسَب من 0 إلى 1
type Handle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const RATIOS: { label: string; value: number | null }[] = [
  { label: "حر", value: null },
  { label: "شكل كرت الموقع", value: 16 / 10 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
  { label: "1:1", value: 1 },
  { label: "3:4", value: 3 / 4 },
];

const HANDLES: { id: Handle; cls: string; cursor: string }[] = [
  { id: "nw", cls: "-left-2 -top-2", cursor: "nwse-resize" },
  { id: "n", cls: "left-1/2 -top-2 -translate-x-1/2", cursor: "ns-resize" },
  { id: "ne", cls: "-right-2 -top-2", cursor: "nesw-resize" },
  { id: "e", cls: "-right-2 top-1/2 -translate-y-1/2", cursor: "ew-resize" },
  { id: "se", cls: "-right-2 -bottom-2", cursor: "nwse-resize" },
  { id: "s", cls: "left-1/2 -bottom-2 -translate-x-1/2", cursor: "ns-resize" },
  { id: "sw", cls: "-left-2 -bottom-2", cursor: "nesw-resize" },
  { id: "w", cls: "-left-2 top-1/2 -translate-y-1/2", cursor: "ew-resize" },
];

const MIN = 0.05;
const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 };

/** محرّر صور: الصورة تظهر كاملة كما رُفعت، ومربع قص بمقابض على الأطراف لتحديد الجزء الظاهر بالضبط. */
export function ImageEditorDialog({ url, open, onClose, onSave }: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const srcRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ handle: Handle; px: number; py: number; start: Rect } | null>(null);
  const [rotation, setRotation] = useState(0);
  const [flip, setFlip] = useState(false);
  const [work, setWork] = useState<{ url: string; w: number; h: number } | null>(null);
  const [crop, setCrop] = useState<Rect>(FULL);
  const [ratio, setRatio] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // تحميل الصورة الأصلية
  useEffect(() => {
    if (!open) return;
    setRotation(0);
    setFlip(false);
    setCrop(FULL);
    setRatio(null);
    setWork(null);
    setError(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      srcRef.current = img;
      render(img, 0, false);
    };
    img.onerror = () => setError("تعذّر تحميل الصورة للتعديل");
    img.src = url;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, url]);

  function render(img: HTMLImageElement, rot: number, flp: boolean) {
    const turned = Math.abs(rot % 180) === 90;
    const w = turned ? img.naturalHeight : img.naturalWidth;
    const h = turned ? img.naturalWidth : img.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.translate(w / 2, h / 2);
    ctx.rotate((rot * Math.PI) / 180);
    if (flp) ctx.scale(-1, 1);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    try {
      setWork({ url: canvas.toDataURL("image/jpeg", 0.95), w, h });
    } catch {
      setError("لا يمكن تعديل صورة من رابط خارجي. ارفع الصورة إلى النظام أولًا.");
    }
  }

  const transform = (rot: number, flp: boolean) => {
    setRotation(rot);
    setFlip(flp);
    setCrop(FULL);
    setRatio(null);
    if (srcRef.current) render(srcRef.current, rot, flp);
  };

  // نسبة القص بالنسب المئوية مع مراعاة أبعاد الصورة
  const applyRatio = (value: number | null) => {
    setRatio(value);
    if (!value || !work) return;
    const r = value / (work.w / work.h); // w/h في وحدات النسب
    let w = 1;
    let h = w / r;
    if (h > 1) {
      h = 1;
      w = r;
    }
    setCrop({ x: (1 - w) / 2, y: (1 - h) / 2, w, h });
  };

  const onDown = (handle: Handle) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { handle, px: e.clientX, py: e.clientY, start: crop };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const stage = stageRef.current;
    if (!d || !stage || !work) return;
    const rect = stage.getBoundingClientRect();
    const dx = (e.clientX - d.px) / rect.width;
    const dy = (e.clientY - d.py) / rect.height;
    const s = d.start;
    if (d.handle === "move") {
      setCrop({
        ...s,
        x: Math.min(1 - s.w, Math.max(0, s.x + dx)),
        y: Math.min(1 - s.h, Math.max(0, s.y + dy)),
      });
      return;
    }
    let { x, y, w, h } = s;
    const hd = d.handle;
    if (hd.includes("e")) w = Math.min(1 - x, Math.max(MIN, s.w + dx));
    if (hd.includes("s")) h = Math.min(1 - y, Math.max(MIN, s.h + dy));
    if (hd.includes("w")) {
      const nx = Math.min(s.x + s.w - MIN, Math.max(0, s.x + dx));
      w = s.w + (s.x - nx);
      x = nx;
    }
    if (hd.includes("n")) {
      const ny = Math.min(s.y + s.h - MIN, Math.max(0, s.y + dy));
      h = s.h + (s.y - ny);
      y = ny;
    }
    if (ratio) {
      const r = ratio / (work.w / work.h);
      if (hd === "n" || hd === "s") w = h * r;
      else h = w / r;
      if (x + w > 1) { w = 1 - x; h = w / r; }
      if (y + h > 1) { h = 1 - y; w = h * r; }
      if (hd.includes("w")) x = s.x + s.w - w;
      if (hd.includes("n")) y = s.y + s.h - h;
      x = Math.max(0, x);
      y = Math.max(0, y);
    }
    setCrop({ x, y, w, h });
  };

  const onUp = () => {
    dragRef.current = null;
  };

  const save = async () => {
    if (!work) return;
    setSaving(true);
    setError(null);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("تعذّر تجهيز الصورة"));
        img.src = work.url;
      });
      const sx = crop.x * work.w;
      const sy = crop.y * work.h;
      const sw = crop.w * work.w;
      const sh = crop.h * work.h;
      const scale = Math.min(1, 2400 / Math.max(sw, sh));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(sw * scale);
      canvas.height = Math.round(sh * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("تعذّر تجهيز الصورة");
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((value) => resolve(value), "image/jpeg", 0.92),
      );
      if (!blob) throw new Error("تعذّر حفظ الصورة");
      await onSave(new File([blob], `crop-${Date.now()}.jpg`, { type: "image/jpeg" }));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر حفظ الصورة");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const pct = (v: number) => `${v * 100}%`;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/85 p-4" dir="rtl">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[14px] font-bold">تعديل الصورة</h2>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="text-muted-foreground">
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <p className="text-[11.5px] text-muted-foreground">
            الصورة معروضة كاملة كما رفعتها. اسحب المقابض على الأطراف والزوايا لتصغير الإطار على الجزء الذي تريده، واسحب داخل الإطار لتحريكه. ما داخل الإطار هو ما سيظهر في الموقع.
          </p>

          <div className="grid place-items-center rounded-xl bg-muted p-3" dir="ltr">
            {work ? (
              <div
                ref={stageRef}
                className="relative touch-none select-none"
                style={{ aspectRatio: `${work.w} / ${work.h}`, maxHeight: "55vh", maxWidth: "100%", height: "55vh" }}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              >
                <img src={work.url} alt="الصورة الأصلية" draggable={false} className="size-full" />
                {/* تعتيم خارج الإطار */}
                <div
                  className="absolute cursor-move border-2 border-primary"
                  style={{
                    left: pct(crop.x),
                    top: pct(crop.y),
                    width: pct(crop.w),
                    height: pct(crop.h),
                    boxShadow: "0 0 0 9999px hsl(0 0% 0% / 0.55)",
                  }}
                  onPointerDown={onDown("move")}
                >
                  <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="border border-primary-foreground/30" />
                    ))}
                  </div>
                  {HANDLES.map((h) => (
                    <span
                      key={h.id}
                      onPointerDown={onDown(h.id)}
                      style={{ cursor: h.cursor }}
                      className={`absolute size-4 rounded-full border-2 border-primary bg-card ${h.cls}`}
                    />
                  ))}
                </div>
              </div>
            ) : error ? null : (
              <div className="grid h-64 place-items-center">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {RATIOS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => applyRatio(item.value)}
                className={`rounded-lg border px-3 py-1 text-[12px] font-semibold ${
                  ratio === item.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => transform(rotation - 90, flip)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-[12px] font-semibold">
              <RotateCcw className="size-4" /> يسار
            </button>
            <button type="button" onClick={() => transform(rotation + 90, flip)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-[12px] font-semibold">
              <RotateCw className="size-4" /> يمين
            </button>
            <button type="button" onClick={() => transform(rotation, !flip)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-[12px] font-semibold">
              <FlipHorizontal className="size-4" /> قلب
            </button>
            <button type="button" onClick={() => { setCrop(FULL); setRatio(null); }} className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-[12px] font-semibold">
              الصورة كاملة
            </button>
            <button type="button" onClick={() => transform(0, false)} className="text-[12px] font-semibold text-muted-foreground">
              إعادة ضبط
            </button>
          </div>

          {error ? <p className="text-[12px] font-semibold text-destructive">{error}</p> : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button type="button" onClick={onClose} className="h-9 rounded-lg border border-border px-4 text-[12.5px] font-semibold">
            إلغاء
          </button>
          <button
            type="button"
            disabled={saving || !work}
            onClick={save}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-[12.5px] font-bold text-primary-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            حفظ الصورة
          </button>
        </div>
      </div>
    </div>
  );
}
