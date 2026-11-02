CREATE TABLE public.maintenance_notify_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  phone text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_notify_recipients TO authenticated;
GRANT ALL ON public.maintenance_notify_recipients TO service_role;
ALTER TABLE public.maintenance_notify_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read maintenance recipients" ON public.maintenance_notify_recipients
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff manage maintenance recipients" ON public.maintenance_notify_recipients
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
COMMENT ON TABLE public.maintenance_notify_recipients IS 'WhatsApp numbers notified when a maintenance request is submitted (office lines + maintenance staff).';

INSERT INTO public.maintenance_notify_recipients (label, phone)
SELECT 'رقم المكتب', whatsapp_number FROM public.app_settings
WHERE coalesce(whatsapp_number, '') <> ''
ON CONFLICT (phone) DO NOTHING;
INSERT INTO public.maintenance_notify_recipients (label, phone)
SELECT full_name, phone FROM public.profiles
WHERE full_name = 'أبوراكان' AND coalesce(phone, '') <> ''
ON CONFLICT (phone) DO NOTHING;