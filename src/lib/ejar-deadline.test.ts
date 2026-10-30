import { describe, it, expect } from "vitest";
import { orderPaymentDates } from "./ejar-parser";

describe("جدول الدفعات: الاستحقاق ونهاية المهلة", () => {
  it("نهاية المهلة لا تُحفظ كتاريخ استحقاق حتى لو جاءت أولًا", () => {
    expect(orderPaymentDates("2026-09-30", "2026-09-20")).toEqual(["2026-09-20", "2026-09-30"]);
  });
  it("الترتيب الصحيح يبقى كما هو", () => {
    expect(orderPaymentDates("2027-03-20", "2027-03-30")).toEqual(["2027-03-20", "2027-03-30"]);
  });
});
