-- Migration: 20261008000000_shop_free_sales_limit.sql
-- Description: Optional per-salon override of the free-plan sales limit.
-- NULL means the app default (100). Set by the operator, never by the salon app.

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS free_sales_limit integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shops_free_sales_limit_positive'
  ) THEN
    ALTER TABLE public.shops
      ADD CONSTRAINT shops_free_sales_limit_positive
      CHECK (free_sales_limit IS NULL OR free_sales_limit >= 1);
  END IF;
END $$;
