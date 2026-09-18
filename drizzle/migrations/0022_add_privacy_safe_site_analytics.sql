CREATE TABLE public.site_page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL CHECK (char_length(visitor_id) BETWEEN 8 AND 80),
  path text NOT NULL CHECK (char_length(path) BETWEEN 1 AND 500),
  referrer_host text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  visited_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.site_page_views TO anon, authenticated;
GRANT SELECT ON public.site_page_views TO authenticated;
GRANT ALL ON public.site_page_views TO service_role;

ALTER TABLE public.site_page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visitors record privacy safe page views"
ON public.site_page_views
FOR INSERT
TO anon, authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "authenticated staff view website analytics"
ON public.site_page_views
FOR SELECT
TO authenticated
USING (true);

CREATE INDEX site_page_views_visited_at_idx ON public.site_page_views(visited_at DESC);
CREATE INDEX site_page_views_path_visited_idx ON public.site_page_views(path, visited_at DESC);
CREATE INDEX site_page_views_visitor_visited_idx ON public.site_page_views(visitor_id, visited_at DESC);