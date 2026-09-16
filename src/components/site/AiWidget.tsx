import { useMutation } from "@tanstack/react-query";
import { Bot, Loader2, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

import { askPublicAi } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string; suggestions?: string[] };

const starters = [
  "أبحث عن شقة للإيجار في بريدة",
  "هل لديكم فلل للبيع بحي الريان؟",
  "كيف أعرض عقاري عندكم؟",
];

function FormattedText({ text }: { text: string }) {
  const parts = text.split(/(\[.*?\]\(.*?\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/\[(.*?)\]\((.*?)\)/);
        if (match) {
          const [, label, href] = match;
          const isExternal = href.startsWith("http");
          if (isExternal) {
            return (
              <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="text-gold underline hover:text-gold/80">
                {label}
              </a>
            );
          }
          return (
            <Link key={i} to={href as any} className="text-gold font-bold underline hover:text-gold/80">
              {label}
            </Link>
          );
        }
        return part;
      })}
    </>
  );
}

export function AiWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "مرحبًا بك في الرشودي للعقارات 👋 أنا مساعدك الذكي، كيف أساعدك في العثور على عقارك اليوم؟",
    },
  ]);
  const scroller = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef<{
    startX: number;
    startY: number;
    ox: number;
    oy: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
      }, 100);
    }
  }, [messages, open]);

  const ask = useMutation({
    mutationFn: async (text: string) => {
      const next: Message[] = [...messages, { role: "user", content: text }];
      setMessages(next);
      const res = await askPublicAi({ data: { messages: next.map(({ role, content }) => ({ role, content })) } });
      return res;
    },
    onSuccess: (res) => {
      setMessages((prev) => [...prev, { role: "assistant", content: res.text, suggestions: res.suggestions }]);
    },
    onError: (err) =>
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            err instanceof Error
              ? `تعذّر الوصول للمساعد الآن: ${err.message}`
              : "تعذّر الوصول للمساعد الآن، حاول لاحقًا أو تواصل معنا مباشرة.",
        },
      ]),
  });

  const send = (text: string) => {
    const value = text.trim();
    if (!value || ask.isPending) return;
    setInput("");
    ask.mutate(value);
  };

  return (
    <>
      <div
        style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)` }}
        className="fixed bottom-20 start-4 z-50 touch-none select-none sm:bottom-28 sm:start-5"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          dragging.current = {
            startX: e.clientX,
            startY: e.clientY,
            ox: pos.x,
            oy: pos.y,
            moved: false,
          };
        }}
        onPointerMove={(e) => {
          const d = dragging.current;
          if (!d) return;
          const dx = e.clientX - d.startX;
          const dy = e.clientY - d.startY;
          if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
          setPos({ x: d.ox + dx, y: d.oy + dy });
        }}
        onPointerUp={() => {
          const moved = dragging.current?.moved;
          dragging.current = null;
          if (!moved) setOpen((v) => !v);
        }}
        title="اسحب لتحريك المساعد • اضغط للفتح"
      >
        <button
          type="button"
          aria-label="المساعد الذكي"
          className="group relative grid size-16 place-items-center rounded-full border-2 border-primary-foreground/25 bg-primary text-primary-foreground shadow-float transition-transform hover:scale-105 sm:size-20"
        >
          <Bot className="size-8 animate-float-slow sm:size-10" strokeWidth={2.2} />
          <Sparkles className="absolute end-1.5 top-1.5 size-4 text-gold sm:end-2 sm:top-2 sm:size-5" />
          <span className="absolute -bottom-1 rounded-full border border-primary-foreground/20 bg-card px-2 py-0.5 text-[9px] font-black leading-none text-primary sm:text-[10px]">
            AI
          </span>
        </button>
      </div>

      {open ? (
        <section
          style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)` }}
          className="glass-panel fixed bottom-44 start-4 z-50 flex h-[min(35rem,80vh)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden shadow-2xl"
        >
          <header className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-gold" />
              <h2 className="text-[13.5px] font-bold">مساعد الرشودي الذكي</h2>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="hover:opacity-80">
              <X className="size-4" />
            </button>
          </header>

          <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
            {messages.map((message, index) => (
              <div key={index} className="space-y-2">
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[12.5px] leading-6",
                    message.role === "user"
                      ? "ms-auto bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  <FormattedText text={message.content} />
                </div>
                {message.suggestions && message.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {message.suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => send(s)}
                        className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {ask.isPending ? (
              <p className="inline-flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-[12.5px]">
                <Loader2 className="size-4 animate-spin text-primary" />
                جاري البحث في العقارات…
              </p>
            ) : null}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {starters.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => send(item)}
                    className="rounded-full border border-border px-3 py-1.5 text-[11.5px] font-semibold text-muted-foreground hover:bg-muted"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-border px-3 py-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب ميزانيتك أو الحي المفضل…"
              className="h-10 flex-1 rounded-lg border border-border bg-card px-3 text-[12.5px] outline-none focus:border-primary/40"
            />
            <button
              type="submit"
              disabled={ask.isPending || !input.trim()}
              aria-label="إرسال"
              className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
            >
              <Send className="size-4" />
            </button>
          </form>
        </section>
      ) : null}
    </>
  );
}
