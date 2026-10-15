CREATE OR REPLACE FUNCTION public.sync_unit_status_from_contract()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  live boolean;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.unit_id IS NOT DISTINCT FROM OLD.unit_id
     AND NEW.property_id IS NOT DISTINCT FROM OLD.property_id THEN
    RETURN NEW;
  END IF;

  -- عقد ساري أو منتهٍ والمستأجر ما زال ساكنًا = الوحدة مشغولة
  IF NEW.status IN ('active', 'holdover') THEN
    IF NEW.unit_id IS NOT NULL THEN
      UPDATE public.units SET status = 'rented' WHERE id = NEW.unit_id AND status IS DISTINCT FROM 'rented';
    END IF;
    IF NEW.property_id IS NOT NULL THEN
      UPDATE public.properties SET status = 'rented' WHERE id = NEW.property_id AND status IN ('available', 'reserved');
    END IF;
  -- عقد منتهٍ وخرج المستأجر = الوحدة شاغرة (إذا لم يوجد عقد آخر قائم عليها)
  ELSIF NEW.status IN ('expired', 'terminated') THEN
    IF NEW.unit_id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM public.contracts c WHERE c.unit_id = NEW.unit_id AND c.id <> NEW.id AND c.status IN ('active', 'holdover')) INTO live;
      IF NOT live THEN
        UPDATE public.units SET status = 'vacant' WHERE id = NEW.unit_id AND status = 'rented';
      END IF;
    END IF;
    IF NEW.property_id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM public.contracts c WHERE c.property_id = NEW.property_id AND c.id <> NEW.id AND c.status IN ('active', 'holdover')) INTO live;
      IF NOT live THEN
        UPDATE public.properties SET status = 'available' WHERE id = NEW.property_id AND status = 'rented';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS contracts_sync_unit_status ON public.contracts;
CREATE TRIGGER contracts_sync_unit_status AFTER UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.sync_unit_status_from_contract();