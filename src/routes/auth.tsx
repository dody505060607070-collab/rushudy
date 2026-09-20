import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { toast } from "sonner";

import navbarLogo from "@/assets/rashudi-logo-navbar.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { resolveClientLogin } from "@/lib/portal.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "الرشودي للعقارات" },
      { name: "description", content: "دخول فريق الرشودي للعقارات إلى لوحة التحكم الداخلية." },
      { property: "og:title", content: "الرشودي للعقارات" },
      { property: "og:description", content: "دخول فريق الرشودي للعقارات إلى لوحة التحكم الداخلية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [audience, setAudience] = useState<"staff" | "client" | "partner">("client");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const [account, partner] = await Promise.all([supabase
        .from("client_accounts")
        .select("id")
        .eq("user_id", data.session.user.id)
        .maybeSingle(), supabase.from("service_partner_accounts").select("id").eq("user_id", data.session.user.id).maybeSingle()]);
      navigate({ to: partner.data ? "/partner" : account.data ? "/portal" : "/dashboard" });
    })();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (audience === "client") {
        const resolved = await resolveClientLogin({ data: { username, password } });
        if (!resolved.email)
          throw new Error("بيانات الدخول غير صحيحة. استخدم رقم العقد أو الهوية مع رقم جوالك.");
        const { error } = await supabase.auth.signInWithPassword({
          email: resolved.email,
          password: resolved.password ?? password,
        });
        if (error) throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة.");
        navigate({ to: "/portal" });
      } else if (audience === "partner") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error("البريد أو كلمة المرور غير صحيحة.");
        const partner = await supabase.from("service_partner_accounts").select("id").eq("user_id", data.user.id).maybeSingle();
        if (!partner.data) { await supabase.auth.signOut(); throw new Error("هذا الحساب غير مرتبط بشركة خدمات."); }
        navigate({ to: "/partner" });
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب. إن طُلب تأكيد البريد فافتح الرسالة المرسلة إليك.");
        const { data } = await supabase.auth.getSession();
        if (data.session) navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر إكمال العملية");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("تعذّر الدخول عبر Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  };

  const isClient = audience === "client";
  const isPartner = audience === "partner";

  return (
    <main className="min-h-screen bg-muted/40 p-4 sm:grid sm:place-items-center sm:p-8" dir="rtl">
      <div className="relative mx-auto w-full max-w-5xl">
        <div className="absolute inset-y-6 -end-3 hidden w-24 rounded-[2rem] bg-primary/80 lg:block" />
        <div className="relative grid overflow-hidden rounded-[1.75rem] bg-card shadow-2xl lg:grid-cols-2">
          <aside className="relative flex flex-col justify-between lg:order-2 overflow-hidden bg-primary p-8 text-primary-foreground sm:p-10">
            <div className="pointer-events-none absolute -bottom-24 -start-20 size-80 rounded-full border border-primary-foreground/10" />
            <div className="pointer-events-none absolute -bottom-40 -start-10 size-96 rounded-full border border-primary-foreground/10" />

            <img
              src={navbarLogo.url}
              alt="الرشودي للعقارات"
              className="relative mx-auto h-14 w-fit object-contain sm:h-16"
            />

            <div className="relative mt-12">
              <h2 className="text-2xl font-black sm:text-3xl">
                {isClient ? "بوابة الرشودي للعملاء" : isPartner ? "بوابة شركاء الخدمات" : "بوابة الرشودي للموظفين"}
              </h2>
              <p className="mt-4 text-sm leading-7 text-primary-foreground/75">
                 {isClient
                  ? "بوابة مخصصة لعملاء الرشودي للعقارات لمتابعة العقود والمدفوعات وفق الصلاحيات المعتمدة."
                   : isPartner ? "بوابة مخصصة للشركات لمتابعة طلبات العملاء وإصدار الفواتير." : "بوابة مخصصة لموظفي وإدارة الرشودي للعقارات لمتابعة الأعمال اليومية وفق الصلاحيات المعتمدة."}
              </p>
              <ul className="mt-6 space-y-3 text-[13px] leading-6 text-primary-foreground/85">
                {(isClient
                  ? [
                      "متابعة عقودك ومدفوعاتك من مكان واحد.",
                      "تظهر لكل مستخدم الخدمات المصرح بها فقط.",
                      "للمساعدة في الدخول يرجى التواصل مع مسؤول النظام.",
                    ]
                  : [
                      "إدارة العقارات والطلبات والمهام من مكان واحد.",
                      "تظهر لكل مستخدم الخدمات المصرح بها فقط.",
                      "للمساعدة في الدخول يرجى التواصل مع مسؤول النظام.",
                    ]
                ).map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-secondary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <p className="relative mt-10 rounded-xl bg-primary-foreground/10 px-4 py-3 text-[12px] leading-6 text-primary-foreground/80">
              حفاظاً على سرية بياناتك، لا تشارك معلومات الدخول مع أي شخص.
            </p>
          </aside>

          <section className="flex flex-col">
            <div className="flex-1 p-8 sm:p-10">
              <div className="flex items-center justify-end gap-3">
                <span className="text-[13px] font-bold text-primary">
                  {isClient ? "بوابة العملاء" : isPartner ? "بوابة الشركات" : "بوابة الموظفين"}
                </span>
                <span className="h-px w-6 bg-secondary" />
              </div>

              <h1 className="mt-3 text-3xl font-black text-foreground">
                {mode === "signup" && !isClient && !isPartner ? "إنشاء حساب موظف" : "تسجيل الدخول"}
              </h1>
              <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
                {isClient
                  ? "استخدم حسابك المعتمد للوصول إلى بوابة عملاء الرشودي للعقارات."
                  : "استخدم حسابك المعتمد للوصول إلى لوحة إدارة الرشودي للعقارات."}
              </p>

               <div className="mt-6 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 text-sm font-semibold">
                 {(["client", "partner", "staff"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => { setAudience(a); if (a !== "staff") setMode("signin"); }}
                    className={`rounded-lg py-2 transition ${audience === a ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                  >
                     {a === "staff" ? "موظف" : a === "partner" ? "شركة" : "عميل"}
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="mt-6 space-y-5">
                {!isClient && !isPartner && mode === "signup" ? (
                  <Field id="name" label="الاسم الكامل" icon={<UserRound className="size-4" />}>
                    <Input
                      id="name"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="مثال: محمد الرشودي"
                      className="h-12 rounded-none border-0 bg-accent/40 text-end shadow-none focus-visible:ring-0"
                    />
                  </Field>
                ) : null}

                {isClient ? (
                  <Field id="username" label="اسم المستخدم" icon={<UserRound className="size-4" />}>
                    <Input
                      id="username"
                      dir="ltr"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="1xxxxxxxxx"
                      className="h-12 rounded-none border-0 bg-accent/40 text-end shadow-none focus-visible:ring-0"
                    />
                  </Field>
                ) : (
                  <Field id="email" label="البريد الإلكتروني" icon={<Mail className="size-4" />}>
                    <Input
                      id="email"
                      type="email"
                      dir="ltr"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@al-rashudi.com"
                      className="h-12 rounded-none border-0 bg-accent/40 text-end shadow-none focus-visible:ring-0"
                    />
                  </Field>
                )}

                <Field
                  id="password"
                  label="كلمة المرور"
                  icon={<LockKeyhole className="size-4" />}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                      className="grid h-12 w-12 shrink-0 place-items-center text-muted-foreground transition hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  }
                >
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    dir="ltr"
                    required
                    minLength={isClient ? 6 : 8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="h-12 rounded-none border-0 bg-accent/40 text-end shadow-none focus-visible:ring-0"
                  />
                </Field>

                {mode === "signin" ? (
                  <div className="text-end">
                    <label className="flex cursor-pointer items-center justify-end gap-2 text-[13px] font-medium text-foreground">
                      البقاء متصلاً
                      <input type="checkbox" className="size-4 accent-primary" />
                    </label>
                    <p className="mt-1 text-[12px] text-muted-foreground">استخدمها على جهازك الشخصي فقط.</p>
                  </div>
                ) : null}

                <Button type="submit" className="h-12 w-full rounded-full text-base font-bold" disabled={busy}>
                  {mode === "signup" && !isClient && !isPartner ? "إنشاء الحساب" : "تسجيل الدخول"}
                </Button>
              </form>

              {!isClient && !isPartner && mode === "signin" ? (
                <>
                  <div className="my-5 flex items-center gap-3 text-[12px] text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    أو
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <Button type="button" variant="outline" className="w-full rounded-full" onClick={google} disabled={busy}>
                    الدخول باستخدام Google
                  </Button>
                </>
              ) : null}

              {!isClient && !isPartner ? (
                <button
                  type="button"
                  className="mt-6 w-full text-[13px] text-primary underline-offset-4 hover:underline"
                  onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                >
                  {mode === "signin" ? "ليس لديك حساب؟ إنشاء حساب" : "لدي حساب بالفعل — تسجيل الدخول"}
                </button>
              ) : null}
            </div>

            <p className="border-t border-border bg-muted/40 px-8 py-4 text-center text-[12px] text-muted-foreground">
              {isClient ? "هذه البوابة مخصصة لعملاء الرشودي فقط." : isPartner ? "هذه البوابة مخصصة لشركاء الخدمات المعتمدين فقط." : "هذه البوابة مخصصة للموظفين والإدارة فقط."}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({
  id,
  label,
  icon,
  trailing,
  children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block text-end text-[13px] font-bold text-foreground">
        {label} <span className="text-primary">*</span>
      </Label>
      <div className="flex overflow-hidden rounded-xl border border-border bg-accent/40 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15">
        <span className="grid h-12 w-12 shrink-0 place-items-center border-e border-border bg-card text-primary">
          {icon}
        </span>
        <div className="flex-1">{children}</div>
        {trailing}
      </div>
    </div>
  );
}

