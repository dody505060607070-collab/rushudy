import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw, RotateCw, X, ZoomIn } from "lucide-react";

type Props = {
  url: string;
  open: boolean;
  onClose: () => void;
  onSave: (file: File) => Promise<void> | void;
};

const RATIOS: { label: string; value: number | null }[] = [
  { label: "الصورة كاملة", value: null },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
  { label: "1:1", value: 1 },
  { label: "3:4", value: 3 / 4 },
];

/** محرّر صور داخل النظام: تكبير، تحريك، تدوير وقص بنِسَب جاهزة. */
export function ImageEditorDialog({ url, open, onClose, onSave }: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [ratio, setRatio] = useState<number | null>(null);
  const [naturalRatio, setNaturalRatio] = useState(4 / 3);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    setLoaded(false);
    setError(null);
  }, [open, url]);

  if (!open) return null;

  // عند اختيار «الصورة كاملة» نستخدم أبعاد الصورة الأصلية بلا أي قص.
  const frameRatio = ratio ?? naturalRatio;
  const fitMode = ratio === null ? "contain" : "cover";

  const onPointerDown = (event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const start = dragRef.current;
    if (!start) return;
    setOffset({ x: start.ox + (event.clientX - start.x), y: start.oy + (event.clientY - start.y) });
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const save = async () => {
    const box = boxRef.current;
    const img = imgRef.current;
    if (!box || !img) return;
    setSaving(true);
    setError(null);
    try {
      const rect = box.getBoundingClientRect();
      const outW = Math.min(1600, Math.round(rect.width * 2));
      const outH = Math.round(outW / frameRatio);
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("تعذّر تجهيز الصورة");
      const scale = outW / rect.width;

      // الصورة معروضة بـ object-contain داخل الإطار قبل التكبير/التحريك
      const baseScale =
        fitMode === "contain"
          ? Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight)
          : Math.max(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
      const drawW = img.naturalWidth * baseScale * zoom * scale;
      const drawH = img.naturalHeight * baseScale * zoom * scale;

      ctx.save();
      ctx.translate(outW / 2 + offset.x * scale, outH / 2 + offset.y * scale);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((value) => resolve(value), "image/jpeg", 0.92),
      );
      if (!blob) throw new Error("تعذّر حفظ الصورة");
      await onSave(new File([blob], `crop-${Date.now()}.jpg`, { type: "image/jpeg" }));
      onClose();
    } catch (err) {
      setError(
        err instanceof Error && err.name === "SecurityError"
          ? "لا يمكن تعديل صورة من رابط خارجي. ارفع الصورة إلى النظام أولًا."
          : err instanceof Error
            ? err.message
            : "تعذّر حفظ الصورة",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/85 p-4" dir="rtl">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[14px] font-bold">تعديل الصورة</h2>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="text-muted-foreground">
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div
            ref={boxRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{ aspectRatio: String(frameRatio) }}
            className="relative w-full cursor-grab touch-none overflow-hidden rounded-xl border border-border bg-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={url}
              crossOrigin="anonymous"
              alt="معاينة التعديل"
              draggable={false}
              onLoad={(event) => {
                const el = event.currentTarget;
                if (el.naturalWidth && el.naturalHeight) {
                  setNaturalRatio(el.naturalWidth / el.naturalHeight);
                }
                setLoaded(true);
              }}
              onError={() => setError("تعذّر تحميل الصورة للتعديل")}
              className="absolute left-1/2 top-1/2 max-w-none select-none"
              style={{
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) rotate(${rotation}deg) scale(${zoom})`,
                width: "100%",
                height: "100%",
                objectFit: fitMode,
              }}
            />
            {!loaded ? (
              <div className="absolute inset-0 grid place-items-center">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {RATIOS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setRatio(item.value)}
                className={`rounded-lg border px-3 py-1 text-[12px] font-semibold ${
                  ratio === item.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <ZoomIn className="size-4" />
            تكبير
            <input
              type="range"
              min="1"
              max="4"
              step="0.01"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="min-w-0 flex-1 accent-primary"
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRotation((value) => value - 90)}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-[12px] font-semibold"
            >
              <RotateCcw className="size-4" /> يسار
            </button>
            <button
              type="button"
              onClick={() => setRotation((value) => value + 90)}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-[12px] font-semibold"
            >
              <RotateCw className="size-4" /> يمين
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setRotation(0);
                setOffset({ x: 0, y: 0 });
              }}
              className="text-[12px] font-semibold text-muted-foreground"
            >
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
            disabled={saving || !loaded}
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
