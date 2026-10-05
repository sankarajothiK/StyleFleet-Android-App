# Salon OS — Project Requirements Document

**Version:** 1.0  
**Status:** Build contract  
**Source of truth:** Supplied Salon OS prototype  
**Stack:** Expo + React Native + Supabase

## 1. Core rule

The supplied prototype is the authoritative reference for UI, terminology, navigation, screen hierarchy and user flow.

Do not redesign, simplify, recolor, rearrange, rename or reinterpret the supplied UI unless the product owner explicitly approves the change.

The production application must replace prototype/mock state with real Supabase persistence.

## 2. Product scope

Primary navigation:
- Customers
- Sales
- Accounts

Operational features include:
- Customer management
- Billing
- Invoices
- Expenses
- Appointments
- Reminders
- Bulk WhatsApp
- Team/staff
- Price & offers
- Shop profile

## 3. Authentication/onboarding

Flow:
1. Phone
2. OTP
3. Register shop
4. Add team
5. Finish setup
6. Main application

Sign-in:
- Logo
- Mobile number
- +91 country code
- Send OTP
- Register new shop

OTP:
- Four visible OTP boxes in the supplied UI
- Verify & continue
- Resend behavior
- Real authentication in production

Registration:
- Shop name
- Owner name
- Address
- City
- PIN code
- Optional GSTIN
- Team/staff setup

Important source ambiguity:
The prototype documentation mentions a 6-digit PIN in one place, while the actual sign-in UI uses a 4-digit OTP. The actual OTP UI is authoritative unless the product owner explicitly changes it.

## 4. Customers

Customer list must support:
- Search
- All filter
- Starred/MVP filter
- Dues filter
- Add customer
- Customer rows
- Name
- Phone
- Visits
- Last visit
- Preferred stylist
- Lifetime spend
- Due
- Star/favorite

Customer detail must support the information and actions shown by the prototype, including customer statistics, notes, recent visits and starting a bill.

All persistent customer changes must reach Supabase.

## 5. Sales

Sales must support:
- Day/Week/Month periods
- Total sales
- Bill count
- Average bill
- Top service
- Sales visualization
- Payment-mode breakdown
- Bill list
- New bill

All values must be calculated from real persisted data.

## 6. Billing

New bill must support:
- Walk-in/customer
- Service selection
- Categories
- Selected services
- Stylist
- Payment method
- Subtotal
- Discount
- GST
- Total
- Proceed to invoice

Production bills must persist:
- Bill
- Bill items
- Payment(s)
- Customer when applicable
- Staff/stylist when applicable
- Invoice number
- Financial totals

Prototype discount/tax examples are reference behavior only and must not become universal hardcoded values.

## 7. Invoice

Invoice must show the fields represented in the prototype:
- Invoice number
- Date/time
- Shop information
- GSTIN when configured
- Customer
- Stylist
- Items
- Subtotal
- Discount
- GST
- Total
- Payment mode

Actions:
- WhatsApp
- PDF
- Print

## 8. Accounts

Accounts must show financial information derived from real data:
- Income
- Expenses
- Net
- Margin
- Dues
- Period summaries
- Expense categories

Tools:
- Expenses
- Appointments
- Reminders
- Bulk WhatsApp
- Team
- Price & offers
- Shop profile

## 9. Expenses

Support:
- Expense category
- Amount
- Note
- Date
- Payment method
- Save
- List/filtering as represented by prototype

Expenses must persist and affect Accounts calculations.

## 10. Appointments

Support:
- Day/date
- Appointment count
- Expected amount
- Time
- Duration
- Customer
- Service
- Stylist
- Amount
- Status

Prototype status concepts:
- Not confirmed
- Confirmed
- In chair
- Done

Actions represented by prototype:
- Confirm
- Mark arrived
- Bill & close
- Billed
- Remind
- Rebook

Booking:
- Customer
- Service
- Date
- Available slot
- Confirmation
- Confirm booking
- Optional WhatsApp confirmation

Availability must use persisted appointments/business rules, not hardcoded slots.

## 11. Reminders

Support the reminder concepts represented by the prototype:
- Appointment reminder
- Payment due follow-up
- Daily closing
- Today/upcoming views

Reminder settings must persist if exposed in the final UI.

## 12. Bulk WhatsApp

Audience concepts:
- All customers
- Starred/MVP
- Service/behavior groups shown by prototype
- Not seen in 60 days

Template concepts:
- Monthly offer
- Rebook nudge
- Birthday

Support placeholders represented by prototype:
- [name]
- [offer]
- [shop]

Sending must use a secure integration. Never claim delivery without provider confirmation.

## 13. Team

Team/staff must support the information and actions shown by the prototype:
- Staff list
- Role
- Revenue
- Service count
- Target
- Rebook rate
- Rating
- Chair utilization
- Add/remove staff

Authentication users and staff business records must remain conceptually separate.

## 14. Price & offers

Services:
- Categories
- Name
- Price
- Add
- Delete/deactivate

Prototype categories:
- Hair
- Beard
- Colour
- Care
- Packages

Offers:
- Name
- Description
- Active/inactive
- Create
- Delete/deactivate

## 15. Shop profile

Support:
- Logo
- Shop name
- Address
- City
- PIN
- Owner
- Login number
- GSTIN
- Team count
- Invoice prefix
- GST on services
- Theme accent
- Sign out

Prototype accent choices include:
- #D9A441
- #E0C068
- #B8863B
- #8C6239

Logo/theme behavior must follow the supplied prototype.

## 16. Data requirements

Persistent production data must include, as applicable:
- shops
- profiles
- shop members
- staff
- customers
- service categories
- services
- offers
- appointments
- bills
- bill items
- payments
- expense categories
- expenses
- shop settings
- messaging/campaign records
- reminder configuration
- audit records where required

Prototype arrays are not production data.

## 17. Security requirements

- Use Supabase Auth.
- Enable RLS.
- Scope business data to the authenticated user's shop membership.
- Never expose service-role/secret credentials in Expo.
- Keep private third-party API keys server-side.
- Use Supabase Edge Functions when private provider credentials are required.

## 18. Definition of done

A feature is complete only when:
- UI matches prototype
- Navigation matches prototype
- Validation works
- Loading works
- Empty state works
- Error/retry works
- Create persists
- Read retrieves
- Update persists
- Delete/deactivate behaves correctly
- Relationships are correct
- RLS is verified
- Session behavior works
- Duplicate submissions are guarded
- Network failure is handled
- TypeScript is clean
- Production mock data is removed
- App restart preserves required data
