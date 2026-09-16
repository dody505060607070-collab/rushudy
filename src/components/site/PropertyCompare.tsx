import { GitCompareArrows, MapPin, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { coverImage, purposeLabels, type PublicProperty } from "@/lib/site-data";

type Props = {
  properties: PublicProperty[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
};

export function PropertyCompare({ properties, open, onOpenChange, onRemove, onClear }: Props) {
  if (!properties.length) return null;

  return (
    <>
      <div className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-float">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <GitCompareArrows className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-foreground">مقارنة العقارات</p>
            <p className="truncate text-[11.5px] text-muted-foreground">
              اختر عقارين أو 3 عقارات للمقارنة ({properties.length}/3)
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" size="sm" onClick={onClear}>مسح</Button>
          <Button size="sm" onClick={() => onOpenChange(true)} disabled={properties.length < 2}>
            قارن الآن
          </Button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-foreground/55 p-3" role="dialog" aria-modal="true" aria-label="مقارنة العقارات">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-xl border border-border bg-background shadow-float">
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background p-4">
              <div>
                <h2 className="text-[18px] font-bold text-foreground">مقارنة العقارات</h2>
                <p className="text-[12px] text-muted-foreground">راجع السعر والموقع والنوع جنبًا إلى جنب.</p>
              </div>
              <Button variant="ghost" size="icon" aria-label="إغلاق المقارنة" onClick={() => onOpenChange(false)}>
                <X className="size-5" />
              </Button>
            </header>
            <div className="grid min-w-[680px] gap-px bg-border" style={{ gridTemplateColumns: `repeat(${properties.length}, minmax(0, 1fr))` }}>
              {properties.map((property) => {
                const image = coverImage(property);
                const price = property.price_text ?? (property.price_value ? `${property.price_value.toLocaleString("ar-SA")} ريال` : "السعر عند الطلب");
                return (
                  <article key={property.id} className="bg-background p-4">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                      {image ? <img src={image} alt={property.name} className="size-full object-cover" /> : null}
                      <Button variant="secondary" size="icon" className="absolute end-2 top-2" aria-label={`إزالة ${property.name} من المقارنة`} onClick={() => onRemove(property.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <h3 className="mt-4 text-[15px] font-bold text-foreground">{property.name}</h3>
                    <dl className="mt-4 divide-y divide-border text-[12.5px]">
                      <div className="flex justify-between gap-3 py-3"><dt className="text-muted-foreground">السعر</dt><dd className="font-bold text-primary">{price}</dd></div>
                      <div className="flex justify-between gap-3 py-3"><dt className="text-muted-foreground">العرض</dt><dd className="font-semibold">{purposeLabels[property.purpose] ?? property.purpose}</dd></div>
                      <div className="flex justify-between gap-3 py-3"><dt className="text-muted-foreground">النوع</dt><dd className="font-semibold">{property.property_type ?? "—"}</dd></div>
                      <div className="flex justify-between gap-3 py-3"><dt className="flex items-center gap-1 text-muted-foreground"><MapPin className="size-3.5" />الموقع</dt><dd className="font-semibold">{[property.district, property.city].filter(Boolean).join("، ") || "بريدة"}</dd></div>
                    </dl>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}