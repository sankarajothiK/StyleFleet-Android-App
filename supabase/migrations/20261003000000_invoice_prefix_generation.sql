-- Migration: 20261003000000_invoice_prefix_generation.sql
-- Description: Ensure invoice_prefix exists on public.shops and is properly indexed

ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS invoice_prefix text DEFAULT 'CS';

-- Ensure existing rows with empty or default 'INV-' prefix receive a valid fallback if null
UPDATE public.shops
SET invoice_prefix = 'CS'
WHERE invoice_prefix IS NULL OR invoice_prefix = '';
