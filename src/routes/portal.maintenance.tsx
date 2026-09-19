import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Wrench } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { createTenantMaintenance, getTenantMaintenance } from "@/lib/portal.functions";

export const Route = createFileRoute("/portal/maintenance")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "طلبات الصيانة | بوابة المستأجر" },
      {
        name: "description",
        content: "إرسال بلاغات الصيانة للمكتب ومتابعة حالتها من بوابة المستأجر.",
      },
      { property: "og:title", content: "طلبات الصيانة | بوابة المستأجر" },
      { property: "og:description", content: "بلاغات الصيانة ومتابعتها من بوابة المستأجر." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TenantMaintenancePage,
});

const categories = [
  { value: "plumbing", label: "سباكة" },
  { value: "electrical", label: "كهرباء" },
  { value: "ac", label: "تكييف" },
  { value: "elevator", label: "مصعد" },
  { value: "general", label: "أخرى" },
];

const statusLabels: Record<string, string> = {
  new: "جديد",
  in_progress: "قيد التنفيذ",
  scheduled: "مجدول",
  done: "منجز",
  closed: "مغلق",
  cancelled: "ملغي",
};

const input =
  "h-11 w-full rounded-lg border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/40";

function TenantMaintenancePage() {
  const qc = useQueryClient();
  const [contractId, setContractId] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("normal");
  const [description, setDescription] = useState("");

  const data = useQuery({
    queryKey: ["tenant-maintenance"],
    queryFn: () => getTenantMaintenance(),
  });
  const contracts = data.data?.contracts ?? [];
  const requests = data.data?.requests ?? [];

  const submit = useMutation({
    mutationFn: () =>
      createTenantMaintenance({
        data: {
          contractId: contractId || contracts[0]?.id || "",
          category,
          description,
          priority,
        },
      }),
    onSuccess: () => {
      setDescription("");
      void qc.invalidateQueries({ queryKey: ["tenant-maintenance"] });
      toast.success("تم إرسال البلاغ للمكتب");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر الإرسال"),
  });

  return (
    <div className="space-y-6">
      <header className="rounded-2xl bg-card p-5 shadow-card">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <Wrench className="h-5 w-5 text-primary" /> طلبات الصيانة
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          أرسل بلاغ الصيانة للمكتب وتابع حالته من هنا.
        </p>
      </header>

      <section className="grid gap-3 rounded-2xl bg-card p-5 shadow-card sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-[12.5px] font-semibold">العقد</span>
          <select
            className={input}
            value={contractId || contracts[0]?.id || ""}
            onChange={(e) => setContractId(e.target.value)}
          >
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                عقد رقم {c.contract_number}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-[12.5px] font-semibold">نوع العطل</span>
          <select className={input} value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-[12.5px] font-semibold">الأولوية</span>
          <select className={input} value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="normal">عادية</option>
            <option value="high">عاجلة</option>
          </select>
        </label>
        <label className="space-y-1.5 sm:col-span-2">
          <span className="text-[12.5px] font-semibold">وصف المشكلة</span>
          <textarea
            className="min-h-[110px] w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] outline-none focus:border-primary/40"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="مثال: تسريب ماء في المطبخ"
          />
        </label>
        <div>
          <button
            type="button"
            disabled={submit.isPending || !contracts.length}
            onClick={() => submit.mutate()}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-[13px] font-bold text-primary-foreground disabled:opacity-50"
          >
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            إرسال البلاغ
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-card p-5 shadow-card">
        <h2 className="text-[15px] font-bold">بلاغاتي</h2>
        <div className="mt-3 space-y-2">
          {requests.map((r) => (
            <article key={r.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-semibold">
                  {categories.find((c) => c.value === r.category)?.label ?? r.category}
                </span>
                <span className="rounded-full bg-muted px-3 py-1 text-[11.5px] font-semibold">
                  {statusLabels[r.status] ?? r.status}
                </span>
              </div>
              <p className="mt-1 text-[12.5px] text-muted-foreground">{r.description}</p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                {new Date(r.created_at).toLocaleString("ar-SA")}
              </p>
            </article>
          ))}
          {!requests.length ? (
            <p className="text-[12.5px] text-muted-foreground">لا توجد بلاغات حتى الآن.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
