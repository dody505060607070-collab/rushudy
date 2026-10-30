ALTER TABLE public.owner_followup_config
  ADD COLUMN IF NOT EXISTS rent_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rent_template text,
  ADD COLUMN IF NOT EXISTS rent_next_at timestamptz;
ALTER TABLE public.owner_followup_queue
  ADD COLUMN IF NOT EXISTS followup_kind text NOT NULL DEFAULT 'owner_biweekly',
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
GRANT ALL ON public.owner_followup_config TO service_role;
CREATE INDEX IF NOT EXISTS owner_followup_pending_kind_idx ON public.owner_followup_queue (status, followup_kind, created_at);

CREATE OR REPLACE FUNCTION public.enforce_task_review()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NOT public.has_role(auth.uid(), 'super_admin') THEN
      IF NEW.status IN ('approved','done') AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN
        RAISE EXCEPTION 'Only Super Admin can approve completed tasks';
      END IF;
      IF TG_OP = 'UPDATE' AND (
        NEW.approved_by IS DISTINCT FROM OLD.approved_by OR
        NEW.approved_at IS DISTINCT FROM OLD.approved_at OR
        NEW.rejection_note IS DISTINCT FROM OLD.rejection_note OR
        (OLD.status = 'submitted' AND NEW.status IS DISTINCT FROM OLD.status)
      ) THEN RAISE EXCEPTION 'Only Super Admin can review submitted tasks'; END IF;
    END IF;
    IF NEW.status IN ('approved','done') AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN
      IF TG_OP = 'INSERT' OR OLD.status <> 'submitted' THEN RAISE EXCEPTION 'Submit the task before approval'; END IF;
      NEW.approved_by := auth.uid(); NEW.approved_at := now();
    END IF;
    IF NEW.status = 'submitted' AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN
      IF TG_OP = 'INSERT' THEN RAISE EXCEPTION 'Create the task before submission'; END IF;
      IF OLD.status NOT IN ('new','in_progress','rejected') THEN RAISE EXCEPTION 'Task is not in progress'; END IF;
      IF NOT public.has_role(auth.uid(), 'super_admin') AND NOT public.is_task_member(NEW.id, auth.uid()) THEN RAISE EXCEPTION 'Task is not assigned to you'; END IF;
      NEW.submitted_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_task_review_before_write BEFORE INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.enforce_task_review();

CREATE OR REPLACE FUNCTION public.enforce_goal_management()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (
    public.has_role(auth.uid(), 'super_admin') OR public.has_perm(auth.uid(), 'employees', 'manage')
  ) THEN RAISE EXCEPTION 'Employee goal management is not allowed'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_goal_management_before_write BEFORE INSERT OR UPDATE OR DELETE ON public.employee_goals FOR EACH ROW EXECUTE FUNCTION public.enforce_goal_management();