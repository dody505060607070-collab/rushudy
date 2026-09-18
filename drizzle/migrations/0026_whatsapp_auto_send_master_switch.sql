ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS whatsapp_auto_send_enabled BOOLEAN NOT NULL DEFAULT false;