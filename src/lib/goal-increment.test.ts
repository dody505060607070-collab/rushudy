import { expect, it } from "vitest";
import { incrementAchievement } from "./goal-increment";
it("adding one then two to four preserves the previous achievement", () => expect(incrementAchievement(incrementAchievement(4, 1), 2)).toBe(7));
it("adding four repeatedly accumulates", () => expect(incrementAchievement(incrementAchievement(4, 4), 4)).toBe(12));
it("zero cannot reset achievement", () => expect(() => incrementAchievement(4, 0)).toThrow());