import { describe, it, expect } from "vitest";
import { parseEjarContract } from "./ejar-parser";

describe("جدول الدفعات: الاستحقاق ونهاية المهلة", () => {
  it("يأخذ الأقدم كتاريخ استحقاق والأحدث كنهاية مهلة حتى لو انعكسا في النص", () => {
    const row = "1750.00   1448-04-19   1448-04-09   يوم   2026-09-30   2026-09-20   1";
    const p = parseEjarContract(`Rent Payments Schedule\n${row}`).payments[0]!;
    expect(p.due_date).toBe("2026-09-20");
    expect(p.deadline_date).toBe("2026-09-30");
  });
});
