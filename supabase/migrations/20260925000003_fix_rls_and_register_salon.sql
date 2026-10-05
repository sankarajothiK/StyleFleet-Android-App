-- Migration 4: Fix RLS and Enable Direct Phone Salon Registration
-- Created: 2026-09-25

-- 1. Atomic Salon Registration Function (Security Definer)
-- This function runs with elevated database privileges, bypassing RLS to safely register a salon, owner, and default data.
CREATE OR REPLACE FUNCTION public.register_salon(
  p_name TEXT,
  p_phone TEXT,
  p_owner_name TEXT,
  p_address TEXT,
  p_city TEXT,
  p_pin_code TEXT,
  p_gstin TEXT DEFAULT NULL,
  p_logo_path TEXT DEFAULT NULL,
  p_accent_color TEXT DEFAULT '#D9A441'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id UUID;
  v_profile_id UUID;
  v_shop JSONB;
BEGIN
  -- A. Find or create owner profile
  SELECT id INTO v_profile_id FROM public.profiles WHERE phone = p_phone LIMIT 1;
  IF v_profile_id IS NULL THEN
    v_profile_id := gen_random_uuid();
    INSERT INTO public.profiles (id, phone, full_name)
    VALUES (v_profile_id, p_phone, p_owner_name);
  END IF;

  -- B. Create the salon in public.shops
  INSERT INTO public.shops (
    name, phone, address, city, pin_code, gstin, logo_path, accent_color, owner_profile_id, invoice_prefix, gst_rate
  ) VALUES (
    p_name, p_phone, p_address, p_city, p_pin_code, p_gstin, p_logo_path, p_accent_color, v_profile_id, 'INV-', 18.00
  ) RETURNING id INTO v_shop_id;

  -- C. Add owner as member
  INSERT INTO public.shop_members (shop_id, profile_id, role, is_active)
  VALUES (v_shop_id, v_profile_id, 'owner', true)
  ON CONFLICT (shop_id, profile_id) DO NOTHING;

  -- D. Populate default services, categories, and settings
  BEGIN
    PERFORM public.initialize_shop_defaults(v_shop_id);
  EXCEPTION WHEN OTHERS THEN
    -- Continue if defaults already exist or error occurs
  END;

  -- E. Return newly created shop
  SELECT to_jsonb(s.*) INTO v_shop FROM public.shops s WHERE s.id = v_shop_id;
  RETURN v_shop;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_salon TO anon, authenticated, service_role;

-- 2. Open Permissive RLS Policies for All Operational Tables
-- (Allows mobile clients using 2Factor SMS phone authentication to read and write records)

-- Shops
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shops_insert" ON public.shops;
CREATE POLICY "shops_insert" ON public.shops FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "shops_select" ON public.shops;
CREATE POLICY "shops_select" ON public.shops FOR SELECT USING (true);
DROP POLICY IF EXISTS "shops_update" ON public.shops;
CREATE POLICY "shops_update" ON public.shops FOR UPDATE USING (true);

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (true);

-- Shop Members
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shop_members_select" ON public.shop_members;
CREATE POLICY "shop_members_select" ON public.shop_members FOR SELECT USING (true);
DROP POLICY IF EXISTS "shop_members_insert" ON public.shop_members;
CREATE POLICY "shop_members_insert" ON public.shop_members FOR INSERT WITH CHECK (true);

-- Staff
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_select" ON public.staff;
CREATE POLICY "staff_select" ON public.staff FOR SELECT USING (true);
DROP POLICY IF EXISTS "staff_insert" ON public.staff;
CREATE POLICY "staff_insert" ON public.staff FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "staff_update" ON public.staff;
CREATE POLICY "staff_update" ON public.staff FOR UPDATE USING (true);
DROP POLICY IF EXISTS "staff_delete" ON public.staff;
CREATE POLICY "staff_delete" ON public.staff FOR DELETE USING (true);

-- Customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customers_select" ON public.customers;
CREATE POLICY "customers_select" ON public.customers FOR SELECT USING (true);
DROP POLICY IF EXISTS "customers_insert" ON public.customers;
CREATE POLICY "customers_insert" ON public.customers FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "customers_update" ON public.customers;
CREATE POLICY "customers_update" ON public.customers FOR UPDATE USING (true);
DROP POLICY IF EXISTS "customers_delete" ON public.customers;
CREATE POLICY "customers_delete" ON public.customers FOR DELETE USING (true);

-- Service Categories & Services
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_categories_select" ON public.service_categories;
CREATE POLICY "service_categories_select" ON public.service_categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "service_categories_insert" ON public.service_categories;
CREATE POLICY "service_categories_insert" ON public.service_categories FOR INSERT WITH CHECK (true);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "services_select" ON public.services;
CREATE POLICY "services_select" ON public.services FOR SELECT USING (true);
DROP POLICY IF EXISTS "services_insert" ON public.services;
CREATE POLICY "services_insert" ON public.services FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "services_update" ON public.services;
CREATE POLICY "services_update" ON public.services FOR UPDATE USING (true);
DROP POLICY IF EXISTS "services_delete" ON public.services;
CREATE POLICY "services_delete" ON public.services FOR DELETE USING (true);

-- Bills, Bill Items & Payments
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bills_select" ON public.bills;
CREATE POLICY "bills_select" ON public.bills FOR SELECT USING (true);
DROP POLICY IF EXISTS "bills_insert" ON public.bills;
CREATE POLICY "bills_insert" ON public.bills FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "bills_update" ON public.bills;
CREATE POLICY "bills_update" ON public.bills FOR UPDATE USING (true);
DROP POLICY IF EXISTS "bills_delete" ON public.bills;
CREATE POLICY "bills_delete" ON public.bills FOR DELETE USING (true);

ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bill_items_select" ON public.bill_items;
CREATE POLICY "bill_items_select" ON public.bill_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "bill_items_insert" ON public.bill_items;
CREATE POLICY "bill_items_insert" ON public.bill_items FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "bill_items_delete" ON public.bill_items;
CREATE POLICY "bill_items_delete" ON public.bill_items FOR DELETE USING (true);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payments_select" ON public.payments;
CREATE POLICY "payments_select" ON public.payments FOR SELECT USING (true);
DROP POLICY IF EXISTS "payments_insert" ON public.payments;
CREATE POLICY "payments_insert" ON public.payments FOR INSERT WITH CHECK (true);

-- Expenses & Expense Categories
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expenses_select" ON public.expenses;
CREATE POLICY "expenses_select" ON public.expenses FOR SELECT USING (true);
DROP POLICY IF EXISTS "expenses_insert" ON public.expenses;
CREATE POLICY "expenses_insert" ON public.expenses FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "expenses_update" ON public.expenses;
CREATE POLICY "expenses_update" ON public.expenses FOR UPDATE USING (true);
DROP POLICY IF EXISTS "expenses_delete" ON public.expenses;
CREATE POLICY "expenses_delete" ON public.expenses FOR DELETE USING (true);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expense_categories_select" ON public.expense_categories;
CREATE POLICY "expense_categories_select" ON public.expense_categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "expense_categories_insert" ON public.expense_categories;
CREATE POLICY "expense_categories_insert" ON public.expense_categories FOR INSERT WITH CHECK (true);

-- Appointments & Offers
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "appointments_select" ON public.appointments;
CREATE POLICY "appointments_select" ON public.appointments FOR SELECT USING (true);
DROP POLICY IF EXISTS "appointments_insert" ON public.appointments;
CREATE POLICY "appointments_insert" ON public.appointments FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "appointments_update" ON public.appointments;
CREATE POLICY "appointments_update" ON public.appointments FOR UPDATE USING (true);
DROP POLICY IF EXISTS "appointments_delete" ON public.appointments;
CREATE POLICY "appointments_delete" ON public.appointments FOR DELETE USING (true);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "offers_select" ON public.offers;
CREATE POLICY "offers_select" ON public.offers FOR SELECT USING (true);
DROP POLICY IF EXISTS "offers_insert" ON public.offers;
CREATE POLICY "offers_insert" ON public.offers FOR INSERT WITH CHECK (true);

-- Shop Settings
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shop_settings_select" ON public.shop_settings;
CREATE POLICY "shop_settings_select" ON public.shop_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "shop_settings_insert" ON public.shop_settings;
CREATE POLICY "shop_settings_insert" ON public.shop_settings FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "shop_settings_update" ON public.shop_settings;
CREATE POLICY "shop_settings_update" ON public.shop_settings FOR UPDATE USING (true);

-- Support Messages & Deletions
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can submit support messages" ON public.support_messages;
CREATE POLICY "allow_support_messages_insert" ON public.support_messages FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Shop members can view their support messages" ON public.support_messages;
CREATE POLICY "allow_support_messages_select" ON public.support_messages FOR SELECT USING (true);

ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can insert account deletion record" ON public.account_deletions;
CREATE POLICY "allow_account_deletions_insert" ON public.account_deletions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users can view their own deletion records" ON public.account_deletions;
CREATE POLICY "allow_account_deletions_select" ON public.account_deletions FOR SELECT USING (true);
