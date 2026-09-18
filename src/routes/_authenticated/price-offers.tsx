import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Gavel, MessageCircle, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Chip, type ChipTone } from "@/components/kit/Chip";
import { EmptyState, formatCurrency, formatDate } from "@/components/kit/LiveTable";
import { inputClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { Pills } from "@/components/kit/Pills";
import { supabase } from "@/integrations/supabase/client";
import { whatsappLink } from "@/lib/site-data";

const TITLE = "طلبات عروض الأسعار | الرشودي للعقارات";
const DESC = "استقبال ومراجعة عروض الأسعار المقدمة من العملاء على العقارات المعروضة للبيع أو الإيجار.";

export const Route = createFileRoute("/_authenticated/price-offers")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PriceOffersPage,
});

type Row = {
  id: string;
  customer_name: string;
  customer_phone: string;
  offer_amount: number;
  message: string | null;
  status: string;
  internal_notes: string | null;
  created_at: string;
  property: { name: string; code: string; price_value: number | null; purpose: string } | null;
};

const statusLabels: Record<string, { label: string; tone: ChipTone }> = {
  new: { label: "جديد", tone: "info" },
  reviewing: { label: "قيد الدراسة", tone: "warning" },
  accepted: { label: "مقبول", tone: "success" },
  rejected: { label: "مرفوض", tone: "danger" },
  withdrawn: { label: "مسحوب", tone: "muted" },
};

function PriceOffersPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");

  const { data = [], isLoading } = useQuery({
    queryKey: ["price-offers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_offers")
        .select(
          "id, customer_name, customer_phone, offer_amount, message, status, internal_notes, created_at, property:property_id(name, code, price_value, purpose)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("price_offers").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث حالة العرض");
      qc.invalidateQueries({ queryKey: ["price-offers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("price_offers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف العرض");
      qc.invalidateQueries({ queryKey: ["price-offers"] });
    },
  });

  const counts = data.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  const visible = useMemo(() => (tab === "all" ? data : data.filter((r) => r.status === tab)), [data, tab]);

  const highest = data.reduce((max, row) => Math.max(max, Number(row.offer_amount)), 0);
  const accepted = data.filter((r) => r.status === "accepted").length;

  return (
    <div className="space-y-6" dir="rtl">
      <PageHero
        title="عروض الأسعار من العملاء"
        subtitle="كل عرض سعر يقدمه زائر على عقار معروض يصلك هنا للمراجعة والرد."
        icon={Gavel}
        stats={[
          { value: String(data.length), label: "عرض مستلم" },
          { value: String(counts['new'] ?? 0), label: "بانتظار المراجعة" },
          { value: formatCurrency(highest), label: "أعلى عرض" },
        ]}
      />

      <Pills
        defaultKey="all"
        onChange={setTab}
        items={[
          { key: "all", label: "الكل", count: data.length },
          { key: "new", label: "جديد", count: counts['new'] ?? 0 },
          { key: "reviewing", label: "قيد الدراسة", count: counts['reviewing'] ?? 0 },
          { key: "accepted", label: "مقبول", count: accepted },
          { key: "rejected", label: "مرفوض", count: counts['rejected'] ?? 0 },
        ]}
      />

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">جارٍ التحميل…</div>
      ) : visible.length === 0 ? (
        <EmptyState text="لا توجد عروض أسعار" hint="ستظهر هنا عروض العملاء من صفحات العقارات." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((row) => {
            const asking = row.property?.price_value ?? 0;
            const gap = asking ? ((Number(row.offer_amount) - asking) / asking) * 100 : 0;
            const info = statusLabels[row.status] ?? statusLabels['new']!;
            return (
              <article key={row.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-foreground">{row.customer_name}</h2>
                    <p className="mt-1 text-[12.5px] text-muted-foreground">
                      {row.property?.name ?? "عقار محذوف"} — {row.property?.code ?? "—"} · {formatDate(row.created_at)}
                    </p>
                  </div>
                  <Chip tone={info.tone}>{info.label}</Chip>
                </header>

                <div className="mt-4 grid grid-cols-2 gap-3 text-[12.5px] sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <div className="text-muted-foreground">قيمة العرض</div>
                    <div className="mt-1 font-bold text-foreground">{formatCurrency(row.offer_amount)}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <div className="text-muted-foreground">السعر المعلن</div>
                    <div className="mt-1 font-semibold text-foreground">{asking ? formatCurrency(asking) : "—"}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <div className="text-muted-foreground">الفارق</div>
                    <div className="mt-1 font-semibold text-foreground">{asking ? `${gap.toFixed(1)}%` : "—"}</div>
                  </div>
                </div>

                {row.message ? (
                  <p className="mt-3 rounded-lg border border-border bg-background p-3 text-[12.5px] leading-6 text-muted-foreground">
                    {row.message}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <select
                    value={row.status}
                    onChange={(e) => setStatus.mutate({ id: row.id, status: e.target.value })}
                    className={`${inputClass} h-9 max-w-[170px] text-[12.5px]`}
                    aria-label="حالة العرض"
                  >
                    {Object.entries(statusLabels).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value.label}
                      </option>
                    ))}
                  </select>
                  <a
                    href={whatsappLink(
                      row.customer_phone,
                      `السلام عليكم ${row.customer_name}،\nبخصوص عرضك على ${row.property?.name ?? "العقار"} بقيمة ${Number(row.offer_amount).toLocaleString("ar-EG")} ريال.`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    <MessageCircle className="size-4" /> رد على العميل
                  </a>
                  <button
                    type="button"
                    onClick={() => remove.mutate(row.id)}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-4" /> حذف
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
