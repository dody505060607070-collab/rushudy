import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHero } from "@/components/kit/PageHero";
import { Button } from "@/components/ui/button";
import { textareaClass } from "@/components/kit/Modal";
import { getRequestCenter, requestKinds, updateOwnerRequest } from "@/lib/request-center.functions";
import { useCurrentUser } from "@/hooks/useAuth";
import { formatDate } from "@/components/kit/LiveTable";

export const Route = createFileRoute("/_authenticated/requests/$kind/$requestId")({ head: () => ({ meta: [{ title: "تفاصيل الطلب | الرشودي للعقارات" }, { name: "description", content: "تفاصيل الطلب الوارد وحالته وملاحظات الإدارة والأصل المرتبط." }, { property: "og:title", content: "تفاصيل الطلب | الرشودي للعقارات" }, { property: "og:description", content: "مراجعة الطلب ومتابعة إجراءات التعامل معه." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }), component: RequestDetails });
function RequestDetails() {
  const { kind, requestId } = Route.useParams();
  const fetchRequest = useServerFn(getRequestCenter); const update = useServerFn(updateOwnerRequest);
  const { isSuperAdmin } = useCurrentUser(); const qc = useQueryClient(); const [note,setNote] = useState<string | null>(null);
  const validKind = requestKinds.find(k => k === kind);
  const query = useQuery({ queryKey: ["request-detail",kind,requestId], queryFn: () => { if (!validKind) throw new Error("نوع الطلب غير معروف"); return fetchRequest({ data: { kind: validKind, id: requestId, page: 0 } }); } });
  const row = query.data?.rows[0];
  const save = useMutation({ mutationFn: (status: "new" | "in_progress" | "done" | "cancelled") => update({ data: { id: requestId, status, note: note ?? row?.note ?? "" } }), onSuccess: () => { toast.success("تم تحديث الطلب"); qc.invalidateQueries({ queryKey: ["request-detail"] }); qc.invalidateQueries({ queryKey: ["request-center"] }); }, onError: (e: Error) => toast.error(e.message) });
  return <div className="space-y-5"><PageHero title={row?.title ?? "تفاصيل الطلب"} subtitle={row?.name ?? ""} icon={ClipboardList} /><Link to="/requests" className="text-primary">جميع الطلبات</Link>{query.isError ? <p role="alert">{query.error.message}</p> : query.isPending ? <p>جارٍ التحميل…</p> : !row ? <p>الطلب غير موجود أو غير متاح لحسابك.</p> : <>
    <dl className="grid gap-4 border-y border-border py-5 sm:grid-cols-2"><div><dt className="text-muted-foreground">مقدم الطلب</dt><dd>{row.name || "—"}</dd></div><div><dt className="text-muted-foreground">الجوال</dt><dd dir="ltr">{row.phone || "—"}</dd></div><div><dt className="text-muted-foreground">التاريخ</dt><dd>{formatDate(row.createdAt)}</dd></div><div><dt className="text-muted-foreground">الحالة</dt><dd>{({ new: "جديد", in_progress: "قيد التنفيذ", done: "مكتمل", cancelled: "ملغي" } as Record<string,string>)[row.status] ?? row.status}</dd></div></dl>
    <p className="whitespace-pre-wrap leading-7">{row.details || row.title}</p>
    <div className="flex flex-wrap gap-3">{row.contractId ? <Link to="/contracts/$contractId" params={{ contractId: row.contractId }} className="text-primary">العقد المرتبط</Link> : null}{row.unitId ? <Link to="/units/$unitId" params={{ unitId: row.unitId }} className="text-primary">الوحدة المرتبطة</Link> : null}{row.kind === "listing" ? <Link to="/listing-requests/$requestId" params={{ requestId }} className="text-primary">إدارة طلب العرض</Link> : row.kind === "supply" ? <Link to="/supply-requests/$requestId" params={{ requestId }} className="text-primary">إدارة طلب التوفير</Link> : row.kind === "maintenance" ? <Link to="/maintenance" className="text-primary">إدارة الصيانة</Link> : row.kind === "service" ? <Link to="/service-partners" className="text-primary">إدارة الخدمات</Link> : null}</div>
    {row.kind === "owner" && isSuperAdmin ? <div className="space-y-3 border-t border-border pt-4"><textarea aria-label="ملاحظات الإدارة" className={textareaClass} value={note ?? row.note} onChange={e => setNote(e.target.value)} placeholder="ملاحظات الإدارة" /><div className="flex flex-wrap gap-2"><Button disabled={save.isPending} onClick={() => save.mutate("in_progress")}>بدء المعالجة</Button><Button disabled={save.isPending} onClick={() => save.mutate("done")}>إكمال الطلب</Button><Button variant="outline" disabled={save.isPending} onClick={() => save.mutate("cancelled")}>إلغاء الطلب</Button></div></div> : null}
  </>}</div>;
}