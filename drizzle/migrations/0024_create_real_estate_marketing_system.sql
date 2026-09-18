CREATE TABLE public.marketers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  referral_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  specialty text,
  regions text[] NOT NULL DEFAULT '{}',
  commission_type text NOT NULL DEFAULT 'office_commission_percent' CHECK (commission_type IN ('fixed','office_commission_percent','deal_percent')),
  commission_value numeric(12,2) NOT NULL DEFAULT 0 CHECK (commission_value >= 0),
  attribution_days integer NOT NULL DEFAULT 30 CHECK (attribution_days BETWEEN 1 AND 365),
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketers TO authenticated;
GRANT ALL ON public.marketers TO service_role;
ALTER TABLE public.marketers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketing staff view marketers" ON public.marketers FOR SELECT TO authenticated USING (public.has_perm(auth.uid(), 'marketing', 'view'));
CREATE POLICY "marketing staff create marketers" ON public.marketers FOR INSERT TO authenticated WITH CHECK (public.has_perm(auth.uid(), 'marketing', 'add'));
CREATE POLICY "marketing staff edit marketers" ON public.marketers FOR UPDATE TO authenticated USING (public.has_perm(auth.uid(), 'marketing', 'edit')) WITH CHECK (public.has_perm(auth.uid(), 'marketing', 'edit'));
CREATE POLICY "marketing staff delete marketers" ON public.marketers FOR DELETE TO authenticated USING (public.has_perm(auth.uid(), 'marketing', 'delete'));

CREATE TABLE public.marketer_referral_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketer_id uuid NOT NULL REFERENCES public.marketers(id) ON DELETE CASCADE,
  visitor_id text NOT NULL CHECK (char_length(visitor_id) BETWEEN 8 AND 80),
  landing_path text NOT NULL CHECK (char_length(landing_path) BETWEEN 1 AND 500),
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  referrer_host text,
  visited_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketer_referral_visits TO authenticated;
GRANT ALL ON public.marketer_referral_visits TO service_role;
ALTER TABLE public.marketer_referral_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketing staff view referral visits" ON public.marketer_referral_visits FOR SELECT TO authenticated USING (public.has_perm(auth.uid(), 'marketing', 'view'));

CREATE TABLE public.marketer_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketer_id uuid NOT NULL REFERENCES public.marketers(id) ON DELETE RESTRICT,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  listing_request_id uuid REFERENCES public.listing_requests(id) ON DELETE SET NULL,
  supply_request_id uuid REFERENCES public.supply_requests(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  customer_name text,
  customer_phone text,
  source text NOT NULL DEFAULT 'referral_link',
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','viewing','negotiation','won','lost')),
  estimated_value numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  attributed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (listing_request_id IS NOT NULL OR supply_request_id IS NOT NULL OR contact_id IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketer_leads TO authenticated;
GRANT ALL ON public.marketer_leads TO service_role;
ALTER TABLE public.marketer_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketing staff view leads" ON public.marketer_leads FOR SELECT TO authenticated USING (public.has_perm(auth.uid(), 'marketing', 'view'));
CREATE POLICY "marketing staff create leads" ON public.marketer_leads FOR INSERT TO authenticated WITH CHECK (public.has_perm(auth.uid(), 'marketing', 'add'));
CREATE POLICY "marketing staff edit leads" ON public.marketer_leads FOR UPDATE TO authenticated USING (public.has_perm(auth.uid(), 'marketing', 'edit')) WITH CHECK (public.has_perm(auth.uid(), 'marketing', 'edit'));
CREATE POLICY "marketing staff delete leads" ON public.marketer_leads FOR DELETE TO authenticated USING (public.has_perm(auth.uid(), 'marketing', 'delete'));

CREATE TABLE public.marketer_property_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketer_id uuid NOT NULL REFERENCES public.marketers(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','copy_link','other')),
  sent_to text,
  sent_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.marketer_property_shares TO authenticated;
GRANT ALL ON public.marketer_property_shares TO service_role;
ALTER TABLE public.marketer_property_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketing staff view property shares" ON public.marketer_property_shares FOR SELECT TO authenticated USING (public.has_perm(auth.uid(), 'marketing', 'view'));
CREATE POLICY "marketing staff create property shares" ON public.marketer_property_shares FOR INSERT TO authenticated WITH CHECK (public.has_perm(auth.uid(), 'marketing', 'send'));
CREATE POLICY "marketing staff delete property shares" ON public.marketer_property_shares FOR DELETE TO authenticated USING (public.has_perm(auth.uid(), 'marketing', 'delete'));

CREATE TABLE public.marketer_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketer_id uuid NOT NULL REFERENCES public.marketers(id) ON DELETE RESTRICT,
  lead_id uuid REFERENCES public.marketer_leads(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  basis_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (basis_amount >= 0),
  status text NOT NULL DEFAULT 'expected' CHECK (status IN ('expected','due','approved','paid','cancelled')),
  due_date date,
  paid_at timestamptz,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketer_commissions TO authenticated;
GRANT ALL ON public.marketer_commissions TO service_role;
ALTER TABLE public.marketer_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketing staff view commissions" ON public.marketer_commissions FOR SELECT TO authenticated USING (public.has_perm(auth.uid(), 'marketing', 'view'));
CREATE POLICY "marketing staff create commissions" ON public.marketer_commissions FOR INSERT TO authenticated WITH CHECK (public.has_perm(auth.uid(), 'marketing', 'add'));
CREATE POLICY "marketing staff edit commissions" ON public.marketer_commissions FOR UPDATE TO authenticated USING (public.has_perm(auth.uid(), 'marketing', 'edit')) WITH CHECK (public.has_perm(auth.uid(), 'marketing', 'edit'));
CREATE POLICY "marketing staff delete commissions" ON public.marketer_commissions FOR DELETE TO authenticated USING (public.has_perm(auth.uid(), 'marketing', 'delete'));

ALTER TABLE public.listing_requests ADD COLUMN marketer_id uuid REFERENCES public.marketers(id) ON DELETE SET NULL;
ALTER TABLE public.listing_requests ADD COLUMN referral_code text;
ALTER TABLE public.supply_requests ADD COLUMN marketer_id uuid REFERENCES public.marketers(id) ON DELETE SET NULL;
ALTER TABLE public.supply_requests ADD COLUMN referral_code text;

CREATE OR REPLACE FUNCTION public.record_marketer_referral(_referral_code text, _visitor_id text, _landing_path text, _property_code text DEFAULT NULL, _referrer_host text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_marketer public.marketers;
  selected_property_id uuid;
BEGIN
  IF char_length(coalesce(_visitor_id, '')) NOT BETWEEN 8 AND 80 OR char_length(coalesce(_landing_path, '')) NOT BETWEEN 1 AND 500 THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  SELECT * INTO selected_marketer FROM public.marketers WHERE referral_code = lower(btrim(_referral_code)) AND status = 'active' LIMIT 1;
  IF selected_marketer.id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  IF _property_code IS NOT NULL THEN SELECT id INTO selected_property_id FROM public.properties WHERE code = _property_code AND is_visible LIMIT 1; END IF;
  INSERT INTO public.marketer_referral_visits(marketer_id, visitor_id, landing_path, property_id, referrer_host)
  SELECT selected_marketer.id, left(_visitor_id, 80), left(_landing_path, 500), selected_property_id, nullif(left(coalesce(_referrer_host,''), 255), '')
  WHERE NOT EXISTS (
    SELECT 1 FROM public.marketer_referral_visits v
    WHERE v.marketer_id = selected_marketer.id AND v.visitor_id = _visitor_id AND v.landing_path = _landing_path AND v.visited_at > now() - interval '30 minutes'
  );
  RETURN jsonb_build_object('ok', true, 'marketer_id', selected_marketer.id, 'code', selected_marketer.referral_code, 'days', selected_marketer.attribution_days);
END;
$$;
REVOKE ALL ON FUNCTION public.record_marketer_referral(text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_marketer_referral(text,text,text,text,text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.attribute_marketing_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE selected_marketer public.marketers; existing_lead uuid;
BEGIN
  IF NEW.referral_code IS NULL OR btrim(NEW.referral_code) = '' THEN RETURN NEW; END IF;
  SELECT * INTO selected_marketer FROM public.marketers WHERE referral_code = lower(btrim(NEW.referral_code)) AND status = 'active' LIMIT 1;
  IF selected_marketer.id IS NULL THEN NEW.marketer_id := NULL; NEW.referral_code := NULL; RETURN NEW; END IF;
  NEW.marketer_id := selected_marketer.id;
  NEW.referral_code := selected_marketer.referral_code;
  RETURN NEW;
END;
$$;

CREATE TRIGGER listing_request_marketer_attribution BEFORE INSERT OR UPDATE OF referral_code ON public.listing_requests FOR EACH ROW EXECUTE FUNCTION public.attribute_marketing_request();
CREATE TRIGGER supply_request_marketer_attribution BEFORE INSERT OR UPDATE OF referral_code ON public.supply_requests FOR EACH ROW EXECUTE FUNCTION public.attribute_marketing_request();

CREATE OR REPLACE FUNCTION public.create_marketing_lead_from_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.marketer_id IS NULL THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'listing_requests' THEN
    INSERT INTO public.marketer_leads(marketer_id, listing_request_id, contact_id, customer_name, customer_phone, source)
    VALUES (NEW.marketer_id, NEW.id, NEW.contact_id, NEW.full_name, NEW.phone, 'listing_request');
  ELSE
    INSERT INTO public.marketer_leads(marketer_id, supply_request_id, contact_id, customer_name, customer_phone, source)
    VALUES (NEW.marketer_id, NEW.id, NEW.contact_id, NEW.full_name, NEW.phone, 'supply_request');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER listing_request_create_marketing_lead AFTER INSERT ON public.listing_requests FOR EACH ROW EXECUTE FUNCTION public.create_marketing_lead_from_request();
CREATE TRIGGER supply_request_create_marketing_lead AFTER INSERT ON public.supply_requests FOR EACH ROW EXECUTE FUNCTION public.create_marketing_lead_from_request();

CREATE TRIGGER marketers_updated BEFORE UPDATE ON public.marketers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER marketer_leads_updated BEFORE UPDATE ON public.marketer_leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER marketer_commissions_updated BEFORE UPDATE ON public.marketer_commissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX marketers_status_idx ON public.marketers(status);
CREATE INDEX marketer_referral_visits_marketer_date_idx ON public.marketer_referral_visits(marketer_id, visited_at DESC);
CREATE INDEX marketer_leads_marketer_status_idx ON public.marketer_leads(marketer_id, status, attributed_at DESC);
CREATE INDEX marketer_leads_phone_idx ON public.marketer_leads(customer_phone);
CREATE UNIQUE INDEX marketer_leads_listing_unique ON public.marketer_leads(listing_request_id) WHERE listing_request_id IS NOT NULL;
CREATE UNIQUE INDEX marketer_leads_supply_unique ON public.marketer_leads(supply_request_id) WHERE supply_request_id IS NOT NULL;
CREATE INDEX marketer_property_shares_marketer_date_idx ON public.marketer_property_shares(marketer_id, sent_at DESC);
CREATE INDEX marketer_commissions_marketer_status_idx ON public.marketer_commissions(marketer_id, status, created_at DESC);
CREATE INDEX listing_requests_marketer_idx ON public.listing_requests(marketer_id) WHERE marketer_id IS NOT NULL;
CREATE INDEX supply_requests_marketer_idx ON public.supply_requests(marketer_id) WHERE marketer_id IS NOT NULL;