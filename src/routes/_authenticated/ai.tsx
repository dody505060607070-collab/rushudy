import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  ChevronLeft,
  FileText,
  Home,
  Lightbulb,
  Loader2,
  MessageSquare,
  Paperclip,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PageHero } from "@/components/kit/PageHero";
import { askAdminAi } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({
    meta: [
      { title: "مساعد الرشودي للعقارات الذكي | الرشودي للعقارات" },
      {
        name: "description",
        content: "شات ذكي داخل لوحة التحكم: اسحب أي صف أو بيانات إليه ليحللها ويقترح الخطوة التالية.",
      },
      { property: "og:title", content: "مساعد الرشودي للعقارات الذكي | الرشودي للعقارات" },
      { property: "og:description", content: "مساعد ذكي يفهم صفحات لوحة التحكم ويحلل البيانات المسحوبة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiPage,
});

type Message = { role: "user" | "assistant"; content: string };

const suggestions = [
  "لخّص لي حالة العقود القريبة من الانتهاء",
  "كيف أضيف عقارًا جديدًا ويظهر على الموقع؟",
  "اقترح خطة متابعة لطلبات توفير العقار",
  "ما الفرق بين مهام التصوير والمهام العادية؟",
];

function AiPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textarea.current?.focus();
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const ask = useMutation({
    mutationFn: async (text: string) => {
      const next: Message[] = [...messages, { role: "user", content: text }];
      setMessages(next);
      const res = await askAdminAi({
        data: {
          messages: next,
          ...(chips.length ? { context: chips.join("\n---\n") } : {}),
        },
      });
      return res.text;
    },
    onSuccess: (text) => setMessages((prev) => [...prev, { role: "assistant", content: text }]),
    onError: (err) => toast.error(err instanceof Error ? err.message : "تعذّر الوصول للمساعد"),
  });

  const send = (text: string) => {
    const value = text.trim();
    if (!value || ask.isPending) return;
    setInput("");
    ask.mutate(value);
    textarea.current?.focus();
  };

  const suggestionIcons = [FileText, Lightbulb, Home, BarChart3];

  return (
    <>
      <PageHero
        title="المساعد الذكي"
        subtitle="مساعدك الذكي لتحليل البيانات والإجابة على استفسارات العقارات والعقود والملاك."
        icon={Sparkles}
        stats={[
          { value: String(messages.filter((m) => m.role === "user").length), label: "سؤال", icon: MessageSquare },
          { value: String(chips.length), label: "عنصر مرفق", icon: Paperclip },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <section className="surface-card flex h-[68vh] flex-col overflow-hidden">
          <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            <div className="rounded-2xl bg-muted/50 p-4">
              <div className="mb-1 flex items-center gap-2">
                <Lightbulb className="size-5 text-[color:var(--warning)]" />
                <h2 className="text-[15px] font-bold text-foreground">اقتراحات لك</h2>
              </div>
              <p className="mb-3 text-[12px] text-muted-foreground">جرّب أحد هذه الاقتراحات لبدء المحادثة</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {suggestions.map((s, i) => {
                  const Icon = suggestionIcons[i % suggestionIcons.length];
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-start transition-colors hover:border-primary/40"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                        <Icon className="size-5" />
                      </span>
                      <span className="flex-1 text-[13px] font-semibold text-foreground">{s}</span>
                      <ChevronLeft className="size-4 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            </div>

            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex items-start gap-3", m.role === "user" ? "flex-row" : "flex-row-reverse")}
              >
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full",
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-primary text-primary-foreground",
                  )}
                >
                  {m.role === "user" ? <User className="size-5" /> : <Sparkles className="size-5" />}
                </span>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-primary/[0.08] text-foreground"
                      : "border border-border bg-card text-foreground shadow-sm",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {ask.isPending ? (
              <div className="flex flex-row-reverse items-start gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Sparkles className="size-5" />
                </span>
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-[13px] text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  يفكّر…
                </div>
              </div>
            ) : null}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-border px-4 py-3"
          >
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2">
              <Sparkles className="ms-2 size-5 shrink-0 text-[color:var(--warning)]" />
              <textarea
                ref={textarea}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder="اسأل المساعد… (Enter للإرسال)"
                className="min-h-[42px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[13.5px] outline-none"
              />
              <button
                type="submit"
                disabled={ask.isPending || !input.trim()}
                className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition-opacity hover:opacity-90 disabled:opacity-50"
                aria-label="إرسال"
              >
                <Send className="size-5" />
              </button>
            </div>
          </form>
        </section>

        <aside
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const text = e.dataTransfer.getData("text/plain").trim();
            if (!text) return;
            setChips((prev) => [...prev, text]);
            toast.success("تم إرفاق العنصر بالمحادثة");
          }}
          className={cn(
            "surface-card flex max-h-[68vh] flex-col overflow-hidden transition-colors",
            dragging && "border-primary/50 bg-accent/40",
          )}
        >
          <div className="flex items-start justify-between gap-2 px-5 pt-5">
            <div>
              <h2 className="flex items-center gap-2 text-[15px] font-bold text-foreground">
                <Paperclip className="size-4" /> العناصر المرفقة
              </h2>
              <p className="mt-1 text-[12px] text-muted-foreground">أرفق بيانات لطرح أسئلة أكثر دقة</p>
            </div>
            {chips.length ? (
              <button
                type="button"
                onClick={() => setChips([])}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-destructive"
              >
                <Trash2 className="size-3.5" />
                مسح
              </button>
            ) : null}
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            <div className="grid place-items-center gap-2 rounded-2xl border-2 border-dashed border-border px-4 py-8 text-center">
              <UploadCloud className="size-9 text-muted-foreground" />
              <p className="text-[13px] font-bold text-foreground">اسحب العناصر هنا</p>
              <p className="text-[11.5px] text-muted-foreground">
                أي صف من جداول العقارات، الطلبات، العقود، المهام أو التذكيرات
              </p>
            </div>
            {chips.length ? (
              <p className="text-[13px] font-bold text-foreground">العناصر المرفقة ({chips.length})</p>
            ) : null}
            {chips.map((c, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-[12px] text-foreground"
              >
                <FileText className="mt-0.5 size-5 shrink-0 text-primary" />
                <span className="line-clamp-3 flex-1">{c}</span>
                <button
                  type="button"
                  onClick={() => setChips((prev) => prev.filter((_, x) => x !== i))}
                  aria-label="إزالة"
                >
                  <X className="size-4 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
