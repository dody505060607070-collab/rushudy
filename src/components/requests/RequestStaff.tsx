import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

/** أسماء الموظفين (الملفات النشطة) لعرض اسم الموظف المسؤول عن الطلب. */
export function useStaffList() {
  return useQuery({
    queryKey: ["staff-names"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string | null }[];
    },
  });
}

export function useStaffName() {
  const staff = useStaffList();
  return (id: string | null | undefined) =>
    id ? (staff.data?.find((s) => s.id === id)?.full_name ?? "—") : "غير محدد";
}

/** زر حذف طلب مع تأكيد. */
export function DeleteRequestButton({
  table,
  id,
  queryKey,
}: {
  table: "supply_requests" | "listing_requests";
  id: string;
  queryKey: string[];
}) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from(table).delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("لم يتم الحذف: حسابك ليس لديه صلاحية تعديل الطلبات.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("تم حذف الطلب");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الحذف"),
  });
  return (
    <button
      type="button"
      aria-label="حذف الطلب"
      title="حذف الطلب"
      disabled={remove.isPending}
      onClick={(e) => {
        e.stopPropagation();
        if (window.confirm("هل تريد حذف هذا الطلب نهائيًا؟")) remove.mutate();
      }}
      className="grid size-8 place-items-center rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-50"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
