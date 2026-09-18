CREATE TABLE public.employee_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  goal_type text NOT NULL CHECK (goal_type IN ('rent', 'sale', 'collection', 'tasks', 'leads', 'visits')),
  target_value numeric NOT NULL CHECK (target_value >= 0),
  achieved_value numeric NOT NULL DEFAULT 0 CHECK (achieved_value >= 0),
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, period_month, goal_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_goals TO authenticated;
GRANT ALL ON public.employee_goals TO service_role;

ALTER TABLE public.employee_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read employee goals"
ON public.employee_goals FOR SELECT TO authenticated USING (true);

CREATE POLICY "staff manage employee goals"
ON public.employee_goals FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX employee_goals_period_idx ON public.employee_goals(period_month DESC);
CREATE INDEX employee_goals_employee_idx ON public.employee_goals(employee_id, period_month DESC);

CREATE TRIGGER employee_goals_set_updated_at
BEFORE UPDATE ON public.employee_goals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.price_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  customer_name text NOT NULL CHECK (char_length(customer_name) BETWEEN 2 AND 120),
  customer_phone text NOT NULL CHECK (char_length(customer_phone) BETWEEN 6 AND 30),
  offer_amount numeric NOT NULL CHECK (offer_amount > 0),
  message text CHECK (message IS NULL OR char_length(message) <= 1000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'accepted', 'rejected', 'withdrawn')),
  referral_code text,
  internal_notes text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.price_offers TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.price_offers TO authenticated;
GRANT ALL ON public.price_offers TO service_role;

ALTER TABLE public.price_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visitors submit price offers"
ON public.price_offers FOR INSERT TO anon, authenticated
WITH CHECK (status = 'new' AND reviewed_by IS NULL AND internal_notes IS NULL);

CREATE POLICY "staff read price offers"
ON public.price_offers FOR SELECT TO authenticated USING (true);

CREATE POLICY "staff update price offers"
ON public.price_offers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "staff delete price offers"
ON public.price_offers FOR DELETE TO authenticated USING (true);

CREATE INDEX price_offers_property_idx ON public.price_offers(property_id, created_at DESC);
CREATE INDEX price_offers_status_idx ON public.price_offers(status, created_at DESC);

CREATE TRIGGER price_offers_set_updated_at
BEFORE UPDATE ON public.price_offers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();