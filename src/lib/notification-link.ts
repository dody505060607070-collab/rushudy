export function notificationLink(notification: { title: string; link: string | null }) {
  if (notification.title.includes("طلب") && (!notification.link || notification.link === "/owners")) return "/requests";
  const link = notification.link;
  return link?.startsWith("/") && !link.startsWith("//") ? link : "/notifications";
}