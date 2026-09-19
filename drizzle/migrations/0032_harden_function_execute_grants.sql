-- منع استدعاء دوال التريجر مباشرة من واجهة البيانات العامة
REVOKE ALL ON FUNCTION public.attribute_marketing_request() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_business_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_marketing_lead_from_request() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_buildings(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_buildings(text, text, integer) TO anon, authenticated, service_role;
