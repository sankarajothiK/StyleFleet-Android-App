-- Migration: 20261002000001_shop_upi_id.sql
-- Description: Add upi_id to public.shops for WhatsApp bill balance collection

ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS upi_id text;
