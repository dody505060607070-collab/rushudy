const RIBBON_LABELS: Record<string, string> = {
  rented: "مؤجرة",
  sold: "مباعة",
  reserved: "محجوز",
};

export function StatusRibbon({ status }: { status?: string | null }) {
  const label = status ? RIBBON_LABELS[status] : undefined;
  if (!label) return null;
  const tone =
    status === "reserved"
      ? "bg-warning/90 text-warning-foreground"
      : "bg-destructive/90 text-destructive-foreground";
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 top-1/2 z-20 -translate-y-1/2 -rotate-6 py-3 text-center text-xl font-black shadow-float ${tone}`}
    >
      {label}
    </div>
  );
}
