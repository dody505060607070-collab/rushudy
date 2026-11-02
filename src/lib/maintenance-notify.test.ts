import { describe, expect, it } from "vitest";

import { buildMaintenanceMessage } from "./maintenance-notify";

describe("buildMaintenanceMessage", () => {
  it("names the tenant, place and unit so the office knows who sent it", () => {
    const text = buildMaintenanceMessage({
      reporterName: "محمد",
      reporterPhone: "0550000000",
      category: "plumbing",
      priority: "urgent",
      description: "تسريب ماء",
      place: "عمارة النخيل",
      unitNumber: "12",
    });
    expect(text).toContain("من: محمد");
    expect(text).toContain("المكان: عمارة النخيل — وحدة 12");
    expect(text).toContain("النوع: سباكة");
    expect(text).toContain("الأولوية: طارئة");
  });

  it("falls back to normal priority when unknown", () => {
    const text = buildMaintenanceMessage({
      reporterName: null, reporterPhone: null, category: null, priority: "x",
      description: "مشكلة", place: null, unitNumber: null,
    });
    expect(text).toContain("الأولوية: عادية");
    expect(text).not.toContain("المكان:");
  });
});
