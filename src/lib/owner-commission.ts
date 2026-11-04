/** Office share from an owner's rent at a given percentage (0–100). */
export function commissionAmount(rent: number, rate: number | null | undefined): number {
  if (!rate || rate <= 0 || !Number.isFinite(rent) || rent <= 0) return 0;
  return Math.round(rent * rate) / 100;
}

/** Parse a user-entered percentage; returns null when empty, throws when out of range. */
export function parseCommissionRate(input: string): number | null {
  const s = input.trim().replace(",", ".").replace("%", "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error("النسبة يجب أن تكون بين 0 و 100");
  return n;
}
