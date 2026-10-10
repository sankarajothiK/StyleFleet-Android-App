-- Migration: 20261008000001_enforce_free_sales_limit.sql
-- Description: Enforce the free-plan sales limit in the database, so it holds for every app version
-- (the app-side checks alone can be bypassed by old builds or a modified client).
--
-- Rule (same as the app): a salon without an active, unexpired Pro subscription may not create a new
-- bill or appointment once it already has `free_sales_limit` bills (default 100 when NULL).
-- Only INSERTs are checked; editing or paying existing bills is never blocked.

CREATE OR REPLACE FUNCTION public.enforce_free_sales_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_count bigint;
  v_is_pro boolean;
BEGIN
  IF NEW.shop_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(s.free_sales_limit, 100) INTO v_limit
  FROM public.shops s
  WHERE s.id = NEW.shop_id;

  -- Unknown shop: leave it to the foreign key / RLS to reject.
  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions sub
    WHERE sub.shop_id = NEW.shop_id
      AND sub.status IN ('active', 'cancelled')
      AND (sub.subscription_end_date IS NULL OR sub.subscription_end_date > now())
  ) INTO v_is_pro;

  IF v_is_pro THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count FROM public.bills b WHERE b.shop_id = NEW.shop_id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'SALES_LIMIT_REACHED: Free limit of % sales reached. Please upgrade to Pro.', v_limit
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_free_sales_limit_bills ON public.bills;
CREATE TRIGGER trg_enforce_free_sales_limit_bills
  BEFORE INSERT ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.enforce_free_sales_limit();

DROP TRIGGER IF EXISTS trg_enforce_free_sales_limit_appointments ON public.appointments;
CREATE TRIGGER trg_enforce_free_sales_limit_appointments
  BEFORE INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_free_sales_limit();
