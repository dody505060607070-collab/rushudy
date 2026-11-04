import { describe, expect, it } from "vitest";
import { commissionAmount, parseCommissionRate } from "./owner-commission";

describe("owner commission", () => {
  it("5% of 100000 is 5000", () => expect(commissionAmount(100000, 5)).toBe(5000));
  it("20% of 45000 is 9000", () => expect(commissionAmount(45000, 20)).toBe(9000));
  it("no rate means zero", () => expect(commissionAmount(50000, null)).toBe(0));
  it("rejects rate above 100", () => expect(() => parseCommissionRate("120")).toThrow());
  it("accepts 10%", () => expect(parseCommissionRate("10%")).toBe(10));
});

import { commissionBreakdown, roundHalfRiyal } from "./owner-commission";
describe("commission breakdown", () => {
  it("rounds to half riyal", () => expect(roundHalfRiyal(12.3)).toBe(12.5));
  it("10% of 30000 rent with 15000 collected", () => {
    const b = commissionBreakdown(30000, 15000, 10);
    expect(b.officeExpected).toBe(3000);
    expect(b.officeCollected).toBe(1500);
    expect(b.ownerCollected).toBe(13500);
    expect(b.remaining).toBe(15000);
  });
  it("7.5% of 12345 is 926 (half riyal)", () => expect(commissionBreakdown(12345, 0, 7.5).officeExpected).toBe(926));
});
