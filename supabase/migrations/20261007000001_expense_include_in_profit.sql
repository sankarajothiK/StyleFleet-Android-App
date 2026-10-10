-- ====================================================================
-- EXPENSES: owner chooses whether an expense counts against profit
-- ====================================================================
-- true  (default) = subtracted from profit, as every expense was before
-- false           = saved and listed, but Net Profit ignores it
--                   (for example the owner's personal spending)
alter table public.expenses
  add column if not exists include_in_profit boolean not null default true;

comment on column public.expenses.include_in_profit is
  'false = kept in the expense list but not subtracted when profit is calculated';
