-- Expenses: optionally link an expense to a team member (null = ordinary shop expense)
alter table public.expenses
  add column if not exists staff_id uuid references public.staff(id) on delete set null;

create index if not exists idx_expenses_staff on public.expenses(staff_id);

comment on column public.expenses.staff_id is
  'optional: the team member this expense is for (salary, advance, commission)';
