-- Migration 3: Support Messages and Account Deletions
-- Created: 2026-09-25

-- 1. Support Messages Table
CREATE TABLE IF NOT EXISTS support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    contact_info TEXT,
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_shop ON support_messages(shop_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_user ON support_messages(user_id);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop members can view their support messages"
    ON support_messages FOR SELECT
    USING (is_shop_member(shop_id));

CREATE POLICY "Authenticated users can submit support messages"
    ON support_messages FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Account Deletions Table
CREATE TABLE IF NOT EXISTS account_deletions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID,
    user_id UUID,
    phone VARCHAR(50),
    shop_name TEXT,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'processed' CHECK (status IN ('pending', 'processed', 'cancelled')),
    deleted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_deletions_shop ON account_deletions(shop_id);
CREATE INDEX IF NOT EXISTS idx_account_deletions_user ON account_deletions(user_id);

ALTER TABLE account_deletions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert account deletion record"
    ON account_deletions FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their own deletion records"
    ON account_deletions FOR SELECT
    USING (user_id = auth.uid());
