import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  BadgeCheck,
  Banknote,
  BarChart3,
  Copy,
  Crown,
  Download,
  ExternalLink,
  Eye,
  Filter,
  Flame,
  Link2,
  Megaphone,
  Pencil,
  Plus,
  QrCode,
  Search,
  Target,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { Chip } from "@/components/kit/Chip";
import { EmptyState } from "@/components/kit/EmptyState";
import { Field, GhostButton, Modal, PrimaryButton, inputClass, textareaClass } from "@/components/kit/Modal";
import { PageHero } from "@/components/kit/PageHero";
import { StatCard } from "@/components/kit/StatCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { referralUrl } from "@/lib/marketing";

export const Route = createFileRoute("/_authenticated/marketing")({
  head: () => ({
    meta: [
      { title: "مركز التسويق العقاري والمسوقين | الرشودي للعقارات" },
      {
        name: "description",
        content:
          "لوحة تسويق عقاري متكاملة: روابط إحالة، تتبع الزيارات، رحلة العميل، ترتيب المسوقين، وتقارير العمولات.",
      },
      { property: "og:title", content: "مركز التسويق العقاري والمسوقين | الرشودي للعقارات" },
      { property: "og:description", content: "متابعة أداء المسوقين والروابط والتحويلات والعمولات في مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarketingPage,
});

type Marketer = Tables<"marketers">;
type Lead = Tables<"marketer_leads">;
type Commission = Tables<"marketer_commissions">;
type Visit = Tables<"marketer_referral_visits">;
type Share = Tables<"marketer_property_shares">;

const emptyForm = {
  full_name: "",
  phone: "",
  email: "",
  referral_code: "",
  status: "active",
  specialty: "",
  regions: "",
  commission_type: "office_commission_percent",
  commission_value: "",
  attribution_days: "30",
  notes: "",
};

const statusLabel: Record<string, string> = { active: "نشط", paused: "موقوف", archived: "مؤرشف" };
const leadStatusLabel: Record<string, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  qualified: "مؤهل",
  viewing: "معاينة",
  negotiation: "تفاوض",
  won: "صفقة ناجحة",
  lost: "غير مكتمل",
};
const leadStatusTone: Record<string, "neutral" | "info" | "warning" | "success" | "danger"> = {
  new: "neutral",
  contacted: "info",
  qualified: "info",
  viewing: "warning",
  negotiation: "warning",
  won: "success",
  lost: "danger",
};
const commissionStatusLabel: Record<string, string> = {
  expected: "متوقعة",
  due: "مستحقة",
  approved: "معتمدة",
  paid: "مدفوعة",
  cancelled: "ملغاة",
};
const commissionStatusTone: Record<string, "neutral" | "info" | "warning" | "success" | "danger"> = {
  expected: "neutral",
  due: "warning",
  approved: "info",
  paid: "success",
  cancelled: "danger",
};
const commissionTypeLabel: Record<string, string> = {
  fixed: "مبلغ ثابت",
  office_commission_percent: "نسبة من عمولة المكتب",
  deal_percent: "نسبة من قيمة الصفقة",
};

const periods = [
  { value: "7", label: "٧ أيام" },
  { value: "30", label: "٣٠ يومًا" },
  { value: "90", label: "٩٠ يومًا" },
  { value: "365", label: "سنة" },
  { value: "all", label: "كل الفترات" },
] as const;

const tabs = [
  { value: "overview", label: "نظرة عامة", icon: BarChart3 },
  { value: "marketers", label: "المسوقون", icon: Users },
  { value: "leads", label: "العملاء المنسوبون", icon: UserCheck },
  { value: "commissions", label: "العمولات", icon: Banknote },
  { value: "traffic", label: "الزيارات والمصادر", icon: Activity },
  { value: "guide", label: "دليل النظام", icon: Link2 },
] as const;

const money = (value: number) => `${Math.round(value).toLocaleString("ar-EG")} ر.س`;
const shortDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("ar-EG", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

function MarketingPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Marketer | null>(null);
  const [qrMarketer, setQrMarketer] = useState<Marketer | null>(null);
  const [qrData, setQrData] = useState("");
  const [form, setForm] = useState({ ...emptyForm });
  const [tab, setTab] = useState<(typeof tabs)[number]["value"]>("overview");
  const [period, setPeriod] = useState<(typeof periods)[number]["value"]>("30");
  const [search, setSearch] = useState("");
  const [marketerFilter, setMarketerFilter] = useState("all");
  const [leadStatusFilter, setLeadStatusFilter] = useState("all");
  const [commissionStatusFilter, setCommissionStatusFilter] = useState("all");

  const dashboard = useQuery({
    queryKey: ["marketing-dashboard"],
    queryFn: async () => {
      const [marketers, visits, leads, commissions, shares] = await Promise.all([
        supabase.from("marketers").select("*").order("created_at", { ascending: false }),
        supabase
          .from("marketer_referral_visits")
          .select("*")
          .order("visited_at", { ascending: false })
          .limit(3000),
        supabase.from("marketer_leads").select("*").order("attributed_at", { ascending: false }),
        supabase.from("marketer_commissions").select("*").order("created_at", { ascending: false }),
        supabase.from("marketer_property_shares").select("*").order("sent_at", { ascending: false }).limit(1000),
      ]);
      const error = marketers.error ?? visits.error ?? leads.error ?? commissions.error ?? shares.error;
      if (error) throw error;
      return {
        marketers: (marketers.data ?? []) as Marketer[],
        visits: (visits.data ?? []) as Visit[],
        leads: (leads.data ?? []) as Lead[],
        commissions: (commissions.data ?? []) as Commission[],
        shares: (shares.data ?? []) as Share[],
      };
    },
  });

  const raw = dashboard.data ?? { marketers: [], visits: [], leads: [], commissions: [], shares: [] };

  const since = useMemo(() => {
    if (period === "all") return 0;
    return Date.now() - Number(period) * 86_400_000;
  }, [period]);

  const data = useMemo(() => {
    const within = (value?: string | null) => (since === 0 ? true : value ? new Date(value).getTime() >= since : false);
    return {
      marketers: raw.marketers,
      visits: raw.visits.filter((item) => within(item.visited_at)),
      leads: raw.leads.filter((item) => within(item.attributed_at)),
      commissions: raw.commissions.filter((item) => within(item.created_at)),
      shares: raw.shares.filter((item) => within(item.sent_at)),
    };
  }, [raw, since]);

  const metrics = useMemo(() => {
    const won = data.leads.filter((item) => item.status === "won");
    const lost = data.leads.filter((item) => item.status === "lost").length;
    const open = data.leads.filter((item) => !["won", "lost"].includes(item.status)).length;
    const pipelineValue = data.leads
      .filter((item) => !["won", "lost"].includes(item.status))
      .reduce((sum, item) => sum + (item.estimated_value ?? 0), 0);
    const wonValue = won.reduce((sum, item) => sum + (item.estimated_value ?? 0), 0);
    const sum = (statuses: string[]) =>
      data.commissions.filter((item) => statuses.includes(item.status)).reduce((total, item) => total + item.amount, 0);
    return {
      active: data.marketers.filter((item) => item.status === "active").length,
      total: data.marketers.length,
      visits: data.visits.length,
      uniqueVisitors: new Set(data.visits.map((item) => item.visitor_id)).size,
      leads: data.leads.length,
      won: won.length,
      lost,
      open,
      pipelineValue,
      wonValue,
      shares: data.shares.length,
      conversion: data.visits.length ? (data.leads.length / data.visits.length) * 100 : 0,
      closeRate: data.leads.length ? (won.length / data.leads.length) * 100 : 0,
      expected: sum(["expected"]),
      due: sum(["due", "approved"]),
      paid: sum(["paid"]),
      avgCommission: won.length ? sum(["due", "approved", "paid"]) / won.length : 0,
    };
  }, [data]);

  const trend = useMemo(() => {
    const days = period === "all" ? 90 : Math.min(Number(period), 180);
    const buckets = new Map<string, { label: string; visits: number; leads: number; won: number }>();
    const step = days > 45 ? 7 : 1;
    for (let index = days - 1; index >= 0; index -= step) {
      const date = new Date(Date.now() - index * 86_400_000);
      const key = date.toISOString().slice(0, 10);
      buckets.set(key, {
        label: date.toLocaleDateString("ar-EG", { day: "2-digit", month: "2-digit" }),
        visits: 0,
        leads: 0,
        won: 0,
      });
    }
    const keys = [...buckets.keys()];
    const bucketFor = (value?: string | null) => {
      if (!value) return null;
      const key = new Date(value).toISOString().slice(0, 10);
      let chosen: string | null = null;
      for (const candidate of keys) if (candidate <= key) chosen = candidate;
      return chosen;
    };
    for (const visit of data.visits) {
      const key = bucketFor(visit.visited_at);
      if (key) buckets.get(key)!.visits += 1;
    }
    for (const lead of data.leads) {
      const key = bucketFor(lead.attributed_at);
      if (!key) continue;
      buckets.get(key)!.leads += 1;
      if (lead.status === "won") buckets.get(key)!.won += 1;
    }
    return [...buckets.values()];
  }, [data, period]);

  const leaderboard = useMemo(() => {
    return data.marketers
      .map((marketer) => {
        const leads = data.leads.filter((lead) => lead.marketer_id === marketer.id);
        const won = leads.filter((lead) => lead.status === "won");
        const visits = data.visits.filter((visit) => visit.marketer_id === marketer.id).length;
        const commissions = data.commissions.filter((row) => row.marketer_id === marketer.id);
        const earned = commissions
          .filter((row) => row.status !== "cancelled")
          .reduce((sum, row) => sum + row.amount, 0);
        const paid = commissions.filter((row) => row.status === "paid").reduce((sum, row) => sum + row.amount, 0);
        const dealValue = won.reduce((sum, lead) => sum + (lead.estimated_value ?? 0), 0);
        const score =
          won.length * 45 + leads.length * 8 + Math.min(visits, 500) * 0.4 + (dealValue > 0 ? 15 : 0);
        return {
          marketer,
          visits,
          leads: leads.length,
          won: won.length,
          conversion: visits ? (leads.length / visits) * 100 : 0,
          closeRate: leads.length ? (won.length / leads.length) * 100 : 0,
          earned,
          paid,
          dealValue,
          score: Math.round(score),
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [data]);

  const funnel = useMemo(() => {
    const count = (status: string) => data.leads.filter((lead) => lead.status === status).length;
    return [
      { label: "زيارات", value: data.visits.length },
      { label: "عملاء", value: data.leads.length },
      { label: "مؤهل", value: count("qualified") + count("viewing") + count("negotiation") + count("won") },
      { label: "معاينة", value: count("viewing") + count("negotiation") + count("won") },
      { label: "تفاوض", value: count("negotiation") + count("won") },
      { label: "صفقة", value: count("won") },
    ];
  }, [data]);

  const leadMix = useMemo(
    () =>
      Object.keys(leadStatusLabel)
        .map((status) => ({
          name: leadStatusLabel[status],
          value: data.leads.filter((lead) => lead.status === status).length,
        }))
        .filter((item) => item.value > 0),
    [data],
  );

  const topPages = useMemo(() => {
    const map = new Map<string, number>();
    for (const visit of data.visits) {
      const key = visit.landing_path || "/";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label: label.length > 28 ? `${label.slice(0, 28)}…` : label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [data]);

  const topSources = useMemo(() => {
    const map = new Map<string, number>();
    for (const visit of data.visits) {
      const key = visit.referrer_host || "مباشر / بدون مصدر";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [data]);

  const marketerName = (id: string | null) =>
    raw.marketers.find((item) => item.id === id)?.full_name ?? "غير محدد";

  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.leads.filter((lead) => {
      if (marketerFilter !== "all" && lead.marketer_id !== marketerFilter) return false;
      if (leadStatusFilter !== "all" && lead.status !== leadStatusFilter) return false;
      if (!term) return true;
      return [lead.customer_name, lead.customer_phone, lead.notes, marketerName(lead.marketer_id)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [data, search, marketerFilter, leadStatusFilter, raw.marketers]);

  const filteredCommissions = useMemo(() => {
    return data.commissions.filter((row) => {
      if (marketerFilter !== "all" && row.marketer_id !== marketerFilter) return false;
      if (commissionStatusFilter !== "all" && row.status !== commissionStatusFilter) return false;
      return true;
    });
  }, [data, marketerFilter, commissionStatusFilter]);

  const filteredMarketers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data.marketers;
    return data.marketers.filter((item) =>
      [item.full_name, item.phone, item.referral_code, item.specialty, item.regions.join(" ")]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [data, search]);

  useEffect(() => {
    if (!qrMarketer) return;
    let cancelled = false;
    import("qrcode")
      .then(({ toDataURL }) => toDataURL(referralUrl(qrMarketer.referral_code), { width: 360, margin: 2 }))
      .then((url) => {
        if (!cancelled) setQrData(url);
      })
      .catch(() => setQrData(""));
    return () => {
      cancelled = true;
    };
  }, [qrMarketer]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["marketing-dashboard"] });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim() || !form.phone.trim()) throw new Error("اسم المسوق ورقم الجوال مطلوبان");
      const code = (form.referral_code.trim() || form.full_name.trim().replace(/\s+/g, "-"))
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "");
      if (code.length < 3) throw new Error("اكتب كود رابط بالإنجليزية من 3 أحرف على الأقل");
      const payload = {
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        referral_code: code,
        status: form.status,
        specialty: form.specialty.trim() || null,
        regions: form.regions.split("،").map((item) => item.trim()).filter(Boolean),
        commission_type: form.commission_type,
        commission_value: Number(form.commission_value) || 0,
        attribution_days: Number(form.attribution_days) || 30,
        notes: form.notes.trim() || null,
      };
      const result = editing
        ? await supabase.from("marketers").update(payload).eq("id", editing.id)
        : await supabase.from("marketers").insert(payload);
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      toast.success(editing ? "تم تحديث بيانات المسوق" : "تمت إضافة المسوق ورابطه الخاص");
      setOpen(false);
      refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر الحفظ"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const result = await supabase.from("marketers").delete().eq("id", id);
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      toast.success("تم حذف المسوق");
      refresh();
    },
    onError: () => toast.error("لا يمكن حذف مسوق مرتبط بعملاء أو عمولات؛ أوقفه بدلًا من ذلك"),
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const result = await supabase.from("marketer_leads").update({ status }).eq("id", id);
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      toast.success("تم تحديث حالة العميل");
      refresh();
    },
    onError: () => toast.error("تعذّر تحديث حالة العميل"),
  });

  const updateCommission = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const payload: Record<string, unknown> = { status };
      if (status === "paid") payload.paid_at = new Date().toISOString();
      const result = await supabase.from("marketer_commissions").update(payload).eq("id", id);
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      toast.success("تم تحديث حالة العمولة");
      refresh();
    },
    onError: () => toast.error("تعذّر تحديث العمولة"),
  });

  const toggleStatus = useMutation({
    mutationFn: async (item: Marketer) => {
      const next = item.status === "active" ? "paused" : "active";
      const result = await supabase.from("marketers").update({ status: next }).eq("id", item.id);
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      toast.success("تم تحديث حالة المسوق");
      refresh();
    },
    onError: () => toast.error("تعذّر تحديث الحالة"),
  });

  const edit = (item: Marketer) => {
    setEditing(item);
    setForm({
      full_name: item.full_name,
      phone: item.phone,
      email: item.email ?? "",
      referral_code: item.referral_code,
      status: item.status,
      specialty: item.specialty ?? "",
      regions: item.regions.join("، "),
      commission_type: item.commission_type,
      commission_value: String(item.commission_value),
      attribution_days: String(item.attribution_days),
      notes: item.notes ?? "",
    });
    setOpen(true);
  };

  const copy = async (item: Marketer) => {
    await navigator.clipboard.writeText(referralUrl(item.referral_code));
    toast.success("تم نسخ رابط المسوق");
  };

  const exportCsv = () => {
    const rows = [
      ["المسوق", "الجوال", "الكود", "الزيارات", "العملاء", "الصفقات", "نسبة التحويل%", "العمولات", "المدفوع"],
      ...leaderboard.map((row) => [
        row.marketer.full_name,
        row.marketer.phone,
        row.marketer.referral_code,
        row.visits,
        row.leads,
        row.won,
        row.conversion.toFixed(1),
        row.earned,
        row.paid,
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `marketers-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("تم تنزيل تقرير المسوقين");
  };

  const pieColors = ["var(--color-primary)", "var(--color-success)", "var(--color-gold)", "var(--color-destructive)", "var(--color-muted-foreground)", "var(--color-accent)", "var(--color-warning)"];

  return (
    <div className="space-y-6">
      <PageHero
        title="مركز التسويق العقاري"
        subtitle="روابط إحالة قابلة للقياس، رحلة عميل واضحة من الزيارة حتى الصفقة، وعمولات تحت اعتماد الإدارة."
        icon={Megaphone}
        stats={[
          { label: "المسوقون النشطون", value: String(metrics.active) },
          { label: "عملاء منسوبون", value: String(metrics.leads) },
          { label: "صفقات ناجحة", value: String(metrics.won) },
          { label: "قيمة الصفقات", value: money(metrics.wonValue) },
        ]}
      />

      <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Filter className="size-3.5" /> الفترة
          </span>
          {periods.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setPeriod(item.value)}
              className={`rounded-md border px-3 py-1.5 text-xs font-bold transition ${
                period === item.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={`${inputClass} w-56 pe-9`}
              placeholder="ابحث باسم مسوق أو عميل أو جوال…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Button variant="outline" onClick={exportCsv}>
            <Download />
            تصدير التقرير
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setForm({ ...emptyForm });
              setOpen(true);
            }}
          >
            <Plus />
            إضافة مسوق
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="زيارات روابط المسوقين" value={metrics.visits} icon={Activity} hint={`${metrics.uniqueVisitors.toLocaleString("ar-EG")} زائر مختلف`} />
        <StatCard label="نسبة التحويل إلى عميل" value={metrics.conversion} suffix="%" icon={Target} hint="العملاء ÷ الزيارات" />
        <StatCard label="نسبة إغلاق الصفقات" value={metrics.closeRate} suffix="%" icon={TrendingUp} hint={`${metrics.won} صفقة من ${metrics.leads} عميل`} />
        <StatCard label="خط الأنابيب المفتوح" value={metrics.pipelineValue} suffix="ر.س" icon={Flame} hint={`${metrics.open} عميل قيد المتابعة`} />
        <StatCard label="عمولات متوقعة" value={metrics.expected} suffix="ر.س" icon={BarChart3} />
        <StatCard label="عمولات مستحقة/معتمدة" value={metrics.due} suffix="ر.س" icon={Banknote} />
        <StatCard label="عمولات مدفوعة" value={metrics.paid} suffix="ر.س" icon={BadgeCheck} />
        <StatCard label="مشاركات عقارات للمسوقين" value={metrics.shares} icon={Link2} hint="إرسال يدوي فقط" />
      </div>

      <div className="surface-card flex flex-wrap gap-2 p-2">
        {tabs.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold transition ${
              tab === item.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60"
            }`}
          >
            <item.icon className="size-4" />
            {item.label}
          </button>
        ))}
      </div>

      {dashboard.isLoading ? (
        <p className="surface-card p-10 text-center text-sm text-muted-foreground">جاري تحميل بيانات التسويق…</p>
      ) : null}

      {tab === "overview" ? (
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-3">
            <Panel className="xl:col-span-2" icon={TrendingUp} title="حركة الزيارات والعملاء والصفقات" subtitle="اتجاه الأداء التسويقي خلال الفترة المختارة.">
              <div className="h-72" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend}>
                    <defs>
                      <linearGradient id="mkVisits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" fontSize={10} />
                    <YAxis fontSize={10} allowDecimals={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="visits" name="الزيارات" stroke="var(--color-primary)" fill="url(#mkVisits)" strokeWidth={3} />
                    <Area type="monotone" dataKey="leads" name="العملاء" stroke="var(--color-gold)" fill="transparent" strokeWidth={2} />
                    <Area type="monotone" dataKey="won" name="الصفقات" stroke="var(--color-success)" fill="transparent" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel icon={Target} title="قمع التسويق" subtitle="من الزيارة حتى إغلاق الصفقة.">
              <div className="space-y-3">
                {funnel.map((stage, index) => {
                  const base = (funnel[0]?.value ?? 1) || 1;
                  const width = Math.max(4, (stage.value / base) * 100);
                  return (
                    <div key={stage.label}>
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-foreground">{stage.label}</span>
                        <span className="text-muted-foreground">
                          {stage.value.toLocaleString("ar-EG")}
                          {index > 0 && (funnel[index - 1]?.value ?? 0)
                            ? ` · ${((stage.value / (funnel[index - 1]?.value ?? 0)) * 100).toFixed(0)}%`
                            : ""}
                        </span>
                      </div>
                      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel className="xl:col-span-2" icon={Crown} title="ترتيب المسوقين" subtitle="مؤشر أداء مركّب من الزيارات والعملاء والصفقات.">
              {leaderboard.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">لا توجد بيانات كافية بعد.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="text-[11.5px] text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 font-semibold">#</th>
                        <th className="px-2 py-2 font-semibold">المسوق</th>
                        <th className="px-2 py-2 font-semibold">زيارات</th>
                        <th className="px-2 py-2 font-semibold">عملاء</th>
                        <th className="px-2 py-2 font-semibold">صفقات</th>
                        <th className="px-2 py-2 font-semibold">تحويل</th>
                        <th className="px-2 py-2 font-semibold">إغلاق</th>
                        <th className="px-2 py-2 font-semibold">عمولات</th>
                        <th className="px-2 py-2 font-semibold">النقاط</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((row, index) => (
                        <tr key={row.marketer.id} className="border-t border-border/70">
                          <td className="px-2 py-2 font-bold text-muted-foreground">{index + 1}</td>
                          <td className="px-2 py-2">
                            <Link
                              to="/marketing/$marketerId"
                              params={{ marketerId: row.marketer.id }}
                              className="font-bold text-primary hover:underline"
                            >
                              {row.marketer.full_name}
                            </Link>
                          </td>
                          <td className="px-2 py-2 tabular-nums">{row.visits}</td>
                          <td className="px-2 py-2 tabular-nums">{row.leads}</td>
                          <td className="px-2 py-2 tabular-nums font-bold text-success">{row.won}</td>
                          <td className="px-2 py-2 tabular-nums">{row.conversion.toFixed(1)}%</td>
                          <td className="px-2 py-2 tabular-nums">{row.closeRate.toFixed(0)}%</td>
                          <td className="px-2 py-2 tabular-nums">{money(row.earned)}</td>
                          <td className="px-2 py-2">
                            <Chip tone={index === 0 ? "gold" : "neutral"}>{row.score}</Chip>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel icon={Users} title="توزيع حالات العملاء" subtitle="أين يقف العملاء المنسوبون الآن.">
              {leadMix.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">لا يوجد عملاء منسوبون بعد.</p>
              ) : (
                <div className="h-64" dir="ltr">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={leadMix} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                        {leadMix.map((entry, index) => (
                          <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
          </div>
        </div>
      ) : null}

      {tab === "marketers" ? (
        <section className="surface-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
            <div>
              <h2 className="text-base font-bold text-foreground">المسوقون العقاريون</h2>
              <p className="mt-1 text-xs text-muted-foreground">كل مسوق له رابط مستقل وتقارير تحويل وعمولات منفصلة.</p>
            </div>
            <Chip tone="info">{filteredMarketers.length} مسوق</Chip>
          </div>
          {filteredMarketers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="لا يوجد مسوقون مطابقون"
              description="أضف مسوقًا ليحصل على رابط خاص ويبدأ قياس الزيارات والعملاء والصفقات."
              action={
                <Button onClick={() => { setEditing(null); setForm({ ...emptyForm }); setOpen(true); }}>
                  <Plus />
                  إضافة مسوق
                </Button>
              }
              className="m-5"
            />
          ) : (
            <div className="grid gap-4 p-5 lg:grid-cols-2 2xl:grid-cols-3">
              {filteredMarketers.map((item) => {
                const row = leaderboard.find((entry) => entry.marketer.id === item.id);
                return (
                  <article key={item.id} className="rounded-lg border border-border bg-card p-5 shadow-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-foreground">{item.full_name}</h3>
                          <Chip tone={item.status === "active" ? "success" : "neutral"}>
                            {statusLabel[item.status] ?? item.status}
                          </Chip>
                          {item.specialty ? <Chip tone="info">{item.specialty}</Chip> : null}
                        </div>
                        <p dir="ltr" className="mt-1 text-xs text-muted-foreground">{item.phone}</p>
                        {item.regions.length ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">المناطق: {item.regions.join("، ")}</p>
                        ) : null}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label="تعديل" onClick={() => edit(item)}>
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="حذف"
                          onClick={() => {
                            if (confirm(`حذف المسوق «${item.full_name}»؟`)) remove.mutate(item.id);
                          }}
                        >
                          <Trash2 className="text-destructive" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg border border-border bg-muted/35 p-3">
                      <p className="text-[11px] font-semibold text-muted-foreground">رابط الإحالة</p>
                      <p dir="ltr" className="mt-1 truncate text-xs font-semibold text-primary">
                        {referralUrl(item.referral_code)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => copy(item)}>
                          <Copy />
                          نسخ
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setQrMarketer(item)}>
                          <QrCode />
                          QR
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <a href={referralUrl(item.referral_code)} target="_blank" rel="noreferrer">
                            <ExternalLink />
                            فتح
                          </a>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toggleStatus.mutate(item)}>
                          {item.status === "active" ? "إيقاف مؤقت" : "تفعيل"}
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                      <MiniMetric label="زيارات" value={row?.visits ?? 0} />
                      <MiniMetric label="عملاء" value={row?.leads ?? 0} />
                      <MiniMetric label="صفقات" value={row?.won ?? 0} />
                      <MiniMetric label="عمولات" value={(row?.earned ?? 0).toLocaleString("ar-EG")} />
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, row?.closeRate ?? 0)}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      نسبة إغلاق الصفقات {(row?.closeRate ?? 0).toFixed(0)}% · مدة الإسناد {item.attribution_days} يومًا
                    </p>

                    <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                      <p className="text-xs text-muted-foreground">
                        {commissionTypeLabel[item.commission_type]}:{" "}
                        <b className="text-foreground">
                          {item.commission_value.toLocaleString("ar-EG")}
                          {item.commission_type === "fixed" ? " ر.س" : "%"}
                        </b>
                      </p>
                      <Button variant="link" size="sm" asChild>
                        <Link to="/marketing/$marketerId" params={{ marketerId: item.id }}>
                          التفاصيل
                          <ExternalLink />
                        </Link>
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {tab === "leads" ? (
        <Panel icon={UserCheck} title="العملاء المنسوبون للمسوقين" subtitle="حدّث حالة كل عميل حتى إغلاق الصفقة." >
          <div className="mb-4 flex flex-wrap gap-2">
            <select className={`${inputClass} w-48`} value={marketerFilter} onChange={(event) => setMarketerFilter(event.target.value)}>
              <option value="all">كل المسوقين</option>
              {raw.marketers.map((item) => (
                <option key={item.id} value={item.id}>{item.full_name}</option>
              ))}
            </select>
            <select className={`${inputClass} w-44`} value={leadStatusFilter} onChange={(event) => setLeadStatusFilter(event.target.value)}>
              <option value="all">كل الحالات</option>
              {Object.entries(leadStatusLabel).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          {filteredLeads.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">لا يوجد عملاء مطابقون لهذه الفلاتر.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="text-[11.5px] text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-semibold">العميل</th>
                    <th className="px-2 py-2 font-semibold">الجوال</th>
                    <th className="px-2 py-2 font-semibold">المسوق</th>
                    <th className="px-2 py-2 font-semibold">المصدر</th>
                    <th className="px-2 py-2 font-semibold">القيمة المتوقعة</th>
                    <th className="px-2 py-2 font-semibold">تاريخ الإسناد</th>
                    <th className="px-2 py-2 font-semibold">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="border-t border-border/70">
                      <td className="px-2 py-2 font-semibold text-foreground">{lead.customer_name || "بدون اسم"}</td>
                      <td dir="ltr" className="px-2 py-2 text-muted-foreground">{lead.customer_phone || "—"}</td>
                      <td className="px-2 py-2">{marketerName(lead.marketer_id)}</td>
                      <td className="px-2 py-2 text-muted-foreground">{lead.source || "رابط إحالة"}</td>
                      <td className="px-2 py-2 tabular-nums">{lead.estimated_value ? money(lead.estimated_value) : "—"}</td>
                      <td className="px-2 py-2 text-muted-foreground">{shortDate(lead.attributed_at)}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <Chip tone={leadStatusTone[lead.status] ?? "neutral"}>{leadStatusLabel[lead.status] ?? lead.status}</Chip>
                          <select
                            className={`${inputClass} w-32 py-1 text-xs`}
                            value={lead.status}
                            onChange={(event) => updateLead.mutate({ id: lead.id, status: event.target.value })}
                          >
                            {Object.entries(leadStatusLabel).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : null}

      {tab === "commissions" ? (
        <Panel icon={Banknote} title="سجل العمولات" subtitle="لا تُصرف عمولة إلا بعد اعتماد الإدارة.">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <SummaryTile label="متوقعة" value={money(metrics.expected)} tone="neutral" />
            <SummaryTile label="مستحقة ومعتمدة" value={money(metrics.due)} tone="warning" />
            <SummaryTile label="مدفوعة" value={money(metrics.paid)} tone="success" />
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <select className={`${inputClass} w-48`} value={marketerFilter} onChange={(event) => setMarketerFilter(event.target.value)}>
              <option value="all">كل المسوقين</option>
              {raw.marketers.map((item) => (
                <option key={item.id} value={item.id}>{item.full_name}</option>
              ))}
            </select>
            <select className={`${inputClass} w-44`} value={commissionStatusFilter} onChange={(event) => setCommissionStatusFilter(event.target.value)}>
              <option value="all">كل الحالات</option>
              {Object.entries(commissionStatusLabel).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          {filteredCommissions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">لا توجد عمولات مسجلة في هذه الفترة.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="text-[11.5px] text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-semibold">المسوق</th>
                    <th className="px-2 py-2 font-semibold">المبلغ</th>
                    <th className="px-2 py-2 font-semibold">أساس الحساب</th>
                    <th className="px-2 py-2 font-semibold">الاستحقاق</th>
                    <th className="px-2 py-2 font-semibold">الحالة</th>
                    <th className="px-2 py-2 font-semibold">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCommissions.map((row) => (
                    <tr key={row.id} className="border-t border-border/70">
                      <td className="px-2 py-2 font-semibold text-foreground">{marketerName(row.marketer_id)}</td>
                      <td className="px-2 py-2 tabular-nums font-bold">{money(row.amount)}</td>
                      <td className="px-2 py-2 tabular-nums text-muted-foreground">{row.basis_amount ? money(row.basis_amount) : "—"}</td>
                      <td className="px-2 py-2 text-muted-foreground">{shortDate(row.due_date)}</td>
                      <td className="px-2 py-2">
                        <Chip tone={commissionStatusTone[row.status] ?? "neutral"}>
                          {commissionStatusLabel[row.status] ?? row.status}
                        </Chip>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1">
                          {row.status !== "approved" && row.status !== "paid" ? (
                            <Button size="sm" variant="outline" onClick={() => updateCommission.mutate({ id: row.id, status: "approved" })}>
                              اعتماد
                            </Button>
                          ) : null}
                          {row.status !== "paid" ? (
                            <Button size="sm" onClick={() => updateCommission.mutate({ id: row.id, status: "paid" })}>
                              تسجيل الصرف
                            </Button>
                          ) : null}
                          {row.status !== "cancelled" && row.status !== "paid" ? (
                            <Button size="sm" variant="ghost" onClick={() => updateCommission.mutate({ id: row.id, status: "cancelled" })}>
                              إلغاء
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : null}

      {tab === "traffic" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel icon={Eye} title="أكثر الصفحات استقبالًا للزيارات" subtitle="الصفحات التي يهبط عليها عملاء المسوقين.">
            {topPages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">لا توجد زيارات مسجلة.</p>
            ) : (
              <div className="h-72" dir="ltr">
                <ResponsiveContainer>
                  <BarChart data={topPages} layout="vertical">
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={10} allowDecimals={false} />
                    <YAxis dataKey="label" type="category" width={140} fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="value" name="زيارات" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          <Panel icon={Link2} title="مصادر الزيارات" subtitle="من أين جاء الزوار عبر روابط المسوقين.">
            {topSources.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">لا توجد مصادر مسجلة.</p>
            ) : (
              <ul className="space-y-2">
                {topSources.map((item) => {
                  const max = (topSources[0]?.value ?? 1) || 1;
                  return (
                    <li key={item.label}>
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span dir="ltr" className="truncate text-foreground">{item.label}</span>
                        <span className="text-muted-foreground">{item.value.toLocaleString("ar-EG")}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-gold" style={{ width: `${(item.value / max) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel className="xl:col-span-2" icon={Activity} title="آخر الزيارات عبر روابط المسوقين" subtitle="سجل مجهول الهوية بدون بيانات شخصية.">
            {data.visits.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">لا توجد زيارات في هذه الفترة.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="text-[11.5px] text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 font-semibold">المسوق</th>
                      <th className="px-2 py-2 font-semibold">الصفحة</th>
                      <th className="px-2 py-2 font-semibold">المصدر</th>
                      <th className="px-2 py-2 font-semibold">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.visits.slice(0, 40).map((visit) => (
                      <tr key={visit.id} className="border-t border-border/70">
                        <td className="px-2 py-2 font-semibold text-foreground">{marketerName(visit.marketer_id)}</td>
                        <td dir="ltr" className="px-2 py-2 text-muted-foreground">{visit.landing_path || "/"}</td>
                        <td dir="ltr" className="px-2 py-2 text-muted-foreground">{visit.referrer_host || "مباشر"}</td>
                        <td className="px-2 py-2 text-muted-foreground">{shortDate(visit.visited_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      ) : null}

      {tab === "guide" ? (
        <section className="surface-card p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Link2 className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-foreground">كيف يعمل نظام المسوقين؟</h2>
              <p className="text-xs text-muted-foreground">شرح كامل للفريق من الرابط حتى صرف العمولة.</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <GuideStep number="١" icon={UserCheck} title="أنشئ المسوق" text="سجّل بياناته وحدد تخصصه ومناطقه وطريقة حساب العمولة ومدة الإسناد." />
            <GuideStep number="٢" icon={Link2} title="شاركه رابطه" text="أرسل له رابط الموقع العام أو رابط عقار محدد، أو رمز QR لإعلاناته." />
            <GuideStep number="٣" icon={Target} title="تابع رحلة العميل" text="يسجل النظام الزيارة، وعند تقديم طلب صحيح ينسب العميل للمسوق تلقائيًا." />
            <GuideStep number="٤" icon={Banknote} title="اعتمد العمولة" text="لا توجد عمولة على الزيارة وحدها. تُنشأ وتُراجع وتُعتمد وتُصرف من الإدارة." />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <InfoCard title="مدة الإسناد" text="كل مسوق له مدة محددة (افتراضيًا ٣٠ يومًا) يظل العميل خلالها منسوبًا له حتى لو عاد لاحقًا من رابط مباشر." />
            <InfoCard title="تعارض المسوقين" text="إذا دخل العميل من أكثر من رابط، يُحتسب آخر رابط فعّال ضمن مدة الإسناد، ويظهر في سجل الزيارات لمراجعة الإدارة." />
            <InfoCard title="أنواع العمولة" text="مبلغ ثابت، أو نسبة من عمولة المكتب، أو نسبة من قيمة الصفقة — تُحدد لكل مسوق على حدة." />
            <InfoCard title="الخصوصية" text="لا يسجل النظام بيانات شخصية للزائر، فقط معرّف مجهول والصفحة والمصدر والوقت." />
          </div>
          <div className="mt-5 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm leading-7 text-foreground">
            <b>قاعدة واتساب:</b> لا يرسل النظام شيئًا عند إضافة مسوق أو إنشاء رابط. إرسال العقار يتم فقط عندما تختار مسوقًا وتضغط زر الإرسال بنفسك.
          </div>
        </section>
      ) : null}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "تعديل ملف المسوق" : "إضافة مسوق عقاري"}
        subtitle="بيانات المسوق والرابط وقاعدة العمولة."
        wide
        footer={
          <>
            <GhostButton onClick={() => setOpen(false)}>إلغاء</GhostButton>
            <PrimaryButton onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "جاري الحفظ…" : "حفظ المسوق"}
            </PrimaryButton>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="اسم المسوق" required>
            <input className={inputClass} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="رقم الجوال" required>
            <input dir="ltr" className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="البريد الإلكتروني">
            <input dir="ltr" type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="كود الرابط" required hint="أحرف إنجليزية وأرقام، مثل: ahmed-01">
            <input dir="ltr" className={inputClass} value={form.referral_code} onChange={(e) => setForm({ ...form, referral_code: e.target.value })} />
          </Field>
          <Field label="التخصص">
            <input className={inputClass} value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="بيع فلل، إيجارات، أراضٍ…" />
          </Field>
          <Field label="المناطق" hint="افصل بينها بفاصلة عربية">
            <input className={inputClass} value={form.regions} onChange={(e) => setForm({ ...form, regions: e.target.value })} placeholder="بريدة، عنيزة" />
          </Field>
          <Field label="نوع العمولة">
            <select className={inputClass} value={form.commission_type} onChange={(e) => setForm({ ...form, commission_type: e.target.value })}>
              {Object.entries(commissionTypeLabel).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="قيمة العمولة">
            <input type="number" min="0" step="0.01" className={inputClass} value={form.commission_value} onChange={(e) => setForm({ ...form, commission_value: e.target.value })} />
          </Field>
          <Field label="مدة حفظ الإحالة" hint="من 1 إلى 365 يومًا">
            <input type="number" min="1" max="365" className={inputClass} value={form.attribution_days} onChange={(e) => setForm({ ...form, attribution_days: e.target.value })} />
          </Field>
          <Field label="الحالة">
            <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(statusLabel).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="ملاحظات" className="md:col-span-2">
            <textarea className={textareaClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(qrMarketer)}
        onClose={() => {
          setQrMarketer(null);
          setQrData("");
        }}
        title={`رمز رابط ${qrMarketer?.full_name ?? "المسوق"}`}
        subtitle="يمكن للمسوق وضعه في الإعلان أو طباعته."
      >
        <div className="grid place-items-center gap-4">
          {qrData ? (
            <img src={qrData} alt="رمز QR لرابط المسوق" className="size-64 rounded-lg border border-border" />
          ) : (
            <p className="text-sm text-muted-foreground">جاري إنشاء الرمز…</p>
          )}
          <Button variant="outline" onClick={() => qrMarketer && copy(qrMarketer)}>
            <Copy />
            نسخ الرابط
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  subtitle,
  children,
  className = "",
}: {
  icon: typeof Eye;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface-card p-5 ${className}`}>
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone: "neutral" | "warning" | "success" }) {
  const toneClass =
    tone === "success"
      ? "border-success/30 bg-success/10"
      : tone === "warning"
        ? "border-warning/30 bg-warning/10"
        : "border-border bg-muted/35";
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-extrabold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="rounded-lg border border-border bg-muted/25 p-4">
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      <p className="mt-1 text-xs leading-6 text-muted-foreground">{text}</p>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-muted/55 px-2 py-2">
      <p className="text-sm font-extrabold text-foreground">{value}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function GuideStep({ number, icon: Icon, title, text }: { number: string; icon: typeof Eye; title: string; text: string }) {
  return (
    <article className="rounded-lg border border-border bg-muted/25 p-4">
      <div className="flex items-center justify-between">
        <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4.5" />
        </span>
        <span className="text-lg font-black text-primary/35">{number}</span>
      </div>
      <h3 className="mt-3 text-sm font-bold text-foreground">{title}</h3>
      <p className="mt-1 text-xs leading-6 text-muted-foreground">{text}</p>
    </article>
  );
}
