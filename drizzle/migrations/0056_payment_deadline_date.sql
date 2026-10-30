ALTER TABLE public.contract_payments ADD COLUMN IF NOT EXISTS deadline_date date;
COMMENT ON COLUMN public.contract_payments.deadline_date IS 'نهاية مهلة السداد كما وردت في جدول الدفعات';