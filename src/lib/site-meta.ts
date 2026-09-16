export const SITE_URL = "https://alrashudi.sa";
export const SITE_NAME = "الرشودي للعقارات";

export function absoluteSiteUrl(path = "/") {
  return new URL(path, SITE_URL).href;
}