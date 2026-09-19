ALTER TABLE public.employee_goals
  ADD COLUMN IF NOT EXISTS auto_track boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS points_per_unit numeric NOT NULL DEFAULT 10;