CREATE POLICY "edit transactions" ON public.payment_transactions
FOR UPDATE TO authenticated
USING (has_perm(auth.uid(), 'payments'::text, 'collect'::text))
WITH CHECK (has_perm(auth.uid(), 'payments'::text, 'collect'::text));

CREATE POLICY "delete transactions" ON public.payment_transactions
FOR DELETE TO authenticated
USING (has_perm(auth.uid(), 'payments'::text, 'collect'::text));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_reminder_state TO authenticated;
GRANT ALL ON public.task_reminder_state TO service_role;