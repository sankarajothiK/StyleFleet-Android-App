-- ====================================================================
-- STYLEFLEET — SUBSCRIPTIONS & FREE TRIAL TABLE & RLS
-- ====================================================================

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  plan_id text not null,
  status text not null default 'active' check (status in ('trial', 'active', 'expired', 'payment_pending', 'payment_failed', 'cancelled')),
  trial_start_date timestamptz,
  trial_end_date timestamptz,
  subscription_start_date timestamptz,
  subscription_end_date timestamptz,
  cashfree_order_id text,
  cashfree_payment_id text,
  amount_minor bigint not null default 0,
  currency text not null default 'INR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for performant lookups
create index if not exists idx_subscriptions_shop_id on public.subscriptions(shop_id);
create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);
create index if not exists idx_subscriptions_cashfree_order_id on public.subscriptions(cashfree_order_id);

-- Enable RLS
alter table public.subscriptions enable row level security;

-- Policy: Select subscriptions
create policy "Users can view subscriptions for their shop"
  on public.subscriptions
  for select
  using (
    auth.uid() = user_id or
    (shop_id is not null and exists (
      select 1 from public.shop_members
      where shop_members.shop_id = subscriptions.shop_id
      and shop_members.profile_id = auth.uid()
    ))
  );

-- Policy: Insert subscriptions (owners or service role)
create policy "Owners can insert subscriptions for their shop"
  on public.subscriptions
  for insert
  with check (
    auth.uid() = user_id or
    (shop_id is not null and exists (
      select 1 from public.shop_members
      where shop_members.shop_id = subscriptions.shop_id
      and shop_members.profile_id = auth.uid()
      and shop_members.role = 'owner'
    ))
  );

-- Policy: Update subscriptions
create policy "Owners can update subscriptions for their shop"
  on public.subscriptions
  for update
  using (
    auth.uid() = user_id or
    (shop_id is not null and exists (
      select 1 from public.shop_members
      where shop_members.shop_id = subscriptions.shop_id
      and shop_members.profile_id = auth.uid()
      and shop_members.role = 'owner'
    ))
  );
