ALTER TABLE public.invoices
 ADD COLUMN building_id uuid REFERENCES public.buildings(id) ON DELETE SET NULL,
 ADD COLUMN property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
 ADD COLUMN unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
 ADD CONSTRAINT invoices_one_asset CHECK (num_nonnulls(building_id, property_id, unit_id) <= 1);