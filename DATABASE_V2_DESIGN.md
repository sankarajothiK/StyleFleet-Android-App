# StyleFleet Database v2 — Design for Review

Target project: `nqwgxkdpwpgqkezaqsrx` (new Supabase account, region to be confirmed as Mumbai `ap-south-1`).
Status: DESIGN ONLY. No SQL has been written or applied. Nothing in the live project has been touched.

## 1. Why v2 (problems in the live database)

| # | Problem | Evidence |
|---|---------|----------|
| 1 | All row-level security is `USING (true)`, so anyone holding the public key can read, change and delete every shop's data | `20260925000003_fix_rls_and_register_salon.sql` |
| 2 | No real Supabase session after OTP; the app only uses the anonymous role | `otp-service` discards the generated link; `authRepository.verifyOtp` |
| 3 | OTP `123456` signs in any phone number | `authRepository.verifyOtp` |
| 4 | 2Factor API key hardcoded in the client | `authRepository.ts` `TWO_FACTOR_KEY` |
| 5 | Appointment `starts_at` is stored as display text, wrong day and time zone, no end time, no overlap protection | `appointmentRepository.addAppointment`, `BookingScreen` |
| 6 | Schema drift: the app uses columns and tables that no migration creates | `due_amount_minor`, `paid_amount_minor`, `deleted_*`, `is_edited`, `edited_at`, `support_message_answers`, RPC `permanently_delete_salon` |
| 7 | Public, anonymously writable storage bucket for invoices | `20260930000000_social_links_and_invoices_storage.sql` |
| 8 | Telemetry, health and log tables accept inserts from anyone | `20260926000000_telemetry_and_system_health.sql` |
| 9 | Stylist permissions exist only in the app; any member can read and write everything | `staff.permissions` is never checked by the database |
| 10 | Invoice numbers generated on the device can collide across devices | `billingRepository` |

## 2. Principles (from AGENTS.md and DATABASE_SETUP.md)

- UUID primary keys, foreign keys, check constraints, `timestamptz` everywhere.
- Money is `bigint` in minor units (paise). No floats.
- Every shop-owned table has `shop_id` and RLS based on `auth.uid()` membership.
- Soft delete for business records. Hard delete only through the account-deletion function.
- Schema changes only through migrations.
- No secrets in the client.

## 3. Authentication

Use Supabase phone auth with a **Send SMS Hook** instead of the custom `otp-service`.

1. App calls `supabase.auth.signInWithOtp({ phone })`.
2. Supabase generates the OTP and calls the hook Edge Function `send-sms`.
3. `send-sms` verifies the hook signature (`SEND_SMS_HOOK_SECRET`) and sends the OTP through 2Factor.
4. App calls `supabase.auth.verifyOtp({ phone, token })` and receives a real session (JWT).
5. All data access uses that session, so RLS can use `auth.uid()`.

Removed: the `123456` bypass, `demo_session_*` paths, the client-side 2Factor key, and the `otp-service` verify action.

Store reviewers: a fixed test phone number and OTP configured in the Supabase dashboard (Auth, Phone, test numbers). It works only for that number.

Open checks: 2Factor must accept a caller-supplied OTP value; the Send SMS Hook must be available on the chosen plan.

## 4. Tables

Legend: NEW = not in current migrations. FIX = changed from current.

### Identity
- `profiles` (id = auth.users.id, full_name, phone, avatar_path, timestamps). FIX: rows are created from the signed-in user, never with a random id.
- `shops` (name, owner_profile_id, logo_path, address, city, pin_code, gstin, phone, accent_color, invoice_prefix, invoice_numbering_mode, gst_rate, upi_id, social_links jsonb, timezone default `Asia/Kolkata`). NEW: `timezone`.
- `shop_members` (shop_id, profile_id, role check in ('owner','stylist'), is_active). Unique (shop_id, profile_id).
- `staff` (shop_id, profile_id nullable, name, role, phone, is_active, target_amount_minor, rating, permissions jsonb, invitation_status check, invited_at). Unique (shop_id, normalized phone) where active.

### Catalogue
- `service_categories`, `services` (price_minor, duration_minutes, is_active), `offers`.

### Customers
- `customers` (shop_id, name, phone, `phone_normalized` generated = last 10 digits, notes, preferred_staff_id, is_starred, is_active, timestamps). FIX: unique (shop_id, phone_normalized).
- Visit count, lifetime spend and dues are not stored. They are computed from bills (view `customer_stats`).

### Appointments (reworked)
- `appointments` (shop_id, customer_id, customer_name_snapshot, customer_phone_snapshot, starts_at timestamptz, ends_at timestamptz, status check, notes, amount_minor, confirmation_sent_at, is_edited, edited_at, deleted_at, deleted_by, deleted_by_name, deleted_by_role, timestamps). FIX: real timestamps and an end time.
- `appointment_services` NEW (appointment_id, service_id, name_snapshot, quantity, unit_price_minor).
- `appointment_staff` NEW (appointment_id, staff_id, is_owner boolean).
- Overlap rule: exclusion constraint per stylist on the time range (`btree_gist`), ignoring cancelled and deleted appointments.

### Billing
- `bills` (shop_id, customer_id, staff_id, invoice_number, status check, subtotal_minor, discount_minor, tax_minor, tip_minor, total_minor, paid_amount_minor, due_amount_minor, notes, pdf_url, reminder_status, confirmation_status, issued_at, is_edited, edited_at, deleted_at, deleted_by, deleted_by_name, deleted_by_role, created_by, timestamps). Unique (shop_id, invoice_number).
- Checks: `total = subtotal - discount + tax + tip`; `paid + due = total`; all amounts >= 0.
- `bill_items` (name_snapshot, quantity, unit_price_minor, discount_minor, tax_minor, line_total_minor, staff_id).
- `payments` (shop_id, bill_id, amount_minor > 0, method, status, reference, paid_at).
- Trigger: payments are the source of truth. After any payment change, `bills.paid_amount_minor`, `due_amount_minor` and `status` are recomputed.
- `invoice_counters` NEW (shop_id, period, last_seq) and function `next_invoice_number(shop_id)` for atomic numbering across devices.

### Money out and settings
- `expense_categories`, `expenses`, `shop_settings`, `reminder_rules`.

### Messaging
- `whatsapp_templates`, `whatsapp_campaigns`, `whatsapp_messages`.
- `support_messages`, `support_message_answers` NEW to the migrations (the app already uses it), `account_deletions`.

### Platform
- `subscriptions` (writes by Edge Function only), `app_version_config` (public read), `audit_logs`.
- `telemetry`, `system_health`, `system_logs`: insert for signed-in users into their own shops only.

## 5. Row-level security

Helper functions (security definer, fixed `search_path`):
- `is_shop_member(shop_id)`: active row in `shop_members` for `auth.uid()`.
- `shop_role(shop_id)`: 'owner' or 'stylist' or null.
- `has_permission(shop_id, module)`: true for owners; for stylists reads `staff.permissions`.

| Table group | Read | Write |
|---|---|---|
| shops, shop_settings, reminder_rules | members | owner |
| staff, shop_members | members (stylists see names only through a view) | owner |
| services, categories, offers | members | owner |
| customers | `customers` permission | `customers` permission; no hard delete |
| appointments and children | `appointments` permission | `appointments` permission |
| bills, bill_items, payments | `sales` permission | `sales` permission; no hard delete |
| expenses | `expenses` permission | `expenses` permission |
| subscriptions | owner | service role only |
| whatsapp_* | `reminders` permission | `reminders` permission |
| audit_logs | owner | insert by trigger |
| telemetry, system_* | owner | insert into own shop |
| app_version_config | everyone | service role only |

Functions (callable only by signed-in users): `register_salon`, `join_shop_as_stylist`, `next_invoice_number`, `permanently_delete_salon` (owner only). `anon` gets no execute rights on any of them.

Storage:
- `shop-logos`: public read, write only by members into a folder named for their shop id.
- `invoices`: private. Share through short-lived signed links.

## 6. Data migration notes

- Old profile ids were not real auth ids. Each shop owner and stylist is matched by phone number to a new auth user. Owners will need to sign in once.
- Order: auth users, profiles, shops, shop_members, staff, categories, services, customers, appointments (convert text dates to timestamps in Asia/Kolkata), bills, bill_items, payments, expenses.
- Reconcile before cutover: row counts, per-customer spend and dues, per-shop sales totals.
- Appointment edit and delete flags currently live inside the `notes` JSON; they move to real columns.

## 7. Decisions needed before SQL is written

1. Approve phone auth with the Send SMS Hook (section 3).
2. Provide the test phone number for store reviewers (number only, not the OTP).
3. Enforce stylist permissions in the database (section 5).
4. Raise the minimum app version after cutover to retire the insecure login.
5. Invoice PDFs: private bucket with signed links (recommended), or keep public links.

## 8. Inputs needed from you

- A schema-only dump of the live database, so v2 matches every column the app really uses (see problem 6). Run it locally and keep the connection string out of chat.
- Row counts (query provided earlier).
- The region and plan of the new project.
