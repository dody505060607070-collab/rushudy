import { describe, expect, it } from "vitest";
import { buildMeetingMessage, nextMeetingSend } from "./meeting-reminders";

const m = { title: "معاينة", property_name: "عمارة النخيل", meeting_at: "2026-11-05T15:00:00Z", owner_name: "فهد", visitor_name: "سالم", notes: "سري" };

describe("meeting reminders", () => {
  it("next reminder is 12 hours later", () => {
    expect(nextMeetingSend(new Date("2026-11-01T00:00:00Z"), 12, m.meeting_at)).toBe("2026-11-01T12:00:00.000Z");
  });
  it("stops after the meeting time", () => {
    expect(nextMeetingSend(new Date("2026-11-05T05:00:00Z"), 12, m.meeting_at)).toBeNull();
  });
  it("each person gets their own message; notes only to agent", () => {
    expect(buildMeetingMessage("visitor", m)).toContain("لا تنسَ موعد زيارة");
    expect(buildMeetingMessage("owner", m)).toContain("موعد معاينة عقارك");
    expect(buildMeetingMessage("owner", m)).not.toContain("سري");
    expect(buildMeetingMessage("agent", m)).toContain("سري");
  });
});
