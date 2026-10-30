import { expect, it } from "vitest";
import { notificationLink } from "./notification-link";
it("old owner request alerts open request history", () => expect(notificationLink({ title: "طلب جديد من مالك", link: "/owners" })).toBe("/requests"));
it("preserves exact request links", () => expect(notificationLink({ title: "طلب", link: "/requests/owner/123" })).toBe("/requests/owner/123"));
it("never opens an external link", () => expect(notificationLink({ title: "تنبيه", link: "//example.com" })).toBe("/notifications"));