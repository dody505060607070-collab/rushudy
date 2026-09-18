-- توسعة بوابة المالك: مدفوعات، رسائل، إشعارات، تفضيلات، مشاركة، اعتمادات، تقارير حالة، زيارات، توقيع، سجل دخول

ALTER TABLE public.unit_documents ADD COLUMN IF NOT EXISTS expires_at DATE;
ALTER TABLE public.owner_requests ADD COLUMN IF NOT EXISTS staff_note TEXT;

CREATE TABLE IF NOT EXISTS public.owner_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'bank',
  iban_last4 TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','approved','transferred','rejected')),
  staff_note TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_payout_requests TO authenticated;
GRANT ALL ON public.owner_payout_requests TO service_role;
ALTER TABLE public.owner_payout_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage payout requests" ON public.owner_payout_requests FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.owner_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  sender TEXT NOT NULL DEFAULT 'owner' CHECK (sender IN ('owner','staff')),
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS owner_messages_owner_idx ON public.owner_messages (owner_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_messages TO authenticated;
GRANT ALL ON public.owner_messages TO service_role;
ALTER TABLE public.owner_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage owner messages" ON public.owner_messages FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.owner_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS owner_notifications_owner_idx ON public.owner_notifications (owner_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_notifications TO authenticated;
GRANT ALL ON public.owner_notifications TO service_role;
ALTER TABLE public.owner_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage owner notifications" ON public.owner_notifications FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.owner_preferences (
  owner_id UUID PRIMARY KEY REFERENCES public.contacts(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'ar',
  currency TEXT NOT NULL DEFAULT 'SAR',
  report_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (report_frequency IN ('none','monthly','quarterly','yearly')),
  expense_approval_limit NUMERIC(14,2) NOT NULL DEFAULT 1000,
  notify_whatsapp BOOLEAN NOT NULL DEFAULT true,
  notify_email BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_preferences TO authenticated;
GRANT ALL ON public.owner_preferences TO service_role;
ALTER TABLE public.owner_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage owner preferences" ON public.owner_preferences FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.owner_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  label TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_share_links TO authenticated;
GRANT ALL ON public.owner_share_links TO service_role;
ALTER TABLE public.owner_share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage owner share links" ON public.owner_share_links FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.owner_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'expense' CHECK (kind IN ('expense','tenant','renewal','other')),
  title TEXT NOT NULL,
  details TEXT,
  amount NUMERIC(14,2),
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  decision_note TEXT,
  decided_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS owner_approvals_owner_idx ON public.owner_approvals (owner_id, status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_approvals TO authenticated;
GRANT ALL ON public.owner_approvals TO service_role;
ALTER TABLE public.owner_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage owner approvals" ON public.owner_approvals FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.unit_condition_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'periodic' CHECK (kind IN ('move_in','move_out','periodic')),
  summary TEXT,
  images TEXT[] NOT NULL DEFAULT '{}',
  reported_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_condition_reports TO authenticated;
GRANT ALL ON public.unit_condition_reports TO service_role;
ALTER TABLE public.unit_condition_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage condition reports" ON public.unit_condition_reports FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.unit_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  visitor_name TEXT NOT NULL,
  visitor_phone TEXT,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT,
  feedback TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS unit_visits_owner_idx ON public.unit_visits (owner_id, visit_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_visits TO authenticated;
GRANT ALL ON public.unit_visits TO service_role;
ALTER TABLE public.unit_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage unit visits" ON public.unit_visits FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.owner_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.unit_documents(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  doc_title TEXT NOT NULL,
  signer_name TEXT NOT NULL,
  otp_code TEXT,
  otp_expires_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  signature_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','signed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_signatures TO authenticated;
GRANT ALL ON public.owner_signatures TO service_role;
ALTER TABLE public.owner_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage owner signatures" ON public.owner_signatures FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.owner_login_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  user_agent TEXT,
  path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS owner_login_events_owner_idx ON public.owner_login_events (owner_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_login_events TO authenticated;
GRANT ALL ON public.owner_login_events TO service_role;
ALTER TABLE public.owner_login_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage owner login events" ON public.owner_login_events FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));