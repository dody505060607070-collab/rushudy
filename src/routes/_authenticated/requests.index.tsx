import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ClipboardList, Search } from "lucide-react";
import { useState } from "react";
import { PageHero } from "@/components/kit/PageHero";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/kit/Modal";
import { getRequestCenter, type RequestKind } from "@/lib/request-center.functions";
import { formatDate } from "@/components/kit/LiveTable";

export const Route = createFileRoute("/_authenticated/requests/")({
  head: () => ({ meta: [{ title: "جميع الطلبات | الرشودي للعقارات" }, { name: "description", content: "سجل طلبات الملاك والمستأجرين والصيانة والعقارات والخدمات." }, { property: "og:title", content: "جميع الطلبات | الرشودي للعقارات" }, { property: "og:description", content: "متابعة الطلبات الواردة وحالاتها وتفاصيلها." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: RequestsPage,
});
export const kindLabels: Record<RequestKind, string> = { owner: "طلبات الملاك", maintenance: "الصيانة والمستأجرون", listing: "عرض العقار", supply: "توفير العقار", service: "الخدمات" };
function RequestsPage() {
  const fetchRequests = useServerFn(getRequestCenter);
  const [kind, setKind] = useState<RequestKind | "all">("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const query = useInfiniteQuery({ queryKey: ["request-center", kind], initialPageParam: 0, queryFn: ({ pageParam }) => fetchRequests({ data: { page: pageParam, ...(kind !== "all" ? { kind } : {}) } }), getNextPageParam: (last, pages) => last.hasMore ? pages.length : undefined });
  const rows = (query.data?.pages.flatMap(p => p.rows) ?? []).filter(r => (status === "all" || r.status === status) && [r.title,r.name,r.phone,r.details,r.id].join(" ").includes(search));
  return <div className="space-y-5">
    <PageHero title="جميع الطلبات" subtitle="طلبات الملاك والمستأجرين والعقارات والخدمات" icon={ClipboardList} />
    <div className="flex flex-wrap gap-3">
      <select aria-label="نوع الطلب" className={`${inputClass} w-auto`} value={kind} onChange={e => setKind(e.target.value as RequestKind | "all")}><option value="all">جميع الأنواع</option>{Object.entries(kindLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select>
      <select aria-label="حالة الطلب" className={`${inputClass} w-auto`} value={status} onChange={e => setStatus(e.target.value)}><option value="all">جميع الحالات</option><option value="new">جديد</option><option value="in_progress">قيد التنفيذ</option><option value="done">مكتمل</option><option value="approved">معتمد</option><option value="cancelled">ملغي</option></select>
      <label className="flex min-w-48 flex-1 items-center gap-2"><Search className="size-4 text-muted-foreground" /><input aria-label="بحث في الطلبات" className={inputClass} value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الطلب أو الجوال" /></label>
    </div>
    {query.isError ? <p role="alert">تعذّر تحميل الطلبات: {query.error.message}</p> : query.isPending ? <p>جارٍ تحميل الطلبات…</p> : <div className="space-y-3">{rows.map(r => <Link key={`${r.kind}-${r.id}`} to="/requests/$kind/$requestId" params={{ kind: r.kind, requestId: r.id }} className="surface-card brand-break block p-4 hover:border-primary"><div className="flex flex-wrap justify-between gap-2"><strong>{r.title}</strong><span className="text-xs text-muted-foreground">{kindLabels[r.kind]} · {formatDate(r.createdAt)}</span></div><p className="mt-2 text-sm text-muted-foreground">{r.name} {r.phone} · {r.details}</p><p className="mt-2 text-xs">{r.status === "new" ? "جديد" : r.status === "in_progress" ? "قيد التنفيذ" : r.status === "done" ? "مكتمل" : r.status}</p></Link>)}{!rows.length ? <p>لا توجد طلبات مطابقة.</p> : null}</div>}
    {query.hasNextPage ? <Button variant="outline" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>عرض المزيد من السجل</Button> : null}
  </div>;
}