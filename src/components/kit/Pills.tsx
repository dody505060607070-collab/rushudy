import { useState } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type Pill = { key: string; label: string; count?: number; icon?: LucideIcon };

export function Pills({
  items,
  defaultKey,
  onChange,
  variant = "soft",
}: {
  items: Pill[];
  defaultKey?: string;
  onChange?: (key: string) => void;
  variant?: "soft" | "card";
}) {
  const [active, setActive] = useState(defaultKey ?? items[0]?.key);

  return (
    <div className="flex justify-start">
      <div
        className={cn(
          "inline-flex flex-wrap items-center gap-1 rounded-xl border border-border bg-muted/50 p-1.5",
          variant === "card" && "shadow-card",
        )}
      >
        {items.map((item) => {
          const isActive = item.key === active;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setActive(item.key);
                onChange?.(item.key);
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {Icon ? <Icon className="size-4" /> : null}
              {item.label}
              {typeof item.count === "number" ? (
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[11px] font-bold",
                    isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
