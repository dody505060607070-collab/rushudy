DROP POLICY IF EXISTS "public submit supply request" ON public.supply_requests;
CREATE POLICY "public submit supply request" ON public.supply_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "public submit listing request" ON public.listing_requests;
CREATE POLICY "public submit listing request" ON public.listing_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "public submit maintenance" ON public.maintenance_requests;
CREATE POLICY "public submit maintenance" ON public.maintenance_requests FOR INSERT TO anon, authenticated WITH CHECK ((status = 'new') AND (technician_name IS NULL) AND (internal_notes IS NULL) AND (cost = 0) AND (created_by IS NULL));
DELETE FROM public.supply_requests WHERE full_name='اختبار نظام' AND phone='0500000000';