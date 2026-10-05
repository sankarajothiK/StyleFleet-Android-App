-- ====================================================================
-- SALON OS — COMPLETE DATABASE MIGRATION
-- Compliant with DATABASE_SETUP.md and ARCHITECTURE.md
-- ====================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. PROFILES TABLE
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. SHOPS TABLE
create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  logo_path text,
  address text,
  city text,
  pin_code text,
  gstin text,
  phone text,
  accent_color text not null default '#D9A441',
  invoice_prefix text not null default 'INV-',
  gst_rate numeric(5, 2) not null default 18.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. SHOP MEMBERS TABLE
create table if not exists public.shop_members (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'owner',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint shop_member_unique unique (shop_id, profile_id)
);

-- 5. STAFF TABLE
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  role text not null default 'Stylist',
  phone text,
  is_active boolean not null default true,
  target_amount_minor bigint default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. SERVICE CATEGORIES TABLE
create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 7. SERVICES TABLE
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  category_id uuid references public.service_categories(id) on delete set null,
  name text not null,
  price_minor bigint not null default 0,
  duration_minutes integer not null default 30,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8. CUSTOMERS TABLE
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  phone text not null,
  notes text,
  preferred_staff_id uuid references public.staff(id) on delete set null,
  is_starred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 9. OFFERS TABLE
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  description text,
  discount_type text not null default 'percentage',
  discount_value numeric(10, 2) not null default 0,
  conditions jsonb not null default '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 10. APPOINTMENTS TABLE
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  staff_id uuid references public.staff(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  starts_at timestamptz not null,
  duration_minutes integer not null default 45,
  status text not null default 'Not confirmed',
  notes text,
  confirmation_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 11. BILLS TABLE
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  staff_id uuid references public.staff(id) on delete set null,
  invoice_number text not null,
  status text not null default 'paid',
  subtotal_minor bigint not null default 0,
  discount_minor bigint not null default 0,
  tax_minor bigint not null default 0,
  total_minor bigint not null default 0,
  notes text,
  issued_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_invoice_unique unique (shop_id, invoice_number)
);

-- 12. BILL ITEMS TABLE (Snapshots service info at time of billing)
create table if not exists public.bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  service_name_snapshot text not null,
  quantity integer not null default 1,
  unit_price_minor bigint not null default 0,
  discount_minor bigint not null default 0,
  tax_minor bigint not null default 0,
  line_total_minor bigint not null default 0,
  staff_id uuid references public.staff(id) on delete set null
);

-- 13. PAYMENTS TABLE
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  bill_id uuid not null references public.bills(id) on delete cascade,
  amount_minor bigint not null default 0,
  method text not null default 'UPI',
  status text not null default 'completed',
  reference text,
  paid_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 14. EXPENSE CATEGORIES TABLE
create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  name text not null,
  is_active boolean not null default true
);

-- 15. EXPENSES TABLE
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  category_id uuid references public.expense_categories(id) on delete set null,
  note text not null,
  amount_minor bigint not null default 0,
  payment_method text not null default 'UPI',
  expense_date date not null default current_date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 16. SHOP SETTINGS TABLE
create table if not exists public.shop_settings (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  appointment_reminder_enabled boolean not null default true,
  payment_followup_enabled boolean not null default true,
  daily_closing_enabled boolean not null default true,
  daily_closing_time text not null default '21:00',
  appointment_reminder_minutes integer not null default 180,
  payment_followup_interval_days integer not null default 3,
  updated_at timestamptz not null default now()
);

-- 17. WHATSAPP TEMPLATES TABLE
create table if not exists public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete cascade,
  name text not null,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 18. WHATSAPP CAMPAIGNS TABLE
create table if not exists public.whatsapp_campaigns (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  audience_type text not null,
  template_id uuid references public.whatsapp_templates(id) on delete set null,
  message_body text not null,
  status text not null default 'queued',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 19. WHATSAPP MESSAGES TABLE
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  campaign_id uuid references public.whatsapp_campaigns(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  phone text not null,
  body text not null,
  provider_message_id text,
  status text not null default 'sent',
  sent_at timestamptz not null default now(),
  delivered_at timestamptz,
  failed_at timestamptz,
  error_message text
);

-- 20. REMINDER RULES TABLE
create table if not exists public.reminder_rules (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  type text not null,
  is_enabled boolean not null default true,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 21. AUDIT LOGS TABLE
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ====================================================================
-- INDEXES
-- ====================================================================
create index if not exists idx_shop_members_profile on public.shop_members(profile_id);
create index if not exists idx_shop_members_shop on public.shop_members(shop_id);
create index if not exists idx_customers_shop_phone on public.customers(shop_id, phone);
create index if not exists idx_customers_shop_name on public.customers(shop_id, name);
create index if not exists idx_customers_shop_starred on public.customers(shop_id, is_starred);
create index if not exists idx_appointments_shop_starts on public.appointments(shop_id, starts_at);
create index if not exists idx_appointments_shop_staff on public.appointments(shop_id, staff_id, starts_at);
create index if not exists idx_appointments_shop_cust on public.appointments(shop_id, customer_id, starts_at);
create index if not exists idx_bills_shop_issued on public.bills(shop_id, issued_at);
create index if not exists idx_bills_shop_cust on public.bills(shop_id, customer_id, issued_at);
create index if not exists idx_payments_shop_paid on public.payments(shop_id, paid_at);
create index if not exists idx_expenses_shop_date on public.expenses(shop_id, expense_date);
create index if not exists idx_services_shop on public.services(shop_id);
create index if not exists idx_staff_shop on public.staff(shop_id);

-- ====================================================================
-- RLS HELPER FUNCTION
-- ====================================================================
create or replace function public.is_shop_member(target_shop_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.shop_members
    where shop_id = target_shop_id
      and profile_id = auth.uid()
      and is_active = true
  );
$$;

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.shop_members enable row level security;
alter table public.staff enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.customers enable row level security;
alter table public.offers enable row level security;
alter table public.appointments enable row level security;
alter table public.bills enable row level security;
alter table public.bill_items enable row level security;
alter table public.payments enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.shop_settings enable row level security;
alter table public.whatsapp_templates enable row level security;
alter table public.whatsapp_campaigns enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.reminder_rules enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles: Users can view & update their own profile, or view members in their shops
create policy "profiles_select" on public.profiles
  for select using (
    id = auth.uid() or
    exists (
      select 1 from public.shop_members sm1
      join public.shop_members sm2 on sm1.shop_id = sm2.shop_id
      where sm1.profile_id = auth.uid() and sm2.profile_id = profiles.id
    )
  );

create policy "profiles_insert" on public.profiles
  for insert with check (id = auth.uid());

create policy "profiles_update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Shops: Shop members can read/update their shops; authenticated users can insert new shops
create policy "shops_select" on public.shops
  for select using (is_shop_member(id));

create policy "shops_insert" on public.shops
  for insert with check (auth.uid() is not null);

create policy "shops_update" on public.shops
  for update using (is_shop_member(id));

-- Shop members:
create policy "shop_members_select" on public.shop_members
  for select using (is_shop_member(shop_id) or profile_id = auth.uid());

create policy "shop_members_insert" on public.shop_members
  for insert with check (is_shop_member(shop_id) or profile_id = auth.uid());

create policy "shop_members_update" on public.shop_members
  for update using (is_shop_member(shop_id));

create policy "shop_members_delete" on public.shop_members
  for delete using (is_shop_member(shop_id));

-- Macro policies for shop-scoped entities
-- Staff
create policy "staff_select" on public.staff for select using (is_shop_member(shop_id));
create policy "staff_insert" on public.staff for insert with check (is_shop_member(shop_id));
create policy "staff_update" on public.staff for update using (is_shop_member(shop_id));
create policy "staff_delete" on public.staff for delete using (is_shop_member(shop_id));

-- Service categories
create policy "service_categories_select" on public.service_categories for select using (is_shop_member(shop_id));
create policy "service_categories_insert" on public.service_categories for insert with check (is_shop_member(shop_id));
create policy "service_categories_update" on public.service_categories for update using (is_shop_member(shop_id));
create policy "service_categories_delete" on public.service_categories for delete using (is_shop_member(shop_id));

-- Services
create policy "services_select" on public.services for select using (is_shop_member(shop_id));
create policy "services_insert" on public.services for insert with check (is_shop_member(shop_id));
create policy "services_update" on public.services for update using (is_shop_member(shop_id));
create policy "services_delete" on public.services for delete using (is_shop_member(shop_id));

-- Customers
create policy "customers_select" on public.customers for select using (is_shop_member(shop_id));
create policy "customers_insert" on public.customers for insert with check (is_shop_member(shop_id));
create policy "customers_update" on public.customers for update using (is_shop_member(shop_id));
create policy "customers_delete" on public.customers for delete using (is_shop_member(shop_id));

-- Offers
create policy "offers_select" on public.offers for select using (is_shop_member(shop_id));
create policy "offers_insert" on public.offers for insert with check (is_shop_member(shop_id));
create policy "offers_update" on public.offers for update using (is_shop_member(shop_id));
create policy "offers_delete" on public.offers for delete using (is_shop_member(shop_id));

-- Appointments
create policy "appointments_select" on public.appointments for select using (is_shop_member(shop_id));
create policy "appointments_insert" on public.appointments for insert with check (is_shop_member(shop_id));
create policy "appointments_update" on public.appointments for update using (is_shop_member(shop_id));
create policy "appointments_delete" on public.appointments for delete using (is_shop_member(shop_id));

-- Bills
create policy "bills_select" on public.bills for select using (is_shop_member(shop_id));
create policy "bills_insert" on public.bills for insert with check (is_shop_member(shop_id));
create policy "bills_update" on public.bills for update using (is_shop_member(shop_id));
create policy "bills_delete" on public.bills for delete using (is_shop_member(shop_id));

-- Bill items
create policy "bill_items_select" on public.bill_items for select using (
  exists (select 1 from public.bills b where b.id = bill_items.bill_id and is_shop_member(b.shop_id))
);
create policy "bill_items_insert" on public.bill_items for insert with check (
  exists (select 1 from public.bills b where b.id = bill_items.bill_id and is_shop_member(b.shop_id))
);
create policy "bill_items_update" on public.bill_items for update using (
  exists (select 1 from public.bills b where b.id = bill_items.bill_id and is_shop_member(b.shop_id))
);
create policy "bill_items_delete" on public.bill_items for delete using (
  exists (select 1 from public.bills b where b.id = bill_items.bill_id and is_shop_member(b.shop_id))
);

-- Payments
create policy "payments_select" on public.payments for select using (is_shop_member(shop_id));
create policy "payments_insert" on public.payments for insert with check (is_shop_member(shop_id));
create policy "payments_update" on public.payments for update using (is_shop_member(shop_id));

-- Expense categories
create policy "expense_categories_select" on public.expense_categories for select using (
  shop_id is null or is_shop_member(shop_id)
);
create policy "expense_categories_insert" on public.expense_categories for insert with check (
  shop_id is null or is_shop_member(shop_id)
);

-- Expenses
create policy "expenses_select" on public.expenses for select using (is_shop_member(shop_id));
create policy "expenses_insert" on public.expenses for insert with check (is_shop_member(shop_id));
create policy "expenses_update" on public.expenses for update using (is_shop_member(shop_id));
create policy "expenses_delete" on public.expenses for delete using (is_shop_member(shop_id));

-- Shop settings
create policy "shop_settings_select" on public.shop_settings for select using (is_shop_member(shop_id));
create policy "shop_settings_insert" on public.shop_settings for insert with check (is_shop_member(shop_id));
create policy "shop_settings_update" on public.shop_settings for update using (is_shop_member(shop_id));

-- WhatsApp tables
create policy "whatsapp_templates_select" on public.whatsapp_templates for select using (
  shop_id is null or is_shop_member(shop_id)
);
create policy "whatsapp_campaigns_all" on public.whatsapp_campaigns for all using (is_shop_member(shop_id));
create policy "whatsapp_messages_all" on public.whatsapp_messages for all using (is_shop_member(shop_id));
create policy "reminder_rules_all" on public.reminder_rules for all using (is_shop_member(shop_id));
create policy "audit_logs_all" on public.audit_logs for all using (is_shop_member(shop_id));
