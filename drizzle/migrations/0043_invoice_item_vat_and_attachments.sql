ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS vat_rate numeric NOT NULL DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS vat_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'other';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS attachment_path text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS attachment_name text;