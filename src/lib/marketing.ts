export const MARKETING_REFERRAL_KEY = "rashoudi_marketing_referral";

export type StoredReferral = {
  code: string;
  marketerId: string;
  expiresAt: number;
};

export function getStoredReferral(): StoredReferral | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(MARKETING_REFERRAL_KEY) ?? "null") as StoredReferral | null;
    if (!value || value.expiresAt <= Date.now()) {
      window.localStorage.removeItem(MARKETING_REFERRAL_KEY);
      return null;
    }
    return value;
  } catch {
    window.localStorage.removeItem(MARKETING_REFERRAL_KEY);
    return null;
  }
}

export function referralUrl(code: string, propertyCode?: string | null) {
  const path = propertyCode ? `/properties/${encodeURIComponent(propertyCode)}` : "/";
  const origin = typeof window === "undefined" ? "https://alrashudi.sa" : window.location.origin;
  return `${origin}${path}?ref=${encodeURIComponent(code)}`;
}