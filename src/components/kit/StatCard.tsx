import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { IconBox } from "@/components/kit/IconBox";
import { cn } from "@/lib/utils";

function useCountUp(target: number, active: boolean, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (typeof window === "undefined") {
      setValue(target);
      return;
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);
  return value;
}

export function StatCard({
  label,
  value,
  icon,
  suffix,
  trend,
  hint,
  className,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  suffix?: string;
  /** نسبة التغير، موجبة = صعود */
  trend?: number;
  hint?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const shown = useCountUp(value, visible);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const decimals = Number.isInteger(value) ? 0 : 2;
  const text = shown.toLocaleString("ar-EG", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <div
      ref={ref}
      dir="rtl"
      className={cn(
        "surface-card brand-break flex items-start justify-between gap-3 p-5 transition-shadow hover:shadow-float",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">
          {text}
          {suffix ? <span className="ms-1 text-sm font-bold text-muted-foreground">{suffix}</span> : null}
        </p>
        {trend !== undefined ? (
          <p
            className={cn(
              "mt-1 inline-flex items-center gap-1 text-[12px] font-bold",
              trend >= 0 ? "text-success" : "text-destructive",
            )}
          >
            {trend >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(trend).toLocaleString("ar-EG", { maximumFractionDigits: 1 })}%
          </p>
        ) : null}
        {hint ? <p className="mt-1 text-[11.5px] text-muted-foreground">{hint}</p> : null}
      </div>
      <IconBox icon={icon} size="lg" />
    </div>
  );
}
