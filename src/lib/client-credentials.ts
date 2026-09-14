export const CLIENT_EMAIL_DOMAIN = "client.mithraa.sa";

const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
const persianDigits = "۰۱۲۳۴۵۶۷۸۹";

export function credentialDigits(raw: string | null | undefined): string {
  return String(raw ?? "")
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)))
    .replace(/\D/g, "");
}

export function localPhone(raw: string | null | undefined): string {
  const digits = credentialDigits(raw);
  if (!digits) return "";
  if (digits.startsWith("00966")) return `0${digits.slice(5)}`;
  if (digits.startsWith("966")) return `0${digits.slice(3)}`;
  if (digits.startsWith("5")) return `0${digits}`;
  return digits;
}

export function clientUsername(nationalId: string | null | undefined): string {
  return credentialDigits(nationalId);
}