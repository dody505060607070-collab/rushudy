-- طلبات المالك (صيانة، تجديد، تسويق وحدة شاغرة)
CREATE TABLE public.owner_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'maintenance',
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_requests TO authenticated;
GRANT ALL ON public.owner_requests TO service_role;
ALTER TABLE public.owner_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage owner requests" ON public.owner_requests FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "owner reads own requests" ON public.owner_requests FOR SELECT TO authenticated
  USING (owner_id = public.current_owner_contact_id());
CREATE POLICY "owner creates own requests" ON public.owner_requests FOR INSERT TO authenticated
  WITH CHECK (owner_id = public.current_owner_contact_id());

-- مصروفات الوحدات/العقارات لحساب صافي الدخل
CREATE TABLE public.unit_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'maintenance',
  description TEXT,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  spent_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_expenses TO authenticated;
GRANT ALL ON public.unit_expenses TO service_role;
ALTER TABLE public.unit_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage unit expenses" ON public.unit_expenses FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "owner manages own expenses" ON public.unit_expenses FOR ALL TO authenticated
  USING (owner_id = public.current_owner_contact_id())
  WITH CHECK (owner_id = public.current_owner_contact_id());

-- مرفقات الوحدة (صك، عداد، صور تسليم)
CREATE TABLE public.unit_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'other',
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_documents TO authenticated;
GRANT ALL ON public.unit_documents TO service_role;
ALTER TABLE public.unit_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage unit documents" ON public.unit_documents FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "owner manages own documents" ON public.unit_documents FOR ALL TO authenticated
  USING (owner_id = public.current_owner_contact_id())
  WITH CHECK (owner_id = public.current_owner_contact_id());

-- تفويض شخص آخر بصلاحية عرض أو تسجيل سداد
CREATE TABLE public.owner_delegates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  delegate_contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'view',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, delegate_contact_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_delegates TO authenticated;
GRANT ALL ON public.owner_delegates TO service_role;
ALTER TABLE public.owner_delegates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage owner delegates" ON public.owner_delegates FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "owner manages own delegates" ON public.owner_delegates FOR ALL TO authenticated
  USING (owner_id = public.current_owner_contact_id())
  WITH CHECK (owner_id = public.current_owner_contact_id());

CREATE INDEX idx_owner_requests_owner ON public.owner_requests(owner_id, created_at DESC);
CREATE INDEX idx_unit_expenses_owner ON public.unit_expenses(owner_id, spent_on DESC);
CREATE INDEX idx_unit_documents_owner ON public.unit_documents(owner_id, created_at DESC);
