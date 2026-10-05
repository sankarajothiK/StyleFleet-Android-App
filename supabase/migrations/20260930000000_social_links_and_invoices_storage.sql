-- ====================================================================
-- SALON OS — SOCIAL MEDIA LINKS, STORAGE & VERSION CONTROL MIGRATION
-- ====================================================================

-- 1. Add social_links column to shops table
alter table public.shops 
add column if not exists social_links jsonb default '{}'::jsonb;

-- 2. Add pdf_url column to bills table
alter table public.bills 
add column if not exists pdf_url text;

-- 3. Create public storage bucket for invoice PDFs
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', true, 10485760, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do update set public = true;

-- Storage RLS policies for invoices bucket
drop policy if exists "Public Access Invoices" on storage.objects;
create policy "Public Access Invoices" on storage.objects 
for select using (bucket_id = 'invoices');

drop policy if exists "Authenticated Insert Invoices" on storage.objects;
create policy "Authenticated Insert Invoices" on storage.objects 
for insert with check (bucket_id = 'invoices');

drop policy if exists "Anon Insert Invoices" on storage.objects;
create policy "Anon Insert Invoices" on storage.objects 
for insert with check (bucket_id = 'invoices');

drop policy if exists "Authenticated Update Invoices" on storage.objects;
create policy "Authenticated Update Invoices" on storage.objects 
for update using (bucket_id = 'invoices');

-- 4. Create App Version Config table for mandatory update enforcement
create table if not exists public.app_version_config (
  id text primary key default 'global',
  min_required_version text not null default '1.0.0',
  latest_version text not null default '1.0.1',
  is_mandatory boolean not null default false,
  release_notes text,
  play_store_url text not null default 'https://play.google.com/store/apps/details?id=com.stylefleet.app',
  app_store_url text not null default 'https://apps.apple.com/app/id6742398471',
  updated_at timestamptz not null default now()
);

alter table public.app_version_config enable row level security;

drop policy if exists "Allow read app_version_config to all" on public.app_version_config;
create policy "Allow read app_version_config to all" 
on public.app_version_config for select using (true);

-- Seed default global version config
insert into public.app_version_config (id, min_required_version, latest_version, is_mandatory, release_notes)
values ('global', '1.0.0', '1.0.1', false, 'Standard stability and feature update.')
on conflict (id) do update set updated_at = now();
