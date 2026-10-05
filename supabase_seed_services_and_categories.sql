-- ====================================================================
-- SALON OS — MIGRATION: SEED SERVICES, CATEGORIES & PERMISSIVE RLS
-- ====================================================================

-- 1. Ensure Permissive RLS Policies on service_categories and services
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_categories_select" ON public.service_categories;
CREATE POLICY "service_categories_select" ON public.service_categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "service_categories_insert" ON public.service_categories;
CREATE POLICY "service_categories_insert" ON public.service_categories FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "service_categories_update" ON public.service_categories;
CREATE POLICY "service_categories_update" ON public.service_categories FOR UPDATE USING (true);
DROP POLICY IF EXISTS "service_categories_delete" ON public.service_categories;
CREATE POLICY "service_categories_delete" ON public.service_categories FOR DELETE USING (true);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "services_select" ON public.services;
CREATE POLICY "services_select" ON public.services FOR SELECT USING (true);
DROP POLICY IF EXISTS "services_insert" ON public.services;
CREATE POLICY "services_insert" ON public.services FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "services_update" ON public.services;
CREATE POLICY "services_update" ON public.services FOR UPDATE USING (true);
DROP POLICY IF EXISTS "services_delete" ON public.services;
CREATE POLICY "services_delete" ON public.services FOR DELETE USING (true);

-- 2. Enhanced Shop Defaults Initializer (Seeds Categories & 16 Preset Services)
CREATE OR REPLACE FUNCTION public.initialize_shop_defaults(new_shop_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hair_id UUID;
  v_beard_id UUID;
  v_colour_id UUID;
  v_care_id UUID;
  v_packages_id UUID;
BEGIN
  -- A. Ensure Default Categories Exist
  SELECT id INTO v_hair_id FROM public.service_categories WHERE shop_id = new_shop_id AND lower(name) = 'hair' LIMIT 1;
  IF v_hair_id IS NULL THEN
    INSERT INTO public.service_categories (shop_id, name, sort_order, is_active)
    VALUES (new_shop_id, 'Hair', 1, true)
    RETURNING id INTO v_hair_id;
  END IF;

  SELECT id INTO v_beard_id FROM public.service_categories WHERE shop_id = new_shop_id AND lower(name) = 'beard' LIMIT 1;
  IF v_beard_id IS NULL THEN
    INSERT INTO public.service_categories (shop_id, name, sort_order, is_active)
    VALUES (new_shop_id, 'Beard', 2, true)
    RETURNING id INTO v_beard_id;
  END IF;

  SELECT id INTO v_colour_id FROM public.service_categories WHERE shop_id = new_shop_id AND lower(name) = 'colour' LIMIT 1;
  IF v_colour_id IS NULL THEN
    INSERT INTO public.service_categories (shop_id, name, sort_order, is_active)
    VALUES (new_shop_id, 'Colour', 3, true)
    RETURNING id INTO v_colour_id;
  END IF;

  SELECT id INTO v_care_id FROM public.service_categories WHERE shop_id = new_shop_id AND lower(name) = 'care' LIMIT 1;
  IF v_care_id IS NULL THEN
    INSERT INTO public.service_categories (shop_id, name, sort_order, is_active)
    VALUES (new_shop_id, 'Care', 4, true)
    RETURNING id INTO v_care_id;
  END IF;

  SELECT id INTO v_packages_id FROM public.service_categories WHERE shop_id = new_shop_id AND lower(name) = 'packages' LIMIT 1;
  IF v_packages_id IS NULL THEN
    INSERT INTO public.service_categories (shop_id, name, sort_order, is_active)
    VALUES (new_shop_id, 'Packages', 5, true)
    RETURNING id INTO v_packages_id;
  END IF;

  -- B. Seed All 16 Preset Services if none exist yet
  IF NOT EXISTS (SELECT 1 FROM public.services WHERE shop_id = new_shop_id) THEN
    INSERT INTO public.services (shop_id, category_id, name, price_minor, duration_minutes, is_active) VALUES
      (new_shop_id, v_hair_id, 'Haircut', 30000, 30, true),
      (new_shop_id, v_hair_id, 'Haircut + wash', 40000, 40, true),
      (new_shop_id, v_hair_id, 'Skin fade', 45000, 45, true),
      (new_shop_id, v_hair_id, 'Kids cut', 20000, 25, true),
      (new_shop_id, v_hair_id, 'Head shave', 25000, 30, true),
      (new_shop_id, v_beard_id, 'Beard trim & shape', 20000, 20, true),
      (new_shop_id, v_beard_id, 'Royal shave · hot towel', 35000, 35, true),
      (new_shop_id, v_beard_id, 'Beard colour', 50000, 30, true),
      (new_shop_id, v_colour_id, 'Hair colour · black', 70000, 45, true),
      (new_shop_id, v_colour_id, 'Global colour', 180000, 90, true),
      (new_shop_id, v_colour_id, 'Highlights', 240000, 120, true),
      (new_shop_id, v_care_id, 'Hair spa', 90000, 60, true),
      (new_shop_id, v_care_id, 'Head massage', 35000, 30, true),
      (new_shop_id, v_care_id, 'Face clean-up', 60000, 45, true),
      (new_shop_id, v_care_id, 'D-Tan', 50000, 30, true),
      (new_shop_id, v_packages_id, 'Groom package', 650000, 180, true);
  END IF;

  -- C. Default Expense Categories
  INSERT INTO public.expense_categories (shop_id, name, is_active) VALUES
    (new_shop_id, 'Products & stock', true),
    (new_shop_id, 'Salaries', true),
    (new_shop_id, 'Rent', true),
    (new_shop_id, 'Electricity', true),
    (new_shop_id, 'Marketing', true),
    (new_shop_id, 'Maintenance', true)
  ON CONFLICT DO NOTHING;

  -- D. Default Reminder Rules
  INSERT INTO public.reminder_rules (shop_id, type, is_enabled, configuration) VALUES
    (new_shop_id, 'appointment_reminder', true, '{"label": "Appointment reminder · 3 hours before", "hours_before": 3}'::jsonb),
    (new_shop_id, 'payment_due_followup', true, '{"label": "Payment due follow-up · every 3 days", "interval_days": 3}'::jsonb),
    (new_shop_id, 'daily_closing', true, '{"label": "Daily closing summary · 9:00 pm", "time": "21:00"}'::jsonb)
  ON CONFLICT DO NOTHING;

  -- E. Default Shop Settings
  INSERT INTO public.shop_settings (
    shop_id,
    appointment_reminder_enabled,
    payment_followup_enabled,
    daily_closing_enabled,
    daily_closing_time,
    appointment_reminder_minutes,
    payment_followup_interval_days
  ) VALUES (
    new_shop_id,
    true,
    true,
    true,
    '21:00',
    180,
    3
  )
  ON CONFLICT (shop_id) DO NOTHING;

  -- F. Default Offers
  INSERT INTO public.offers (shop_id, name, description, discount_type, discount_value, is_active) VALUES
    (new_shop_id, 'Mon–Wed colour', '20% off all colour services, weekdays', 'percentage', 20.00, true),
    (new_shop_id, 'Cut + beard combo', 'Both for ₹450 instead of ₹500', 'fixed', 50.00, true),
    (new_shop_id, 'Refer a friend', '₹100 off the next visit for both', 'fixed', 100.00, false)
  ON CONFLICT DO NOTHING;
END;
$$;

-- 3. Backfill All Existing Shops Immediately
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.shops LOOP
    PERFORM public.initialize_shop_defaults(r.id);
  END LOOP;
END;
$$;
