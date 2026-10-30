import { describe, expect, it } from "vitest";
import { taskTransition } from "./task-workflow";

describe("task review", () => {
  it("employee completion waits for approval", () => expect(taskTransition("in_progress", "submit", false, true)).toBe("submitted"));
  it("only super admin approves", () => expect(() => taskTransition("submitted", "approve", false, true)).toThrow());
  it("approval completes the task", () => expect(taskTransition("submitted", "approve", true, false)).toBe("approved"));
  it("return puts the task back in progress", () => expect(taskTransition("submitted", "return", true, false)).toBe("in_progress"));
  it("unassigned employee cannot submit", () => expect(() => taskTransition("new", "submit", false, false)).toThrow());
});