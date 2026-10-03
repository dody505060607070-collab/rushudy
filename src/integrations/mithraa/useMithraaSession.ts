import { useEffect, useState } from "react";

import { mithraa } from "./client";

export type MithraaUser = { id: string; email: string | null } | null;

/** جلسة قاعدة "مثراء" المستقلة — يحتاجها الشات المشترك. */
export function useMithraaSession() {
  const [user, setUser] = useState<MithraaUser>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void mithraa.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const u = data.session?.user;
      setUser(u ? { id: u.id, email: u.email ?? null } : null);
      setReady(true);
    });
    const { data: sub } = mithraa.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      setUser(u ? { id: u.id, email: u.email ?? null } : null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { mithraaUser: user, ready };
}

/** تسجيل دخول موظف الرشودي إلى قاعدة مثراء + ضمان org = 'rashoudi'. */
export async function signInToMithraa(email: string, password: string, fullName?: string) {
  let res;
  try {
    res = await mithraa.auth.signInWithPassword({ email, password });
  } catch {
    throw new Error("خادم الشات المشترك (مثراء) غير متاح حاليًا — الخدمة متوقفة من جهتهم. تواصل مع مسؤول مثراء لإعادة تشغيلها.");
  }
  const { data, error } = res;
  if (error) {
    if (/fetch|network/i.test(error.message)) throw new Error("خادم الشات المشترك (مثراء) غير متاح حاليًا — الخدمة متوقفة من جهتهم. تواصل مع مسؤول مثراء لإعادة تشغيلها.");
    throw error;
  }
  const uid = data.user?.id;
  if (!uid) throw new Error("تعذّر تسجيل الدخول");
  // لا ننشئ جداول — فقط نضمن وجود ملف الموظف بمؤسسة الرشودي
  const { data: existing } = await mithraa.from("profiles").select("id, org").eq("id", uid).maybeSingle();
  if (!existing) {
    await mithraa
      .from("profiles")
      .insert({ id: uid, full_name: fullName ?? email.split("@")[0], email, org: "rashoudi", is_active: true });
  } else if (existing.org !== "rashoudi") {
    await mithraa.from("profiles").update({ org: "rashoudi" }).eq("id", uid);
  }
  return uid;
}

export async function signOutMithraa() {
  await mithraa.auth.signOut();
}
