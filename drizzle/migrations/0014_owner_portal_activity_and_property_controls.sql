CREATE TABLE public.employee_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  current_path text,
  device_label text,
  duration_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.employee_sessions TO authenticated;
GRANT ALL ON public.employee_sessions TO service_role;
ALTER TABLE public.employee_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admins view employee sessions" ON public.employee_sessions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "users view own sessions" ON public.employee_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users open own sessions" ON public.employee_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users update own sessions" ON public.employee_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX employee_sessions_user_started_idx ON public.employee_sessions(user_id, started_at DESC);
CREATE INDEX employee_sessions_active_idx ON public.employee_sessions(last_seen_at DESC) WHERE ended_at IS NULL;

ALTER TABLE public.property_images ADD COLUMN IF NOT EXISTS focal_x numeric NOT NULL DEFAULT 50;
ALTER TABLE public.property_images ADD COLUMN IF NOT EXISTS focal_y numeric NOT NULL DEFAULT 50;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS district_id uuid REFERENCES public.districts(id) ON DELETE SET NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS property_type_id uuid REFERENCES public.property_types(id) ON DELETE SET NULL;
UPDATE public.properties p SET city_id = c.id FROM public.cities c WHERE p.city_id IS NULL AND lower(trim(p.city)) = lower(trim(c.name));
UPDATE public.properties p SET district_id = d.id FROM public.districts d WHERE p.district_id IS NULL AND lower(trim(p.district)) = lower(trim(d.name));
UPDATE public.properties p SET property_type_id = t.id FROM public.property_types t WHERE p.property_type_id IS NULL AND lower(trim(p.property_type)) = lower(trim(t.name));
CREATE INDEX properties_city_id_idx ON public.properties(city_id);
CREATE INDEX properties_district_id_idx ON public.properties(district_id);
CREATE INDEX properties_type_id_idx ON public.properties(property_type_id);

CREATE OR REPLACE FUNCTION public.current_owner_contact_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ca.contact_id FROM public.client_accounts ca
  JOIN public.user_roles ur ON ur.user_id = ca.user_id AND ur.role = 'owner'
  WHERE ca.user_id = auth.uid()
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.current_owner_contact_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_owner_contact_id() TO authenticated;

CREATE POLICY "owners view own contact" ON public.contacts FOR SELECT TO authenticated USING (id = public.current_owner_contact_id());
CREATE POLICY "owners view their tenants" ON public.contacts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.contracts c WHERE c.owner_id = public.current_owner_contact_id() AND c.tenant_id = contacts.id));
CREATE POLICY "owners view own buildings" ON public.buildings FOR SELECT TO authenticated USING (owner_id = public.current_owner_contact_id());
CREATE POLICY "owners view own units" ON public.units FOR SELECT TO authenticated USING (owner_id = public.current_owner_contact_id());
CREATE POLICY "owners view own properties" ON public.properties FOR SELECT TO authenticated USING (owner_id = public.current_owner_contact_id());
CREATE POLICY "owners view own contracts" ON public.contracts FOR SELECT TO authenticated USING (owner_id = public.current_owner_contact_id());
CREATE POLICY "owners view own contract payments" ON public.contract_payments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = contract_payments.contract_id AND c.owner_id = public.current_owner_contact_id()));
CREATE POLICY "owners view own invoices" ON public.invoices FOR SELECT TO authenticated USING (contact_id = public.current_owner_contact_id() OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = invoices.contract_id AND c.owner_id = public.current_owner_contact_id()));
CREATE POLICY "owners view own invoice items" ON public.invoice_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_items.invoice_id AND (i.contact_id = public.current_owner_contact_id() OR EXISTS (SELECT 1 FROM public.contracts c WHERE c.id = i.contract_id AND c.owner_id = public.current_owner_contact_id()))));

CREATE OR REPLACE FUNCTION public.touch_employee_session(_session_id uuid, _path text, _device text DEFAULT NULL)
RETURNS public.employee_sessions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE result public.employee_sessions;
BEGIN
  UPDATE public.employee_sessions
  SET last_seen_at = now(), current_path = left(_path, 300), device_label = coalesce(left(_device, 180), device_label), duration_seconds = greatest(0, extract(epoch FROM now() - started_at)::integer)
  WHERE id = _session_id AND user_id = auth.uid() AND ended_at IS NULL
  RETURNING * INTO result;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.touch_employee_session(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.close_employee_session(_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.employee_sessions SET ended_at = now(), last_seen_at = now(), duration_seconds = greatest(0, extract(epoch FROM now() - started_at)::integer)
  WHERE id = _session_id AND user_id = auth.uid() AND ended_at IS NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.close_employee_session(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.audit_business_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE actor uuid := auth.uid(); row_id uuid; payload jsonb;
BEGIN
  IF actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = actor) THEN RETURN coalesce(NEW, OLD); END IF;
  row_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  payload := jsonb_build_object('table', TG_TABLE_NAME, 'operation', lower(TG_OP));
  IF TG_OP = 'UPDATE' THEN payload := payload || jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW)); END IF;
  INSERT INTO public.activity_log(actor_id, action, entity_type, entity_id, details)
  VALUES (actor, lower(TG_OP), TG_TABLE_NAME, row_id, payload);
  RETURN coalesce(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_properties AFTER INSERT OR UPDATE OR DELETE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
CREATE TRIGGER audit_buildings AFTER INSERT OR UPDATE OR DELETE ON public.buildings FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
CREATE TRIGGER audit_units AFTER INSERT OR UPDATE OR DELETE ON public.units FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
CREATE TRIGGER audit_contracts AFTER INSERT OR UPDATE OR DELETE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
CREATE TRIGGER audit_tasks AFTER INSERT OR UPDATE OR DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
CREATE TRIGGER audit_contacts AFTER INSERT OR UPDATE OR DELETE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
CREATE TRIGGER audit_invoices AFTER INSERT OR UPDATE OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();
CREATE TRIGGER audit_payments AFTER INSERT OR UPDATE OR DELETE ON public.contract_payments FOR EACH ROW EXECUTE FUNCTION public.audit_business_change();