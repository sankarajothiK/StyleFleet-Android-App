-- Run the SAME file on the old and the new database, then compare the output line by line.

-- 1. Row count of every table in the public schema
select table_name,
       (xpath('/row/c/text()',
              query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint as row_count
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by table_name;

-- 2. Money checks per shop (minor units, so they must match exactly)
select s.id as shop_id,
       s.name,
       (select count(*)                          from public.bills b      where b.shop_id = s.id) as bills,
       (select coalesce(sum(b.total_minor),0)    from public.bills b      where b.shop_id = s.id) as bills_total_minor,
       (select coalesce(sum(p.amount_minor),0)   from public.payments p   where p.shop_id = s.id) as payments_total_minor,
       (select coalesce(sum(e.amount_minor),0)   from public.expenses e   where e.shop_id = s.id) as expenses_total_minor,
       (select count(*)                          from public.customers c  where c.shop_id = s.id) as customers,
       (select count(*)                          from public.appointments a where a.shop_id = s.id) as appointments
from public.shops s
order by s.id;

-- 3. Storage objects (invoice PDFs, logos)
select bucket_id, count(*) as objects from storage.objects group by bucket_id order by bucket_id;
