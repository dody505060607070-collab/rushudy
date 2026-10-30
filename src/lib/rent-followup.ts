export const RENT_FOLLOWUP_DAYS = 30;
export const RENT_FOLLOWUP_MESSAGE = `السلام عليكم ورحمة الله وبركاته

عزيزنا المالك، تحية طيبة من مكتب الرشودي للعقارات.
نود متابعة مستجدات العقار المعروض للإيجار: هل لا يزال متاحًا؟ وما قيمة الإيجار المطلوبة حاليًا؟ وهل طرأت أي تغييرات على بياناته؟
نأمل تزويدنا بالتحديثات لنواصل تسويقه بدقة ومتابعة العملاء المهتمين.
شاكرين ثقتكم وتعاونكم، ونسعد دائمًا بخدمتكم.
مكتب الرشودي للعقارات`;
export function nextRentFollowup(from: string | Date) {
  return new Date(new Date(from).getTime() + RENT_FOLLOWUP_DAYS * 86400000).toISOString();
}