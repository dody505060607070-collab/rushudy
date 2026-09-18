ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS map_url text;

CREATE OR REPLACE FUNCTION public.get_public_buildings(_code text DEFAULT NULL, _purpose text DEFAULT NULL, _limit integer DEFAULT 60)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.sort_order ASC, r.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT b.id, b.code, b.name, b.city, b.district, b.address, b.description,
      b.purpose, b.floors_count, b.cover_url, b.sort_order, b.created_at,
      b.latitude, b.longitude, b.map_url,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', p.id, 'code', p.code, 'name', p.name, 'floor', p.floor,
          'purpose', p.purpose, 'rent_period', p.rent_period, 'property_type', p.property_type,
          'status', p.status, 'price_text', p.price_text, 'price_value', p.price_value,
          'description', p.description, 'whatsapp_number', p.whatsapp_number,
          'city', p.city, 'district', p.district,
          'link_tour', p.link_tour,
          'latitude', p.latitude, 'longitude', p.longitude,
          'images', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('url', pi.url, 'is_cover', pi.is_cover, 'sort_order', pi.sort_order)
                   ORDER BY pi.is_cover DESC, pi.sort_order ASC)
            FROM public.property_images pi WHERE pi.property_id = p.id), '[]'::jsonb)
        ) ORDER BY p.floor NULLS LAST, p.name)
        FROM public.properties p
        WHERE p.building_id = b.id AND p.is_visible AND p.status <> 'archived'
      ), '[]'::jsonb) AS units
    FROM public.buildings b
    WHERE b.is_visible
      AND (_code IS NULL OR b.code = _code)
      AND (_purpose IS NULL OR b.purpose = _purpose)
    ORDER BY b.sort_order ASC, b.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(_limit, 60), 1), 100)
  ) AS r;
$$;