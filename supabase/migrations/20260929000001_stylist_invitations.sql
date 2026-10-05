-- Migration: Add invitation tracking columns to staff table
alter table public.staff 
add column if not exists invitation_status text default 'not_invited',
add column if not exists invited_at timestamptz;

comment on column public.staff.invitation_status is 'Status: not_invited | invited | active';
