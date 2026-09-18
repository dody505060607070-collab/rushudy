CREATE TABLE public.owner_asset_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.owner_asset_section_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.owner_asset_sections(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('building','property','unit')),
  item_id UUID NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, item_type, item_id)
);

CREATE INDEX idx_owner_asset_sections_owner ON public.owner_asset_sections(owner_id);
CREATE INDEX idx_owner_asset_section_items_section ON public.owner_asset_section_items(section_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_asset_sections TO authenticated;
GRANT ALL ON public.owner_asset_sections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_asset_section_items TO authenticated;
GRANT ALL ON public.owner_asset_section_items TO service_role;

ALTER TABLE public.owner_asset_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_asset_section_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage owner sections" ON public.owner_asset_sections
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "owner reads own sections" ON public.owner_asset_sections
  FOR SELECT TO authenticated
  USING (owner_id = public.current_owner_contact_id());

CREATE POLICY "staff manage owner section items" ON public.owner_asset_section_items
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "owner reads own section items" ON public.owner_asset_section_items
  FOR SELECT TO authenticated
  USING (owner_id = public.current_owner_contact_id());
