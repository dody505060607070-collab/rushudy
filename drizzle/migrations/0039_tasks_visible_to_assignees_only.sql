DROP POLICY IF EXISTS "view tasks" ON public.tasks;
CREATE POLICY "view tasks" ON public.tasks FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin') OR public.is_task_member(id, auth.uid()) OR assigned_by = auth.uid());