-- Migration: Add permissions column to staff table for Stylist Access Control
alter table public.staff 
add column if not exists permissions jsonb default '{"customers": true, "sales": true, "appointments": true, "expenses": false, "reports": false, "team": false, "reminders": true, "profile": false}'::jsonb;

-- Add index on phone and is_active for fast stylist lookup
create index if not exists idx_staff_phone_active on public.staff (phone, is_active);
