import { describe, expect, it } from "vitest";
import { commissionAmount, parseCommissionRate } from "./owner-commission";

describe("owner commission", () => {
  it("5% of 100000 is 5000", () => expect(commissionAmount(100000, 5)).toBe(5000));
  it("20% of 45000 is 9000", () => expect(commissionAmount(45000, 20)).toBe(9000));
  it("no rate means zero", () => expect(commissionAmount(50000, null)).toBe(0));
  it("rejects rate above 100", () => expect(() => parseCommissionRate("120")).toThrow());
  it("accepts 10%", () => expect(parseCommissionRate("10%")).toBe(10));
});
