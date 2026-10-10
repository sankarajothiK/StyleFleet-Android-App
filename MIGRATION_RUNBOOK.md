# Move the database to the new Supabase account

Decision (confirmed): copy the **current schema as-is** and **move all data**. The v2 redesign in
`DATABASE_V2_DESIGN.md` is a later, separate step. New project ref in that design: `nqwgxkdpwpgqkezaqsrx`.

Keep every password and key in your own terminal. Never paste them in chat, and never commit them.

## 0. Before you start
- Create the new project in the new account. Pick the region now (Mumbai `ap-south-1` is the plan in the design doc); it cannot be changed later.
- Match the Postgres major version of the old project (Project Settings > Infrastructure). `pg_dump` 16 is installed here and cannot dump a newer server; tell me the version if the dump complains.
- Pick a quiet time. Anything written to the old database after the dump is NOT in the copy.

## 1. Copy the database (about 10 minutes)
```bash
export OLD_DB_URL='postgresql://postgres:<old-password>@db.<old-ref>.supabase.co:5432/postgres'
export NEW_DB_URL='postgresql://postgres:<new-password>@db.<new-ref>.supabase.co:5432/postgres'
bash scripts/db-migrate.sh dump      # read-only on the old project
bash scripts/db-migrate.sh restore   # writes into the new project
bash scripts/db-migrate.sh verify    # old vs new row counts and money totals must MATCH
```
Why a dump and not only the `supabase/migrations` files: the app uses columns the migrations never created (for example `due_amount_minor`, `paid_amount_minor`, `is_edited`), so the live schema is the source of truth. After the restore, also run the migration files you want kept for history with `supabase db push` only if the dump left something out.

## 2. Storage (invoice PDFs and logos)
`pg_dump` copies the file records but not the files. Copy each bucket (`invoices` and any logo bucket) with `supabase storage cp -r` from the old project to the new one, then recreate the bucket settings (public or private) and policies. `verify` prints the object counts to check.

## 3. Edge functions and secrets
Deploy `supabase/functions/otp-service` and `cashfree-service` to the new project (`supabase functions deploy <name> --project-ref <new-ref>`), then set their secrets there with `supabase secrets set` (2Factor, Cashfree, service role). These are server-side only and must never be in the app.

## 4. Switch the app (cutover)
1. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the new project in `.env` and in the EAS build environment.
2. Remove the hardcoded old URL and key fallback in `src/lib/supabase.ts` so a build without env cannot silently talk to the old database.
3. Build and test with a throwaway salon: register, book, bill, pay, restart the app.
4. Release. Old app versions keep writing to the OLD database until users update.

## 5. Rollback
The old project is untouched, so rolling back means pointing the app env back at it. Keep it running for at least two weeks and do not delete it until the new one has been used for real.

## Known risks
- Hardcoded 2Factor key in `authRepository.ts` and demo OTP `123456` are copied over unchanged by an as-is move (design doc problems 3 and 4). Fix these in the v2 step.
- Row level security is wide open in the current schema (design doc problem 1). An as-is copy keeps it open.
