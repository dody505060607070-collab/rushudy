CREATE OR REPLACE FUNCTION public.sync_contact_phone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    IF NEW.whatsapp IS NOT DISTINCT FROM OLD.whatsapp AND (OLD.whatsapp IS NULL OR OLD.whatsapp = OLD.phone OR btrim(OLD.whatsapp) = '') THEN
      NEW.whatsapp := NEW.phone;
    END IF;
  END IF;
  IF (NEW.phone IS DISTINCT FROM OLD.phone OR NEW.whatsapp IS DISTINCT FROM OLD.whatsapp OR NEW.full_name IS DISTINCT FROM OLD.full_name) THEN
    UPDATE public.reminder_followups
       SET recipient_phone = COALESCE(NULLIF(btrim(NEW.whatsapp),''), NEW.phone),
           recipient_name = NEW.full_name,
           updated_at = now()
     WHERE recipient_contact_id = NEW.id
       AND status NOT IN ('completed','cancelled','stopped');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_contact_phone ON public.contacts;
CREATE TRIGGER trg_sync_contact_phone BEFORE UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.sync_contact_phone();