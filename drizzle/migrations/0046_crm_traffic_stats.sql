CREATE INDEX IF NOT EXISTS site_page_views_visited_at_idx ON public.site_page_views (visited_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_created_at_idx ON public.activity_log (created_at DESC);

DROP POLICY IF EXISTS "authenticated staff view website analytics" ON public.site_page_views;
CREATE POLICY "authenticated staff view website analytics" ON public.site_page_views
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_crm_traffic_stats(_days integer)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _now timestamptz := now();
  _cur timestamptz := now() - make_interval(days => greatest(_days, 1));
  _prev timestamptz := now() - make_interval(days => greatest(_days, 1) * 2);
  _result jsonb;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT jsonb_build_object(
    'views', (SELECT count(*) FROM site_page_views WHERE visited_at >= _cur),
    'visitors', (SELECT count(DISTINCT visitor_id) FROM site_page_views WHERE visited_at >= _cur),
    'public_visitors', (SELECT count(DISTINCT visitor_id) FROM site_page_views WHERE visited_at >= _cur AND user_id IS NULL),
    'previous_views', (SELECT count(*) FROM site_page_views WHERE visited_at >= _prev AND visited_at < _cur),
    'previous_visitors', (SELECT count(DISTINCT visitor_id) FROM site_page_views WHERE visited_at >= _prev AND visited_at < _cur),
    'live_visitors', (SELECT count(DISTINCT visitor_id) FROM site_page_views WHERE visited_at >= _now - interval '5 minutes'),
    'live_public_visitors', (SELECT count(DISTINCT visitor_id) FROM site_page_views WHERE visited_at >= _now - interval '5 minutes' AND user_id IS NULL),
    'last_visit_at', (SELECT max(visited_at) FROM site_page_views),
    'top_pages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('path', path, 'views', views) ORDER BY views DESC)
      FROM (SELECT path, count(*) views FROM site_page_views WHERE visited_at >= _cur AND user_id IS NULL GROUP BY path ORDER BY count(*) DESC LIMIT 7) p
    ), '[]'::jsonb),
    'top_pages_all', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('path', path, 'views', views) ORDER BY views DESC)
      FROM (SELECT path, count(*) views FROM site_page_views WHERE visited_at >= _cur GROUP BY path ORDER BY count(*) DESC LIMIT 7) p
    ), '[]'::jsonb),
    'recent', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('path', path, 'at', visited_at, 'signed_in', user_id IS NOT NULL) ORDER BY visited_at DESC)
      FROM (SELECT path, visited_at, user_id FROM site_page_views ORDER BY visited_at DESC LIMIT 12) r
    ), '[]'::jsonb),
    'events', (SELECT count(*) FROM activity_log WHERE created_at >= _cur)
  ) INTO _result;

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_crm_traffic_stats(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_crm_traffic_stats(integer) TO authenticated;