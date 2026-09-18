-- أعمدة العرض العام للعمارات
ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'rent',
  ADD COLUMN IF NOT EXISTS floors_count integer,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

UPDATE public.buildings SET code = 'B-' || upper(substr(replace(id::text,'-',''),1,6)) WHERE code IS NULL;
ALTER TABLE public.buildings ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS buildings_code_key ON public.buildings (code);

-- الدور الخاص بالعقار/الشقة داخل العمارة
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS floor text;

-- عرض العمارات المنشورة مع شققها للزوار
CREATE OR REPLACE FUNCTION public.get_public_buildings(_code text DEFAULT NULL, _purpose text DEFAULT NULL, _limit integer DEFAULT 60)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.sort_order ASC, r.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT b.id, b.code, b.name, b.city, b.district, b.address, b.description,
      b.purpose, b.floors_count, b.cover_url, b.sort_order, b.created_at,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', p.id, 'code', p.code, 'name', p.name, 'floor', p.floor,
          'purpose', p.purpose, 'rent_period', p.rent_period, 'property_type', p.property_type,
          'status', p.status, 'price_text', p.price_text, 'price_value', p.price_value,
          'description', p.description, 'whatsapp_number', p.whatsapp_number,
          'city', p.city, 'district', p.district,
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

GRANT EXECUTE ON FUNCTION public.get_public_buildings(text, text, integer) TO anon, authenticated;

-- إظهار الدور ورقم العمارة في بيانات العقار العام
CREATE OR REPLACE FUNCTION public.get_public_properties(_purpose text DEFAULT NULL::text, _code text DEFAULT NULL::text, _limit integer DEFAULT 60)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(result_row) ORDER BY result_row.is_featured DESC, result_row.sort_order ASC, result_row.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT p.id, p.code, p.name, p.purpose, p.rent_period, p.property_type, p.city, p.district,
      p.price_text, p.price_value, p.description, p.is_featured, p.sort_order, p.map_url,
      p.latitude, p.longitude, p.whatsapp_number, p.link_youtube, p.link_tiktok,
      p.link_instagram, p.link_snapchat, p.link_x, p.link_facebook, p.link_tour, p.created_at,
      p.floor, p.building_id,
      (SELECT b.code FROM public.buildings b WHERE b.id = p.building_id AND b.is_visible) AS building_code,
      (SELECT b.name FROM public.buildings b WHERE b.id = p.building_id AND b.is_visible) AS building_name,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('url', pi.url, 'is_cover', pi.is_cover, 'sort_order', pi.sort_order, 'focal_x', pi.focal_x, 'focal_y', pi.focal_y) ORDER BY pi.is_cover DESC, pi.sort_order ASC) FROM public.property_images pi WHERE pi.property_id = p.id), '[]'::jsonb) AS property_images
    FROM public.properties p
    WHERE p.is_visible AND p.status <> 'archived'
      AND (_purpose IS NULL OR p.purpose = _purpose)
      AND (_code IS NULL OR p.code = _code)
    ORDER BY p.is_featured DESC, p.sort_order ASC, p.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(_limit, 60), 1), 100)
  ) AS result_row;
$$;
