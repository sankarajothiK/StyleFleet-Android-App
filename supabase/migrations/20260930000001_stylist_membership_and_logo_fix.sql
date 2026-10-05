-- ====================================================================
-- SALON OS — STYLIST MEMBERSHIP, RLS & LOGO STORAGE FIX
-- ====================================================================

-- 1. Ensure is_shop_member allows stylists linked by profile_id OR staff phone
create or replace function public.is_shop_member(target_shop_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    -- Direct shop members (owner, manager, stylist)
    select 1 from public.shop_members
    where shop_id = target_shop_id
      and profile_id = auth.uid()
      and is_active = true
  ) or exists (
    -- Stylists linked in staff table by profile_id
    select 1 from public.staff
    where shop_id = target_shop_id
      and profile_id = auth.uid()
      and is_active = true
  ) or exists (
    -- Stylists linked by matching profile phone number
    select 1 from public.staff s
    join public.profiles p on p.id = auth.uid()
    where s.shop_id = target_shop_id
      and s.is_active = true
      and (
        s.phone = p.phone
        or right(regexp_replace(s.phone, '\D', '', 'g'), 10) = right(regexp_replace(p.phone, '\D', '', 'g'), 10)
      )
  ) or exists (
    -- Shop owner
    select 1 from public.shops
    where id = target_shop_id
      and owner_profile_id = auth.uid()
  );
$$;

-- 2. Secure RPC to link stylist to shop_members upon verified OTP login
create or replace function public.join_shop_as_stylist(p_shop_id uuid, p_phone text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_phone text;
  v_staff_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  v_clean_phone := right(regexp_replace(p_phone, '\D', '', 'g'), 10);

  -- Check if staff exists in this shop with this phone
  select id into v_staff_id
  from public.staff
  where shop_id = p_shop_id
    and right(regexp_replace(phone, '\D', '', 'g'), 10) = v_clean_phone
    and is_active = true
  limit 1;

  if v_staff_id is null then
    return false;
  end if;

  -- Link staff profile_id
  update public.staff
  set profile_id = auth.uid(),
      invitation_status = 'active',
      updated_at = now()
  where id = v_staff_id;

  -- Add/update shop_members
  insert into public.shop_members (shop_id, profile_id, role, is_active)
  values (p_shop_id, auth.uid(), 'stylist', true)
  on conflict (shop_id, profile_id)
  do update set is_active = true, role = 'stylist';

  return true;
end;
$$;

-- 3. Ensure public access to logos folder in invoices bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', true, 10485760, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true;
