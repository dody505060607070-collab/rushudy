export function StatusRibbon({ status }: { status?: string | null }) {
  if (status !== "rented" && status !== "sold") return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 -translate-y-1/2 -rotate-6 bg-destructive/90 py-3 text-center text-xl font-black text-destructive-foreground shadow-float">
      {status === "sold" ? "مباعة" : "مؤجرة"}
    </div>
  );
}
