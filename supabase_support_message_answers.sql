-- Migration: support_message_answers
-- Purpose: Store replies sent by StyleFleet Support admin panel to salon shops
-- When an admin replies from the admin panel, a row is inserted here.
-- The StyleFleet app listens to this table and notifies the salon in their notifications/reminders.

CREATE TABLE IF NOT EXISTS public.support_message_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL,
  message_id UUID REFERENCES public.support_messages(id) ON DELETE SET NULL,
  admin_name TEXT DEFAULT 'StyleFleet Support',
  answer TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for speedy querying by shop_id
CREATE INDEX IF NOT EXISTS idx_support_message_answers_shop_id 
  ON public.support_message_answers(shop_id);

CREATE INDEX IF NOT EXISTS idx_support_message_answers_unread 
  ON public.support_message_answers(shop_id, is_read) 
  WHERE is_read = false;

-- Enable Row Level Security (RLS)
ALTER TABLE public.support_message_answers ENABLE ROW LEVEL SECURITY;

-- Policy: Allow reading replies for shop
DROP POLICY IF EXISTS "Shops can view their own support answers" ON public.support_message_answers;
CREATE POLICY "Shops can view their own support answers" 
  ON public.support_message_answers
  FOR SELECT 
  USING (true);

-- Policy: Allow inserting answers (e.g. from admin panel)
DROP POLICY IF EXISTS "Allow insert support answers" ON public.support_message_answers;
CREATE POLICY "Allow insert support answers" 
  ON public.support_message_answers
  FOR INSERT 
  WITH CHECK (true);

-- Policy: Allow updating is_read
DROP POLICY IF EXISTS "Shops can mark answers as read" ON public.support_message_answers;
CREATE POLICY "Shops can mark answers as read" 
  ON public.support_message_answers
  FOR UPDATE 
  USING (true);
