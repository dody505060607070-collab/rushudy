CREATE TABLE public.meeting_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  property_name text NOT NULL,
  meeting_at timestamptz NOT NULL,
  location_text text,
  location_url text,
  notes text,
  owner_name text, owner_phone text,
  visitor_name text, visitor_phone text,
  agent_name text, agent_phone text,
  auto_enabled boolean NOT NULL DEFAULT true,
  interval_hours integer NOT NULL DEFAULT 12 CHECK (interval_hours BETWEEN 1 AND 168),
  next_send_at timestamptz,
  last_sent_at timestamptz,
  sent_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_reminders TO authenticated;
GRANT ALL ON public.meeting_reminders TO service_role;
ALTER TABLE public.meeting_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read meetings" ON public.meeting_reminders FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff add meetings" ON public.meeting_reminders FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "staff edit meetings" ON public.meeting_reminders FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff delete meetings" ON public.meeting_reminders FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));
CREATE INDEX meeting_reminders_due_idx ON public.meeting_reminders (next_send_at) WHERE status = 'active' AND auto_enabled;