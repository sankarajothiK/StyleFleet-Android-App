-- Migration: 20261002000000_tips_and_invoice_numbering.sql
-- Description: Add invoice_numbering_mode to public.shops and tip_minor to public.bills

ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS invoice_numbering_mode text DEFAULT 'monthly';
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS tip_minor bigint DEFAULT 0;
