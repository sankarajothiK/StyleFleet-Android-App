# Salon OS — Database Setup Document

## 1. Purpose

This is the Supabase production data contract.

The prototype's local arrays are reference/demo data only.

## 2. Principles

- PostgreSQL is the persistent source of truth.
- UUIDs for primary keys unless a documented exception exists.
- Use foreign keys.
- Use constraints.
- Use timestamps with timezone.
- Use RLS on client-accessible business tables.
- Every shop-owned record must be scoped to a shop.
- Use migrations for schema changes.
- Never put secrets in source control.

## 3. Identity

### profiles
Fields:
- id → auth.users.id
- full_name
- phone
- avatar_path
- created_at
- updated_at

### shops
Fields:
- id
- name
- owner_profile_id
- logo_path
- address
- city
- pin_code
- gstin
- phone
- accent_color
- invoice_prefix
- gst_rate
- created_at
- updated_at

### shop_members
Fields:
- id
- shop_id
- profile_id
- role
- is_active
- created_at

Unique:
- shop_id + profile_id

## 4. Staff

### staff
Fields:
- id
- shop_id
- profile_id nullable
- name
- role
- phone
- is_active
- target_amount_minor nullable
- created_at
- updated_at

Staff can exist without an authentication account.

## 5. Customers

### customers
Fields:
- id
- shop_id
- name
- phone
- notes
- preferred_staff_id nullable
- is_starred
- created_at
- updated_at

Indexes:
- shop_id + phone
- shop_id + name
- shop_id + is_starred

Lifetime spend and visit metrics should be derived from financial/visit records rather than duplicated as authoritative values.

## 6. Services

### service_categories
- id
- shop_id
- name
- sort_order
- is_active

### services
- id
- shop_id
- category_id
- name
- price_minor
- duration_minutes
- is_active
- created_at
- updated_at

Prototype categories:
- Hair
- Beard
- Colour
- Care
- Packages

## 7. Offers

### offers
- id
- shop_id
- name
- description
- discount_type
- discount_value
- conditions jsonb
- starts_at
- ends_at
- is_active
- created_at
- updated_at

Prototype offers are examples, not mandatory records for every shop.

## 8. Appointments

### appointments
- id
- shop_id
- customer_id
- staff_id
- service_id
- starts_at
- duration_minutes
- status
- notes
- confirmation_sent_at
- created_at
- updated_at

Prototype statuses:
- not_confirmed
- confirmed
- in_chair
- done
- cancelled

Indexes:
- shop_id + starts_at
- shop_id + staff_id + starts_at
- shop_id + customer_id + starts_at

## 9. Bills

### bills
- id
- shop_id
- customer_id nullable
- staff_id nullable
- invoice_number
- status
- subtotal_minor
- discount_minor
- tax_minor
- total_minor
- notes
- issued_at
- created_by
- created_at
- updated_at

Unique:
- shop_id + invoice_number

### bill_items
- id
- bill_id
- service_id nullable
- service_name_snapshot
- quantity
- unit_price_minor
- discount_minor
- tax_minor
- line_total_minor
- staff_id nullable

Historical snapshots are required so old invoices do not change when service prices change.

## 10. Payments

### payments
- id
- shop_id
- bill_id
- amount_minor
- method
- status
- reference
- paid_at
- created_by
- created_at

Prototype methods:
- UPI
- Cash
- Card

The database should support partial payments if the final business rules require dues.

## 11. Expenses

### expense_categories
- id
- shop_id nullable
- name
- is_active

Prototype categories:
- Products & stock
- Salaries
- Rent
- Electricity
- Marketing
- Maintenance

### expenses
- id
- shop_id
- category_id
- note
- amount_minor
- payment_method
- expense_date
- created_by
- created_at
- updated_at

## 12. Shop settings

### shop_settings
Potential fields:
- shop_id
- appointment_reminder_enabled
- payment_followup_enabled
- daily_closing_enabled
- daily_closing_time
- appointment_reminder_minutes
- payment_followup_interval_days

Only create settings that are actually exposed by the product.

## 13. WhatsApp

### whatsapp_templates
- id
- shop_id
- name
- body
- is_active
- created_at
- updated_at

### whatsapp_campaigns
- id
- shop_id
- name
- audience_type
- template_id
- message_body
- status
- created_by
- created_at

### whatsapp_messages
- id
- shop_id
- campaign_id nullable
- customer_id nullable
- phone
- body
- provider_message_id nullable
- status
- sent_at
- delivered_at nullable
- failed_at nullable
- error_message nullable

Never mark delivery merely because an API request was accepted.

## 14. Reminder configuration

### reminder_rules
- id
- shop_id
- type
- is_enabled
- configuration jsonb
- created_at
- updated_at

## 15. Audit

### audit_logs
- id
- shop_id
- actor_profile_id
- action
- entity_type
- entity_id
- metadata jsonb
- created_at

Use for important financial, security and configuration mutations.

## 16. Storage

Recommended shop logo path:

shops/{shop_id}/logo/{file}

Store the path in the database.

Storage access must be controlled by shop membership.

## 17. RLS model

Concept:

authenticated user
→ shop_members
→ authorized shop_id
→ target.shop_id

SELECT:
- active member of target shop

INSERT:
- authenticated member with permitted role

UPDATE:
- authenticated member with permitted role

DELETE/deactivate:
- authenticated member with permitted role

Never trust a client-supplied shop_id as the only authorization check.

## 18. Roles

At minimum define:
- owner
- front-desk/operational member

Additional roles must be explicitly documented before implementation.

UI visibility is not authorization.

## 19. Indexes

At minimum evaluate indexes for:
- shop membership
- customer phone/name
- starred customers
- appointments by date
- appointments by staff/date
- bills by date
- bills by customer/date
- payments by bill/date
- expenses by date
- WhatsApp messages by campaign/status

## 20. Migration order

1. database types/extensions
2. profiles
3. shops
4. shop_members
5. staff
6. service_categories
7. services
8. customers
9. offers
10. appointments
11. bills
12. bill_items
13. payments
14. expense_categories
15. expenses
16. shop_settings
17. WhatsApp tables
18. reminder rules
19. audit logs
20. RLS policies
21. indexes
22. storage policies

## 21. Development seed data

Prototype examples may be used as development seed data.

Seed data must:
- be development-only
- be isolated from real shops
- never be required for production
- never appear as real customer data in a production shop

## 22. Database acceptance tests

Verify:
- new user can create a shop
- membership is created
- records receive correct shop ownership
- authorized member can read own shop
- member cannot read another shop
- unauthorized writes fail
- customer persists
- service persists
- appointment persists
- bill persists
- bill items persist
- payment persists
- expense persists
- offer changes persist
- profile changes persist
- logo storage is protected
- RLS works directly against the database

## 23. Secrets

Never store in source:
- Supabase service-role key
- database password
- private API keys
- OTP secrets
- webhook signing secrets

Use secure environment/server configuration.
