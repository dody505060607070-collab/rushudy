CREATE TABLE public.service_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  description text,
  whatsapp_number text,
  email text,
  image_key text,
  video_urls text[] NOT NULL DEFAULT '{}',
  services text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_partners TO authenticated;
GRANT ALL ON public.service_partners TO service_role;
ALTER TABLE public.service_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users view active service partners" ON public.service_partners FOR SELECT TO authenticated USING (is_active OR public.is_staff(auth.uid()));
CREATE POLICY "Staff manage service partners" ON public.service_partners FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.service_partner_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.service_partners(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE,
  login_email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(partner_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_partner_accounts TO authenticated;
GRANT ALL ON public.service_partner_accounts TO service_role;
ALTER TABLE public.service_partner_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partners view own account" ON public.service_partner_accounts FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Staff manage partner accounts" ON public.service_partner_accounts FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.current_service_partner_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT partner_id FROM public.service_partner_accounts WHERE user_id = auth.uid() LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.current_service_partner_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_service_partner_id() TO authenticated, service_role;

CREATE TABLE public.service_partner_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE DEFAULT ('SR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  partner_id uuid NOT NULL REFERENCES public.service_partners(id) ON DELETE RESTRICT,
  requester_user_id uuid NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_identity text,
  address text NOT NULL,
  service_type text NOT NULL,
  details text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','accepted','in_progress','completed','cancelled')),
  partner_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_partner_requests TO authenticated;
GRANT ALL ON public.service_partner_requests TO service_role;
ALTER TABLE public.service_partner_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients create own service requests" ON public.service_partner_requests FOR INSERT TO authenticated WITH CHECK (requester_user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.client_accounts ca WHERE ca.user_id = auth.uid()));
CREATE POLICY "Clients view own service requests" ON public.service_partner_requests FOR SELECT TO authenticated USING (requester_user_id = auth.uid());
CREATE POLICY "Partners view assigned requests" ON public.service_partner_requests FOR SELECT TO authenticated USING (partner_id = public.current_service_partner_id());
CREATE POLICY "Partners update assigned requests" ON public.service_partner_requests FOR UPDATE TO authenticated USING (partner_id = public.current_service_partner_id()) WITH CHECK (partner_id = public.current_service_partner_id());
CREATE POLICY "Staff manage service requests" ON public.service_partner_requests FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.service_partner_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE DEFAULT ('SPI-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  request_id uuid NOT NULL REFERENCES public.service_partner_requests(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.service_partners(id) ON DELETE RESTRICT,
  customer_user_id uuid NOT NULL,
  amount numeric(14,2),
  description text,
  image_path text,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('draft','issued','paid','cancelled')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_partner_invoices TO authenticated;
GRANT ALL ON public.service_partner_invoices TO service_role;
ALTER TABLE public.service_partner_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients view own partner invoices" ON public.service_partner_invoices FOR SELECT TO authenticated USING (customer_user_id = auth.uid());
CREATE POLICY "Partners view own invoices" ON public.service_partner_invoices FOR SELECT TO authenticated USING (partner_id = public.current_service_partner_id());
CREATE POLICY "Partners create own invoices" ON public.service_partner_invoices FOR INSERT TO authenticated WITH CHECK (partner_id = public.current_service_partner_id() AND EXISTS (SELECT 1 FROM public.service_partner_requests r WHERE r.id = request_id AND r.partner_id = public.current_service_partner_id() AND r.requester_user_id = customer_user_id));
CREATE POLICY "Partners update own invoices" ON public.service_partner_invoices FOR UPDATE TO authenticated USING (partner_id = public.current_service_partner_id()) WITH CHECK (partner_id = public.current_service_partner_id());
CREATE POLICY "Staff manage partner invoices" ON public.service_partner_invoices FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.property_deal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('rent','sale','available')),
  employee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  amount numeric(14,2),
  event_date date NOT NULL DEFAULT current_date,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_deal_events TO authenticated;
GRANT ALL ON public.property_deal_events TO service_role;
ALTER TABLE public.property_deal_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view property deal events" ON public.property_deal_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff create property deal events" ON public.property_deal_events FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Staff update property deal events" ON public.property_deal_events FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff delete property deal events" ON public.property_deal_events FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.record_property_status_change(
  _property_id uuid,
  _status text,
  _employee_id uuid DEFAULT NULL,
  _contact_id uuid DEFAULT NULL,
  _amount numeric DEFAULT NULL,
  _event_date date DEFAULT current_date,
  _notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _unit_id uuid; _event_id uuid; _event_type text;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _status NOT IN ('available','rented','sold') THEN RAISE EXCEPTION 'INVALID_STATUS'; END IF;
  SELECT u.id INTO _unit_id FROM public.units u WHERE u.property_id = _property_id LIMIT 1;
  UPDATE public.properties SET status = _status WHERE id = _property_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROPERTY_NOT_FOUND'; END IF;
  IF _unit_id IS NOT NULL THEN UPDATE public.units SET status = _status WHERE id = _unit_id; END IF;
  _event_type := CASE _status WHEN 'rented' THEN 'rent' WHEN 'sold' THEN 'sale' ELSE 'available' END;
  INSERT INTO public.property_deal_events(property_id, unit_id, event_type, employee_id, contact_id, amount, event_date, notes, created_by)
  VALUES (_property_id, _unit_id, _event_type, _employee_id, _contact_id, _amount, coalesce(_event_date,current_date), nullif(btrim(_notes),''), auth.uid())
  RETURNING id INTO _event_id;
  RETURN _event_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_property_status_change(uuid,text,uuid,uuid,numeric,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_property_status_change(uuid,text,uuid,uuid,numeric,date,text) TO authenticated, service_role;

CREATE TRIGGER service_partners_updated BEFORE UPDATE ON public.service_partners FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER service_partner_requests_updated BEFORE UPDATE ON public.service_partner_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER service_partner_invoices_updated BEFORE UPDATE ON public.service_partner_invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX service_partner_requests_partner_status_idx ON public.service_partner_requests(partner_id, status, created_at DESC);
CREATE INDEX service_partner_requests_requester_idx ON public.service_partner_requests(requester_user_id, created_at DESC);
CREATE INDEX service_partner_invoices_partner_idx ON public.service_partner_invoices(partner_id, issued_at DESC);
CREATE INDEX service_partner_invoices_customer_idx ON public.service_partner_invoices(customer_user_id, issued_at DESC);
CREATE INDEX property_deal_events_employee_date_idx ON public.property_deal_events(employee_id, event_date);

CREATE OR REPLACE FUNCTION public.get_public_properties(_purpose text DEFAULT NULL::text, _code text DEFAULT NULL::text, _limit integer DEFAULT 60)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(result_row) ORDER BY result_row.is_featured DESC, result_row.sort_order ASC, result_row.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT p.id, p.code, p.name, p.purpose, p.rent_period, p.property_type, p.city, p.district,
      p.price_text, p.price_value, p.description, p.is_featured, p.sort_order, p.map_url,
      p.latitude, p.longitude, p.whatsapp_number, p.link_youtube, p.link_tiktok,
      p.link_instagram, p.link_snapchat, p.link_x, p.link_facebook, p.link_tour, p.created_at,
      p.floor, p.building_id, p.status,
      (SELECT b.code FROM public.buildings b WHERE b.id = p.building_id AND b.is_visible) AS building_code,
      (SELECT b.name FROM public.buildings b WHERE b.id = p.building_id AND b.is_visible) AS building_name,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('url', pi.url, 'is_cover', pi.is_cover, 'sort_order', pi.sort_order, 'focal_x', pi.focal_x, 'focal_y', pi.focal_y) ORDER BY pi.is_cover DESC, pi.sort_order ASC) FROM public.property_images pi WHERE pi.property_id = p.id), '[]'::jsonb) AS property_images
    FROM public.properties p
    WHERE p.is_visible AND p.status <> 'archived'
      AND (_purpose IS NULL OR p.purpose = _purpose)
      AND (_code IS NULL OR p.code = _code)
    ORDER BY p.is_featured DESC, p.sort_order ASC, p.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(_limit, 60), 1), 100)
  ) AS result_row;
$$;
REVOKE ALL ON FUNCTION public.get_public_properties(text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_properties(text,text,integer) TO anon, authenticated, service_role;