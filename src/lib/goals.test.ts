import { describe, expect, it } from "vitest";

import {
  effectiveAchieved,
  emptyAutoProgress,
  goalPoints,
  percentOf,
  remainingOf,
  type AutoProgress,
  type GoalRow,
} from "@/lib/goals";

function makeGoal(overrides: Partial<GoalRow> = {}): GoalRow {
  return {
    id: "g1",
    employee_id: "e1",
    period_month: "2025-01-01",
    goal_type: "rent",
    target_value: 50,
    achieved_value: 0,
    auto_track: true,
    points_per_unit: 100,
    notes: null,
    ...overrides,
  };
}

const auto: AutoProgress = { ...emptyAutoProgress, rent: 30, sale: 5, collection: 120000 };

describe("effectiveAchieved", () => {
  it("uses the system-computed value when auto_track is on and the type is tracked", () => {
    const goal = makeGoal({ goal_type: "rent", auto_track: true });
    expect(effectiveAchieved(goal, auto)).toBe(30);
  });

  it("falls back to the manual achieved_value when auto_track is off", () => {
    const goal = makeGoal({ goal_type: "rent", auto_track: false, achieved_value: 12 });
    expect(effectiveAchieved(goal, auto)).toBe(12);
  });

  it("uses the manual achieved_value for goal types the system cannot track (e.g. custom)", () => {
    const goal = makeGoal({ goal_type: "custom", auto_track: true, achieved_value: 7 });
    expect(effectiveAchieved(goal, auto)).toBe(7);
  });

  it("treats a missing achieved_value as zero", () => {
    const goal = makeGoal({ goal_type: "custom", auto_track: false, achieved_value: undefined as unknown as number });
    expect(effectiveAchieved(goal, auto)).toBe(0);
  });
});

describe("percentOf", () => {
  it("computes the exact percentage for a target of 50 and achieving 25", () => {
    expect(percentOf(25, 50)).toBe(50);
  });

  it("returns 0 when the target is 0 or missing (avoids division by zero)", () => {
    expect(percentOf(10, 0)).toBe(0);
  });

  it("caps the displayed percentage at 100 even when over-achieved", () => {
    expect(percentOf(80, 50)).toBe(100);
  });

  it("never returns a negative percentage", () => {
    expect(percentOf(-5, 50)).toBe(0);
  });

  it("rounds to the nearest whole number", () => {
    expect(percentOf(1, 3)).toBe(33);
  });
});

describe("remainingOf", () => {
  it("computes exactly how much is left for a target of 50", () => {
    expect(remainingOf(20, 50)).toBe(30);
  });

  it("never goes below zero once the target is exceeded", () => {
    expect(remainingOf(70, 50)).toBe(0);
  });

  it("equals the full target when nothing has been achieved", () => {
    expect(remainingOf(0, 50)).toBe(50);
  });
});

describe("goalPoints", () => {
  it("returns 0 when the target is 0 (no division by zero)", () => {
    const goal = makeGoal({ target_value: 0, points_per_unit: 100 });
    expect(goalPoints(goal, auto)).toBe(0);
  });

  it("gives full points at 100% achievement", () => {
    const goal = makeGoal({ goal_type: "rent", target_value: 30, points_per_unit: 100 });
    expect(goalPoints(goal, auto)).toBe(100);
  });

  it("gives proportional points below 100% achievement", () => {
    const goal = makeGoal({ goal_type: "rent", target_value: 60, points_per_unit: 100 });
    expect(goalPoints(goal, auto)).toBe(50);
  });

  it("caps points at 150% of points_per_unit for over-achievement", () => {
    const goal = makeGoal({ goal_type: "rent", target_value: 10, points_per_unit: 100 });
    // achieved (30) / target (10) = 300% but capped at 150%
    expect(goalPoints(goal, auto)).toBe(150);
  });

  it("uses manual achieved_value for points when auto_track is off", () => {
    const goal = makeGoal({ goal_type: "rent", auto_track: false, achieved_value: 15, target_value: 30, points_per_unit: 100 });
    expect(goalPoints(goal, auto)).toBe(50);
  });
});
