-- ====================================================================
-- STYLIST LIMIT (per-shop, raised by support) + STAFF WRITE GUARD
-- ====================================================================

-- 1. Per-shop stylist cap. Default 3; support raises it with:
--    update public.shops set max_stylists = 5 where id = '<shop uuid>';
alter table public.shops
  add column if not exists max_stylists integer not null default 3
  check (max_stylists >= 0);

-- 2. Owner / manager check
create or replace function public.is_shop_owner(target_shop_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.shops
    where id = target_shop_id and owner_profile_id = auth.uid()
  ) or exists (
    select 1 from public.shop_members
    where shop_id = target_shop_id
      and profile_id = auth.uid()
      and role in ('owner', 'manager')
      and is_active = true
  );
$$;

-- 3. Enforce the cap on insert and on re-activation (auth.uid() is null for
--    service role / SQL editor, so support is never blocked).
create or replace function public.enforce_staff_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max integer;
  v_active integer;
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.is_active is not true then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.is_active is true and new.shop_id = old.shop_id then
    return new;
  end if;

  select max_stylists into v_max from public.shops where id = new.shop_id;
  select count(*) into v_active
  from public.staff
  where shop_id = new.shop_id
    and is_active = true
    and id <> new.id;

  if v_active >= coalesce(v_max, 3) then
    raise exception 'STYLIST_LIMIT_REACHED: Maximum % stylists allowed. Contact StyleFleet support to add more.', coalesce(v_max, 3)
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_staff_limit on public.staff;
create trigger trg_enforce_staff_limit
  before insert or update of is_active, shop_id on public.staff
  for each row execute function public.enforce_staff_limit();

-- 4. Only the owner/manager may change what a stylist can do. A stylist can
--    still link their own row on first login (profile_id / invitation_status).
create or replace function public.guard_staff_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_shop_owner(old.shop_id) then
    return new;
  end if;

  if new.permissions is distinct from old.permissions
     or new.is_active is distinct from old.is_active
     or new.role is distinct from old.role
     or new.phone is distinct from old.phone
     or new.shop_id is distinct from old.shop_id then
    raise exception 'FORBIDDEN: Only the salon owner can change stylist access.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_staff_privileged on public.staff;
create trigger trg_guard_staff_privileged
  before update on public.staff
  for each row execute function public.guard_staff_privileged_columns();

-- 5. Replace the wide-open write policies. SELECT stays open because the
--    invite screen looks a stylist up by phone before they have a session.
drop policy if exists "staff_insert" on public.staff;
create policy "staff_insert" on public.staff
  for insert with check (public.is_shop_owner(shop_id));

drop policy if exists "staff_update" on public.staff;
create policy "staff_update" on public.staff
  for update using (public.is_shop_member(shop_id))
  with check (public.is_shop_member(shop_id));

drop policy if exists "staff_delete" on public.staff;
create policy "staff_delete" on public.staff
  for delete using (public.is_shop_owner(shop_id));
