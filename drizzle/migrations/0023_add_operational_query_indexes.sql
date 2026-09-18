CREATE INDEX IF NOT EXISTS contract_payments_status_due_date_idx
ON public.contract_payments (status, due_date);

CREATE INDEX IF NOT EXISTS contract_payments_contract_status_idx
ON public.contract_payments (contract_id, status);

CREATE INDEX IF NOT EXISTS invoices_status_created_at_idx
ON public.invoices (status, created_at DESC);