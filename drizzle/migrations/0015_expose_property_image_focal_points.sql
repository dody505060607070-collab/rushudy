CREATE OR REPLACE FUNCTION public.get_public_properties(_purpose text DEFAULT NULL::text, _code text DEFAULT NULL::text, _limit integer DEFAULT 60)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(result_row) ORDER BY result_row.is_featured DESC, result_row.sort_order ASC, result_row.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT p.id, p.code, p.name, p.purpose, p.rent_period, p.property_type, p.city, p.district,
      p.price_text, p.price_value, p.description, p.is_featured, p.sort_order, p.map_url,
      p.latitude, p.longitude, p.whatsapp_number, p.link_youtube, p.link_tiktok,
      p.link_instagram, p.link_snapchat, p.link_x, p.link_facebook, p.link_tour, p.created_at,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('url', pi.url, 'is_cover', pi.is_cover, 'sort_order', pi.sort_order, 'focal_x', pi.focal_x, 'focal_y', pi.focal_y) ORDER BY pi.is_cover DESC, pi.sort_order ASC) FROM public.property_images pi WHERE pi.property_id = p.id), '[]'::jsonb) AS property_images
    FROM public.properties p
    WHERE p.is_visible AND p.status <> 'archived'
      AND (_purpose IS NULL OR p.purpose = _purpose)
      AND (_code IS NULL OR p.code = _code)
    ORDER BY p.is_featured DESC, p.sort_order ASC, p.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(_limit, 60), 1), 100)
  ) AS result_row;
$$;
REVOKE ALL ON FUNCTION public.get_public_properties(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_properties(text, text, integer) TO anon, authenticated, service_role;