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

/** Round to the nearest half riyal (0.5 SAR). */
export function roundHalfRiyal(n: number): number {
  return Math.round(n * 2) / 2;
}

export type CommissionBreakdown = {
  rent: number;
  collected: number;
  remaining: number;
  officeExpected: number;
  officeCollected: number;
  ownerExpected: number;
  ownerCollected: number;
};

/** Full split of rent between office and owner, rounded to the half riyal. */
export function commissionBreakdown(rent: number, collected: number, rate: number | null | undefined): CommissionBreakdown {
  const r = rate && rate > 0 ? rate : 0;
  const officeExpected = roundHalfRiyal((rent * r) / 100);
  const officeCollected = roundHalfRiyal((collected * r) / 100);
  return {
    rent,
    collected,
    remaining: Math.max(rent - collected, 0),
    officeExpected,
    officeCollected,
    ownerExpected: roundHalfRiyal(rent - officeExpected),
    ownerCollected: roundHalfRiyal(collected - officeCollected),
  };
}
