import { createFileRoute } from "@tanstack/react-router";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import heroImage from "@/assets/hero-contact.jpg";
import heroVideo from "@/assets/video-city.mp4.asset.json";
import { PageHero } from "@/components/site/PageHero";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COMPANY_EMAIL, COMPANY_PHONE, whatsappLink } from "@/lib/site-data";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "تواصل معنا | الرشودي للعقارات" },
      {
        name: "description",
        content: "تواصل مع الرشودي للعقارات في بريدة عبر الهاتف أو واتساب أو البريد، ومواقعنا وأوقات العمل.",
      },
      { property: "og:title", content: "تواصل معنا | الرشودي للعقارات" },
      {
        property: "og:description",
        content: "أرسل استفسارك العقاري وسيتواصل معك فريق الرشودي للعقارات.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://alrashudi.sa/contact" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://alrashudi.sa/contact" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error("أدخل الاسم ورقم الجوال");
      return;
    }
    const text = `استفسار من الموقع\nالاسم: ${name}\nالجوال: ${phone}\nالرسالة: ${message}`;
    window.open(whatsappLink(null, text), "_blank", "noreferrer");
  };

  return (
    <SiteLayout>
      <PageHero
        image={heroImage}
        video={heroVideo.url}
        eyebrow="فريقنا في خدمتك"
        title="تواصل معنا"
        subtitle="فريقنا جاهز للرد على استفساراتك العقارية في بريدة عبر الهاتف أو واتساب أو البريد."
        height="md"
      />

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Phone, title: "الهاتف", value: COMPANY_PHONE, href: `tel:${COMPANY_PHONE}` },
            { icon: Mail, title: "البريد الإلكتروني", value: COMPANY_EMAIL, href: `mailto:${COMPANY_EMAIL}` },
            { icon: MapPin, title: "الموقع", value: "بريدة — القصيم" },
            { icon: Clock, title: "أوقات العمل", value: "السبت — الخميس، 9ص إلى 10م" },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border bg-card p-6 text-center shadow-card"
            >
              <span className="mx-auto grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
                <item.icon className="size-5" />
              </span>
              <h2 className="mt-3 text-[14.5px] font-bold text-foreground">{item.title}</h2>
              {item.href ? (
                <a href={item.href} dir="ltr" className="mt-1 block text-[13px] text-primary">
                  {item.value}
                </a>
              ) : (
                <p className="mt-1 text-[13px] text-muted-foreground">{item.value}</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <form
            onSubmit={send}
            className="space-y-4 rounded-2xl border border-border bg-card p-7 shadow-card"
          >
            <h2 className="text-[17px] font-bold text-foreground">أرسل استفسارك</h2>
            <div className="space-y-2">
              <Label htmlFor="name">الاسم</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">رقم الجوال</Label>
              <Input
                id="phone"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">رسالتك</Label>
              <Textarea
                id="message"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="اكتب تفاصيل استفسارك العقاري"
              />
            </div>
            <Button type="submit" className="w-full">
              إرسال عبر واتساب
            </Button>
          </form>

          <div className="overflow-hidden rounded-2xl border border-border shadow-card">
            <iframe
              title="موقع الرشودي للعقارات في بريدة"
              src="https://www.openstreetmap.org/export/embed.html?bbox=43.90%2C26.28%2C44.10%2C26.40&layer=mapnik"
              className="h-full min-h-[420px] w-full"
              loading="lazy"
            />
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
