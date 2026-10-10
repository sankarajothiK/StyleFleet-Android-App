-- Run on the NEW database after every data copy (safe to repeat).
-- 1. Links stored in rows still point at the old project's storage; the files now live in the new one.
update public.bills set pdf_url   = replace(pdf_url,   'scgokpcoyfewrtrwqxpu.supabase.co', 'nqwgxkdpwpgqkezaqsrx.supabase.co') where pdf_url   like '%scgokpcoyfewrtrwqxpu%';
update public.shops set logo_path = replace(logo_path, 'scgokpcoyfewrtrwqxpu.supabase.co', 'nqwgxkdpwpgqkezaqsrx.supabase.co') where logo_path like '%scgokpcoyfewrtrwqxpu%';

-- 2. Dues columns are new, so derive them from payments for every copied bill.
update public.bills b set
  paid_amount_minor = case when b.status = 'paid' then b.total_minor
                           else coalesce((select sum(p.amount_minor) from public.payments p where p.bill_id = b.id and p.status = 'completed'), 0) end,
  due_amount_minor  = case when b.status in ('pending','partially_paid')
                           then greatest(b.total_minor - coalesce((select sum(p.amount_minor) from public.payments p where p.bill_id = b.id and p.status = 'completed'), 0), 0)
                           else 0 end;
update public.customers c set outstanding_due_minor = coalesce((
  select sum(b.due_amount_minor) from public.bills b where b.customer_id = c.id and b.status in ('pending','partially_paid')), 0);
