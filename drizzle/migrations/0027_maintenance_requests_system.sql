CREATE TABLE IF NOT EXISTS public.maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  reporter_name TEXT NOT NULL,
  reporter_phone TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  priority TEXT NOT NULL DEFAULT 'normal',
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  technician_name TEXT,
  technician_phone TEXT,
  scheduled_at TIMESTAMPTZ,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  before_images TEXT[] NOT NULL DEFAULT '{}',
  after_images TEXT[] NOT NULL DEFAULT '{}',
  rating INTEGER,
  internal_notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT maintenance_status_check CHECK (status IN ('new','assigned','in_progress','done','cancelled')),
  CONSTRAINT maintenance_priority_check CHECK (priority IN ('low','normal','high','urgent')),
  CONSTRAINT maintenance_rating_check CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5))
);

CREATE INDEX IF NOT EXISTS maintenance_requests_status_idx ON public.maintenance_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS maintenance_requests_property_idx ON public.maintenance_requests(property_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_requests TO authenticated;
GRANT INSERT ON public.maintenance_requests TO anon;
GRANT ALL ON public.maintenance_requests TO service_role;

ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read maintenance" ON public.maintenance_requests
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff write maintenance" ON public.maintenance_requests
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "staff update maintenance" ON public.maintenance_requests
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff delete maintenance" ON public.maintenance_requests
  FOR DELETE TO authenticated USING (true);
CREATE POLICY "public submit maintenance" ON public.maintenance_requests
  FOR INSERT TO anon WITH CHECK (
    status = 'new' AND technician_name IS NULL AND internal_notes IS NULL AND cost = 0 AND created_by IS NULL
  );

CREATE TRIGGER set_updated_at_maintenance_requests
  BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();