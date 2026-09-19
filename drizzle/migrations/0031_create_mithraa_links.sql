CREATE TABLE public.mithraa_links (
  user_id uuid PRIMARY KEY,
  email text NOT NULL,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.mithraa_links TO service_role;

ALTER TABLE public.mithraa_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages mithraa links"
ON public.mithraa_links
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);