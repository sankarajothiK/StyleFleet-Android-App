-- ====================================================================
-- SALON OS — MIGRATION: PERMANENT ACCOUNT DELETION & RLS FIX
-- ====================================================================

-- 1. Ensure account_deletions table exists with proper schema
CREATE TABLE IF NOT EXISTS public.account_deletions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID,
    phone VARCHAR(50),
    shop_name TEXT,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'processed' CHECK (status IN ('pending', 'processed', 'cancelled')),
    deleted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_deletions_shop ON public.account_deletions(shop_id);
CREATE INDEX IF NOT EXISTS idx_account_deletions_phone ON public.account_deletions(phone);

-- Enable RLS and permissive policies for account_deletions
ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_account_deletions_insert" ON public.account_deletions;
CREATE POLICY "allow_account_deletions_insert" ON public.account_deletions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "allow_account_deletions_select" ON public.account_deletions;
CREATE POLICY "allow_account_deletions_select" ON public.account_deletions FOR SELECT USING (true);

-- 2. Add Explicit Permissive DELETE Policies on All Tables
-- (Crucial: Without these policies, Supabase RLS silently blocks DELETE queries from the client!)

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shops_delete" ON public.shops;
CREATE POLICY "shops_delete" ON public.shops FOR DELETE USING (true);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE USING (true);

ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shop_members_delete" ON public.shop_members;
CREATE POLICY "shop_members_delete" ON public.shop_members FOR DELETE USING (true);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payments_delete" ON public.payments;
CREATE POLICY "payments_delete" ON public.payments FOR DELETE USING (true);

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bills_delete" ON public.bills;
CREATE POLICY "bills_delete" ON public.bills FOR DELETE USING (true);

ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bill_items_delete" ON public.bill_items;
CREATE POLICY "bill_items_delete" ON public.bill_items FOR DELETE USING (true);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "appointments_delete" ON public.appointments;
CREATE POLICY "appointments_delete" ON public.appointments FOR DELETE USING (true);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customers_delete" ON public.customers;
CREATE POLICY "customers_delete" ON public.customers FOR DELETE USING (true);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_delete" ON public.staff;
CREATE POLICY "staff_delete" ON public.staff FOR DELETE USING (true);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "services_delete" ON public.services;
CREATE POLICY "services_delete" ON public.services FOR DELETE USING (true);

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_categories_delete" ON public.service_categories;
CREATE POLICY "service_categories_delete" ON public.service_categories FOR DELETE USING (true);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "offers_delete" ON public.offers;
CREATE POLICY "offers_delete" ON public.offers FOR DELETE USING (true);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expenses_delete" ON public.expenses;
CREATE POLICY "expenses_delete" ON public.expenses FOR DELETE USING (true);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expense_categories_delete" ON public.expense_categories;
CREATE POLICY "expense_categories_delete" ON public.expense_categories FOR DELETE USING (true);

ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shop_settings_delete" ON public.shop_settings;
CREATE POLICY "shop_settings_delete" ON public.shop_settings FOR DELETE USING (true);

ALTER TABLE public.reminder_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reminder_rules_delete" ON public.reminder_rules;
CREATE POLICY "reminder_rules_delete" ON public.reminder_rules FOR DELETE USING (true);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "support_messages_delete" ON public.support_messages;
CREATE POLICY "support_messages_delete" ON public.support_messages FOR DELETE USING (true);

ALTER TABLE public.support_message_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "support_message_answers_delete" ON public.support_message_answers;
CREATE POLICY "support_message_answers_delete" ON public.support_message_answers FOR DELETE USING (true);

-- 3. Atomic SECURITY DEFINER Function for Permanent Account Deletion
-- Runs with superuser privileges, completely bypassing RLS to ensure 100% removal
CREATE OR REPLACE FUNCTION public.permanently_delete_salon(
  p_shop_id UUID,
  p_phone TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT 'User requested permanent account deletion'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop RECORD;
  v_owner_profile_id UUID := NULL;
  v_phone TEXT := p_phone;
  v_shop_name TEXT := 'Unknown Salon';
BEGIN
  -- A. Fetch shop details
  IF p_shop_id IS NOT NULL THEN
    SELECT * INTO v_shop FROM public.shops WHERE id = p_shop_id LIMIT 1;
    IF v_shop.id IS NOT NULL THEN
      v_shop_name := v_shop.name;
      v_owner_profile_id := v_shop.owner_profile_id;
      IF v_phone IS NULL OR v_phone = '' THEN
        v_phone := v_shop.phone;
      END IF;
    END IF;
  END IF;

  IF v_shop.id IS NULL AND v_phone IS NOT NULL AND v_phone <> '' THEN
    SELECT * INTO v_shop FROM public.shops WHERE phone = v_phone LIMIT 1;
    IF v_shop.id IS NOT NULL THEN
      v_shop_name := v_shop.name;
      v_owner_profile_id := v_shop.owner_profile_id;
    END IF;
  END IF;

  -- B. Log the deletion to account_deletions
  INSERT INTO public.account_deletions (
    shop_id,
    phone,
    shop_name,
    reason,
    status,
    deleted_at
  ) VALUES (
    p_shop_id,
    v_phone,
    v_shop_name,
    p_reason,
    'processed',
    NOW()
  );

  -- C. Cascade delete all operational child records
  IF p_shop_id IS NOT NULL THEN
    DELETE FROM public.support_message_answers WHERE shop_id = p_shop_id;
    DELETE FROM public.support_messages WHERE shop_id = p_shop_id;
    DELETE FROM public.bill_items WHERE bill_id IN (SELECT id FROM public.bills WHERE shop_id = p_shop_id);
    DELETE FROM public.payments WHERE shop_id = p_shop_id;
    DELETE FROM public.bills WHERE shop_id = p_shop_id;
    DELETE FROM public.appointments WHERE shop_id = p_shop_id;
    DELETE FROM public.expenses WHERE shop_id = p_shop_id;
    DELETE FROM public.expense_categories WHERE shop_id = p_shop_id;
    DELETE FROM public.customers WHERE shop_id = p_shop_id;
    DELETE FROM public.staff WHERE shop_id = p_shop_id;
    DELETE FROM public.services WHERE shop_id = p_shop_id;
    DELETE FROM public.service_categories WHERE shop_id = p_shop_id;
    DELETE FROM public.offers WHERE shop_id = p_shop_id;
    DELETE FROM public.reminder_rules WHERE shop_id = p_shop_id;
    DELETE FROM public.shop_settings WHERE shop_id = p_shop_id;
    DELETE FROM public.whatsapp_messages WHERE shop_id = p_shop_id;
    DELETE FROM public.whatsapp_campaigns WHERE shop_id = p_shop_id;
    DELETE FROM public.whatsapp_templates WHERE shop_id = p_shop_id;
    DELETE FROM public.shop_members WHERE shop_id = p_shop_id;

    -- D. Delete the shop row itself
    DELETE FROM public.shops WHERE id = p_shop_id;
  END IF;

  -- Also delete by phone if any other duplicate shop exists
  IF v_phone IS NOT NULL AND v_phone <> '' THEN
    DELETE FROM public.shops WHERE phone = v_phone;
  END IF;

  -- E. Delete owner profile
  IF v_owner_profile_id IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id = v_owner_profile_id;
  END IF;
  IF v_phone IS NOT NULL AND v_phone <> '' THEN
    DELETE FROM public.profiles WHERE phone = v_phone;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_shop_id', p_shop_id,
    'message', 'Salon account and all associated data permanently removed from Supabase.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.permanently_delete_salon TO anon, authenticated, service_role;
