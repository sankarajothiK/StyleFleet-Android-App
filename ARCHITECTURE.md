# Salon OS — Architecture Document

## Stack

- Expo
- React Native
- TypeScript
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage
- Supabase Edge Functions where private server-side integrations are needed

## High-level architecture

React Native / Expo
→ Navigation
→ Screens
→ Reusable Components
→ Hooks/View Models
→ Domain Services
→ Repositories
→ Supabase

Supabase:
- Auth
- PostgreSQL
- Storage
- Edge Functions

## Project organization

Recommended:

src/
- components/
- screens/
  - auth/
  - customers/
  - sales/
  - accounts/
  - appointments/
  - reminders/
  - whatsapp/
  - staff/
  - pricing/
  - profile/
- navigation/
- hooks/
- services/
- repositories/
- lib/
- types/
- utils/
- constants/
- theme/
- validation/

Equivalent organization is acceptable if the same separation is maintained.

## Navigation

Unauthenticated:
- Phone
- OTP
- Register
- Workers

Authenticated:
- Customers
- Sales
- Accounts

Secondary/detail screens:
- Customer
- Bill
- Invoice
- Sent
- Expenses
- Appointments
- Booking
- Reminders
- Bulk
- Bulk Sent
- Staff
- Pricing
- Profile

## Authentication architecture

Use Supabase Auth.

Required:
- session detection
- session restoration
- protected navigation
- OTP verification
- resend
- expiry/error handling
- sign out
- expired-session handling

Never implement fake authentication.

## Identity model

Authentication identity is separate from business staff identity.

Conceptual:

auth.users
→ profiles
→ shop_members
→ shops

A staff record may optionally be linked to a profile.

## Data access

Example:

CustomerScreen
→ useCustomers()
→ customerService
→ customerRepository
→ Supabase

UI should not contain duplicated raw queries.

## Generated types

Use generated Supabase database types across repositories and services.

## Forms

Every form must specify:
- required fields
- format
- max length
- numeric constraints
- validation messages

## Financial architecture

Bill:
- bill header
- bill items
- payments

Historical bill items must retain service name/price snapshots so later service-price changes do not rewrite old invoices.

Use integer paise or PostgreSQL numeric consistently.

## Bill creation

1. Validate input.
2. Calculate line totals.
3. Apply discount.
4. Calculate tax.
5. Calculate total.
6. Persist bill.
7. Persist items.
8. Persist payment(s).
9. Return invoice information.
10. Refresh UI.

Use an appropriate transaction/RPC/server-side mechanism when multiple writes must be atomic.

## Appointment architecture

Appointment references:
- shop
- customer
- service
- staff
- start time
- duration
- status

Availability must derive from:
- business hours
- staff availability
- existing appointments
- service duration

No hardcoded production slot arrays.

## Customer metrics

Derive from real records:
- lifetime spend
- visits
- average bill
- outstanding dues

## Sales

Sales dashboard data must be derived from persisted financial records.

## Accounts

Accounts derives:
- income
- expenses
- net
- dues
- category totals
- period summaries

## Storage

Shop logo:
- Supabase Storage
- shop-scoped path
- database stores file path/reference

Storage policies must enforce shop membership.

## WhatsApp/API integrations

Private credentials stay server-side.

Preferred:

Expo
→ Supabase Edge Function
→ provider API

Persist send/campaign/message status.

Do not report delivery unless provider data confirms it.

## Error handling

Map technical failures to safe user messages:
- network unavailable
- session expired
- validation error
- permission denied
- duplicate record
- database unavailable
- provider unavailable

Never expose secrets or raw SQL.

## Offline/network behavior

At minimum:
- preserve unsaved form state while active
- show network failure
- provide retry
- never claim a write succeeded without confirmation

## Performance

Use:
- pagination
- filtered queries
- appropriate indexes
- aggregates/RPCs where useful

Avoid:
- full-table reads
- N+1 queries
- loading complete historical data for small dashboard widgets

## Testing

Required critical flows:
- authentication
- onboarding
- session restore
- customer create/edit
- appointment creation
- bill creation
- payment
- invoice
- expense
- offer update
- profile update
- sign out
- RLS isolation

Use unit/integration/E2E tests appropriate to each layer.
