# AGENTS.md — Salon OS Build Instructions

## Mission

Build the supplied Salon OS prototype as a production Expo + React Native + Supabase application.

## Absolute rules

### 1. Do not redesign
Do not change:
- colors
- fonts
- spacing
- layouts
- labels
- navigation
- screen hierarchy
- component behavior
- interaction flow

unless explicitly instructed.

### 2. Prototype is the UI source of truth
Use the supplied prototype to reproduce the UI and flow exactly.

If the prototype and another document conflict, identify the conflict rather than silently inventing a solution.

### 3. Real data only
Do not use fake/mock business data in production screens.

Prototype data may be used only for development seed data and must be clearly isolated.

### 4. Architecture
Use:

UI
→ Screen/component
→ Hook/view model
→ Domain service
→ Repository/data layer
→ Supabase

Do not scatter raw Supabase queries throughout UI components.

### 5. Authentication
Use Supabase Auth for real authentication and session handling.

Do not simulate authentication with conditions such as OTP length checks.

### 6. Security
Never place these in the Expo client:
- service-role Supabase key
- database password
- private provider API key
- OTP secret
- webhook signing secret

### 7. RLS
Every client-accessible business table must have Row Level Security.

Authorization must be based on authenticated membership in the relevant shop.

### 8. No silent assumptions
If a requirement is ambiguous:
1. inspect the prototype
2. inspect project documents
3. document the ambiguity
4. do not invent behavior

Known ambiguity: the source mentions a 6-digit PIN in documentation but the actual OTP UI contains four boxes.

### 9. Persistent vs local state
Local state is appropriate for:
- open/closed modal
- navigation state
- search text
- temporary unsaved form fields
- selected filters

Persistent business state must live in Supabase.

### 10. Financial correctness
Never hardcode sales totals, dues, revenue, expenses or customer lifetime spend.

Bills, bill items and payments must be persisted consistently.

Use a precise money representation.

### 11. Mutations
Every mutation must:
- validate
- prevent duplicate submission
- show progress
- handle errors
- confirm success
- refresh/update state

### 12. Data loading
Every data-dependent screen needs:
- loading
- loaded
- empty
- error
- retry

Never hide failed database reads behind fake values.

### 13. Type safety
Use TypeScript.
Do not introduce `any` simply to silence errors.

### 14. Database-first feature implementation
Before implementing a persistent feature:
- identify entities
- identify relations
- identify constraints
- identify RLS
- implement repository/service
- connect UI

### 15. Integration secrets
Private API calls must go through a secure server-side boundary such as a Supabase Edge Function.

### 16. Development order
1. Project foundation
2. Auth/session
3. Shop registration
4. Customers
5. Staff
6. Services/pricing
7. Appointments
8. Billing
9. Payments/invoices
10. Expenses
11. Accounts
12. Reminders
13. WhatsApp
14. Profile/settings
15. Full QA

### 17. QA loop
For every feature:

PLAN → IMPLEMENT → TYPECHECK → TEST → AUDIT → FIX → VERIFY

### 18. Stop conditions
Stop and report instead of guessing when:
- a source requirement conflicts
- a required API contract is unknown
- credentials/configuration are missing
- a security decision is ambiguous
- exact UI behavior cannot be established

### 19. Definition of done
No feature is complete until its UI, database persistence, security, error handling and restart persistence have all been verified.
