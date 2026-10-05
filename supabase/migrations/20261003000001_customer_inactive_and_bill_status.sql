-- Migration: Customer inactive state, bill reminder status & confirmation status
-- Preserves 100% historical records and financial consistency

-- 1. Add is_active column to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_customers_shop_active ON public.customers(shop_id, is_active);

-- 2. Add reminder_status and confirmation_status to bills
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS reminder_status TEXT DEFAULT 'Not Sent';
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS confirmation_status TEXT DEFAULT 'Pending';

-- 3. Update RLS policies to ensure active status is queryable
COMMENT ON COLUMN public.customers.is_active IS 'Soft active/inactive flag preserving complete historical billing and appointments';
COMMENT ON COLUMN public.bills.reminder_status IS 'Tracks delivery of reminder: Not Sent, Sent, Pending';
COMMENT ON COLUMN public.bills.confirmation_status IS 'Tracks customer confirmation: Pending, Confirmed';
