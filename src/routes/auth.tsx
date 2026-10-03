import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { KeyRound, Phone } from "lucide-react";
import { toast } from "sonner";

import navbarLogo from "@/assets/rashudi-logo-navbar.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { requestPhoneCode, verifyPhoneCode } from "@/lib/phone-auth.functions";
import { markSessionPersistence } from "@/hooks/useAuth";

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

const COUNTRIES = [
  { code: "966", label: "السعودية +966" },
  { code: "20", label: "مصر +20" },
  { code: "971", label: "الإمارات +971" },
  { code: "965", label: "الكويت +965" },
  { code: "974", label: "قطر +974" },
  { code: "973", label: "البحرين +973" },
  { code: "968", label: "عُمان +968" },
  { code: "962", label: "الأردن +962" },
];

function AuthPage() {
  const navigate = useNavigate();
  const [country, setCountry] = useState("966");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const [account, partner] = await Promise.all([
        supabase.from("client_accounts").select("id").eq("user_id", data.session.user.id).maybeSingle(),
        supabase.from("service_partner_accounts").select("id").eq("user_id", data.session.user.id).maybeSingle(),
      ]);
      navigate({ to: partner.data ? "/partner" : account.data ? "/portal" : "/dashboard" });
    })();
  }, [navigate]);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const res = await requestPhoneCode({ data: { country, phone } });
      if (!res.ok) throw new Error(res.error);
      toast.success("أرسلنا رمز الدخول على واتساب");
      setStep("code");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر إرسال الرمز");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await verifyPhoneCode({ data: { country, phone, code } });
      if (!res.ok) throw new Error(res.error);
      const { error } = await supabase.auth.verifyOtp({ token_hash: res.tokenHash, type: "magiclink" });
      if (error) throw new Error("تعذّر فتح الجلسة، اطلب رمزًا جديدًا.");
      markSessionPersistence(remember);
      navigate({ to: res.destination as "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر التحقق");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-muted/40 p-4 sm:grid sm:place-items-center sm:p-8" dir="rtl">
      <div className="relative mx-auto w-full max-w-5xl">
        <div className="absolute inset-y-6 -end-3 hidden w-24 rounded-[2rem] bg-primary/80 lg:block" />
        <div className="relative grid overflow-hidden rounded-[1.75rem] bg-card shadow-2xl lg:grid-cols-2">
          <aside className="relative flex flex-col justify-between overflow-hidden bg-primary p-8 text-primary-foreground sm:p-10 lg:order-2">
            <div className="pointer-events-none absolute -bottom-24 -start-20 size-80 rounded-full border border-primary-foreground/10" />
            <img src={navbarLogo.url} alt="الرشودي للعقارات" className="relative mx-auto h-14 w-fit object-contain sm:h-16" />
            <div className="relative mt-12">
              <h2 className="text-2xl font-black sm:text-3xl">بوابة الرشودي للعقارات</h2>
              <p className="mt-4 text-sm leading-7 text-primary-foreground/75">
                دخول واحد للموظفين والملاك والمستأجرين وشركاء الخدمات — برقم جوالك فقط، بدون كلمة مرور.
              </p>
              <ul className="mt-6 space-y-3 text-[13px] leading-6 text-primary-foreground/85">
                {["اكتب رقم جوالك المسجّل لدينا.", "يصلك رمز من 6 أرقام على واتساب.", "اكتب الرمز وتدخل حسابك مباشرة."].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-secondary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <p className="relative mt-10 rounded-xl bg-primary-foreground/10 px-4 py-3 text-[12px] leading-6 text-primary-foreground/80">
              لا تشارك رمز الدخول مع أي شخص، حتى لو قال إنه من المكتب.
            </p>
          </aside>

          <section className="flex flex-col">
            <div className="flex-1 p-8 sm:p-10">
              <h1 className="text-3xl font-black text-foreground">تسجيل الدخول</h1>
              <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
                {step === "phone" ? "اختر رمز الدولة واكتب رقم جوالك." : `أدخل الرمز المرسل على واتساب إلى +${country} ${phone}`}
              </p>

              {step === "phone" ? (
                <form onSubmit={sendCode} className="mt-6 space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="block text-[13px] font-bold">رقم الجوال <span className="text-primary">*</span></Label>
                    <div className="flex gap-2" dir="ltr">
                      <select
                        aria-label="رمز الدولة"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="h-12 rounded-xl border border-border bg-accent/40 px-2 text-sm"
                      >
                        {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                      </select>
                      <div className="flex flex-1 items-center overflow-hidden rounded-xl border border-border bg-accent/40 focus-within:border-primary/50">
                        <span className="grid h-12 w-12 place-items-center text-primary"><Phone className="size-4" /></span>
                        <Input id="phone" type="tel" inputMode="numeric" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5xxxxxxxx" className="h-12 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0" />
                      </div>
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-primary" />
                    البقاء متصلاً على هذا الجهاز
                  </label>
                  <Button type="submit" className="h-12 w-full rounded-full text-base font-bold" disabled={busy}>
                    إرسال الرمز على واتساب
                  </Button>
                </form>
              ) : (
                <form onSubmit={verify} className="mt-6 space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="code" className="block text-[13px] font-bold">رمز الدخول</Label>
                    <div className="flex items-center overflow-hidden rounded-xl border border-border bg-accent/40">
                      <span className="grid h-12 w-12 place-items-center text-primary"><KeyRound className="size-4" /></span>
                      <Input id="code" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="••••••" className="h-12 rounded-none border-0 bg-transparent text-center text-lg tracking-[0.5em] shadow-none focus-visible:ring-0" />
                    </div>
                  </div>
                  <Button type="submit" className="h-12 w-full rounded-full text-base font-bold" disabled={busy || code.length !== 6}>
                    دخول
                  </Button>
                  <div className="flex justify-between text-[13px]">
                    <button type="button" className="text-primary hover:underline" onClick={() => { setStep("phone"); setCode(""); }}>تغيير الرقم</button>
                    <button type="button" className="text-primary hover:underline" disabled={busy} onClick={() => void sendCode()}>إعادة إرسال الرمز</button>
                  </div>
                </form>
              )}
            </div>
            <p className="border-t border-border bg-muted/40 px-8 py-4 text-center text-[12px] text-muted-foreground">
              الدخول متاح فقط للأرقام المسجّلة لدى الرشودي للعقارات.
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

