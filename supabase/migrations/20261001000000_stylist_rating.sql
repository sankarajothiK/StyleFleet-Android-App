-- Migration: 20261001000000_stylist_rating.sql
-- Description: Add rating column to public.staff table to store stylist ratings

ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS rating text DEFAULT '5.0';
