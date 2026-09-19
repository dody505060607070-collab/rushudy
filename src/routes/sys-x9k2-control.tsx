import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { killSwitchAccess, setKillSwitch } from "@/lib/kill-switch.functions";

export const Route = createFileRoute("/sys-x9k2-control")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow, noarchive" }, { title: "404" }] }),
  component: ControlPage,
});

/** صفحة وهمية مطابقة لصفحة غير موجودة — تُعرض لأي زائر غير مصرّح. */
function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <div>
        <h1 className="text-3xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">الصفحة غير موجودة.</p>
      </div>
    </div>
  );
}

function ControlPage() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [state, setState] = useState<{ locked: boolean; message: string } | null>(null);

  const run = useServerFn(setKillSwitch);
  const checkAccess = useServerFn(killSwitchAccess);

  const load = async () => {
    try {
      const result = await checkAccess({ data: undefined as never });
      setState({ locked: result.locked, message: result.message });
      setAllowed(true);
    } catch {
      setAllowed(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function apply(locked: boolean) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await run({ data: message ? { code, locked, message } : { code, locked } });
      if (res.ok) {
        setStatus(locked ? "تم قفل الموقع" : "تم تشغيل الموقع");
        setCode("");
        await load();
      } else {
        setStatus(res.error);
      }
    } catch {
      setStatus("فشلت العملية");
    } finally {
      setBusy(false);
    }
  }

  if (allowed !== true) return <NotFound />;

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-md px-6 py-12">
        <h1 className="text-xl font-bold">لوحة الإيقاف الكلي</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          الحالة الحالية:{" "}
          <span className={state?.locked ? "text-destructive" : "text-primary"}>
            {state?.locked ? "مقفول" : "مفتوح"}
          </span>
        </p>

        <div className="mt-8 space-y-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">الكود السري</label>
            <input
              type="password"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">رسالة الإيقاف (اختياري)</label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={state?.message || "الموقع متوقف مؤقتاً."}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              disabled={busy || !code}
              onClick={() => apply(true)}
              className="flex-1 rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-40"
            >
              قفل الموقع
            </button>
            <button
              type="button"
              disabled={busy || !code}
              onClick={() => apply(false)}
              className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              فتح الموقع
            </button>
          </div>

          {status ? <p className="pt-2 text-xs text-muted-foreground">{status}</p> : null}
        </div>
      </div>
    </div>
  );
}
