import { expect, it } from "vitest";
import { nextRentFollowup } from "./rent-followup";
it("rent followups are exactly 30 days apart, not calendar months or 14 days", () => expect(nextRentFollowup("2026-10-30T13:00:00Z")).toBe("2026-11-29T13:00:00.000Z"));