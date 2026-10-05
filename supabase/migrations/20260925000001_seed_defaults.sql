-- ====================================================================
-- SALON OS — SHOP INITIALIZATION FUNCTION & SEED DEFAULTS
-- ====================================================================

create or replace function public.initialize_shop_defaults(new_shop_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. Default Service Categories
  insert into public.service_categories (shop_id, name, sort_order, is_active) values
    (new_shop_id, 'Hair', 1, true),
    (new_shop_id, 'Beard', 2, true),
    (new_shop_id, 'Colour', 3, true),
    (new_shop_id, 'Care', 4, true),
    (new_shop_id, 'Packages', 5, true)
  on conflict do nothing;

  -- 2. Default Expense Categories
  insert into public.expense_categories (shop_id, name, is_active) values
    (new_shop_id, 'Products & stock', true),
    (new_shop_id, 'Salaries', true),
    (new_shop_id, 'Rent', true),
    (new_shop_id, 'Electricity', true),
    (new_shop_id, 'Marketing', true),
    (new_shop_id, 'Maintenance', true)
  on conflict do nothing;

  -- 3. Default Reminder Rules
  insert into public.reminder_rules (shop_id, type, is_enabled, configuration) values
    (new_shop_id, 'appointment_reminder', true, '{"label": "Appointment reminder · 3 hours before", "hours_before": 3}'::jsonb),
    (new_shop_id, 'payment_due_followup', true, '{"label": "Payment due follow-up · every 3 days", "interval_days": 3}'::jsonb),
    (new_shop_id, 'daily_closing', true, '{"label": "Daily closing summary · 9:00 pm", "time": "21:00"}'::jsonb)
  on conflict do nothing;

  -- 4. Default Shop Settings
  insert into public.shop_settings (
    shop_id,
    appointment_reminder_enabled,
    payment_followup_enabled,
    daily_closing_enabled,
    daily_closing_time,
    appointment_reminder_minutes,
    payment_followup_interval_days
  ) values (
    new_shop_id,
    true,
    true,
    true,
    '21:00',
    180,
    3
  )
  on conflict (shop_id) do nothing;

  -- 5. Default WhatsApp Templates
  insert into public.whatsapp_templates (shop_id, name, body, is_active) values
    (
      new_shop_id,
      'Monthly offer',
      'Hi [name] — [offer] at [shop] this month: beard colour free with any haircut, Mon–Wed. Reply BOOK and we’ll hold your chair.',
      true
    ),
    (
      new_shop_id,
      'Rebook nudge',
      'Hi [name], it’s been a while. Your last cut at [shop] was 6 weeks ago — shall we keep your usual Saturday slot? Reply YES and we’ll confirm.',
      true
    ),
    (
      new_shop_id,
      'Birthday',
      'Happy birthday, [name]! From everyone at [shop] — [offer] on any service this week. Just show this message at the desk.',
      true
    )
  on conflict do nothing;

  -- 6. Default Offers
  insert into public.offers (shop_id, name, description, discount_type, discount_value, is_active) values
    (new_shop_id, 'Mon–Wed colour', '20% off all colour services, weekdays', 'percentage', 20.00, true),
    (new_shop_id, 'Cut + beard combo', 'Both for ₹450 instead of ₹500', 'fixed', 50.00, true),
    (new_shop_id, 'Refer a friend', '₹100 off the next visit for both', 'fixed', 100.00, false)
  on conflict do nothing;

end;
$$;
