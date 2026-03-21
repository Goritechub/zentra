# ZentraGig Rebuild Roadmap

> Last updated: March 12, 2026
> Purpose: rebuild ZentraGig independently from the exported Lovable codebase, using a brand-new Supabase project and new hosting, with domain cutover deferred until launch day.

---

## 1. Goal

This roadmap assumes:

- You do **not** need existing Lovable/Supabase data
- Test users can be recreated manually
- You want a clean, fully independent rebuild
- You already own the production domain, but will not point it to the new app until launch day

This is the cleanest path to full ownership because you will control:

- the GitHub repository
- the new Supabase project
- the frontend hosting account
- the storage buckets
- the edge functions and secrets
- the payment/KYC/reCAPTCHA integrations
- the production domain and DNS

---

## 2. What You Already Have From Lovable

The exported codebase already includes most of the application logic you need:

- frontend app code in `src/`
- Supabase database migrations in `supabase/migrations/`
- edge functions in `supabase/functions/`
- Supabase client wiring in `src/integrations/supabase/client.ts`
- deployment-oriented docs in `docs/`

What the export does **not** include:

- live database records
- existing auth users
- Supabase project ownership
- Supabase secrets
- third-party dashboard access unless you control those accounts
- uploaded storage files from the old environment

---

## 3. Recommended Stack For The Rebuild

Use this unless you have a strong reason to change it:

- Frontend hosting: Vercel
- Backend/database/auth/storage/functions: Supabase
- Source control: GitHub
- Payments: Paystack
- KYC: Didit
- CAPTCHA: Google reCAPTCHA
- AI: replace Lovable AI Gateway with your own provider before launch

Why this stack:

- it matches the repo structure
- it minimizes code changes
- it keeps the rebuild operationally simple

---

## 4. Rebuild Phases

### Phase 1: Lock Down The Codebase

1. Put the project in your own GitHub repository if that is not already done.
2. Install dependencies and verify the app builds locally:

```bash
npm install
npm run build
npm test
```

3. Create a working `.env.local` or `.env` for local development later.
4. Keep the current production domain untouched for now.

Exit criteria:

- the repo is under your control
- the app builds locally
- you can safely work without depending on Lovable

### Phase 2: Create Your New Supabase Project

1. Create a new Supabase account you control.
2. Create a new Supabase project.
3. Save the following immediately in your password manager:
   - project URL
   - project ref
   - publishable/anon key
   - service role key
   - database password

Recommended naming:

- Project name: `zentragig-prod` or `zentragig-staging`
- Region: closest to your expected users

Exit criteria:

- the new Supabase project exists
- all core credentials are stored securely

### Phase 3: Recreate The Database Schema

The repo already contains a `supabase/migrations/` directory, so your schema is recoverable from code.

1. Install the Supabase CLI.
2. Log in to Supabase CLI.
3. Link the repo to your new project.
4. Push the migrations.

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

After migration:

1. Open the Supabase dashboard.
2. Confirm the expected tables, enums, triggers, functions, and policies exist.
3. Spot-check critical tables such as:
   - `profiles`
   - `user_roles`
   - `jobs`
   - `proposals`
   - `contracts`
   - `transactions`
   - `notifications`

Exit criteria:

- migrations run successfully
- tables and RLS policies exist
- auth trigger behavior is present

### Phase 4: Seed Required Initial Data

Some core platform settings and reference data need to exist before the app behaves correctly.

Seed at least:

- categories
- commission tiers
- support settings
- any admin bootstrap data required by the schema

Use the seed SQL from the migration guide as a starting point, then verify values inside the app admin flows.

Exit criteria:

- categories appear in the app
- support settings resolve
- pricing/commission logic has backing data

### Phase 5: Recreate Cloud Storage

This app uses Supabase Storage as its cloud file layer.

Create these buckets in the new Supabase project:

- `job-attachments`
- `proposal-attachments`
- `chat-attachments`
- `contract-attachments`
- `contest-banners`
- `service-banners`
- `service-images`
- `avatars`

Then add the required storage policies.

Because you do not need old uploaded files, you can skip file migration entirely.

Exit criteria:

- all required buckets exist
- upload/download works from the app
- policies prevent unauthorized access

### Phase 6: Configure Frontend Environment Variables

Create your frontend environment file with the new Supabase values:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID=YOUR_PROJECT_REF
```

The repo already reads these values from `src/integrations/supabase/client.ts`, so no hardcoded Lovable project credentials should be needed there.

Exit criteria:

- local app starts against your new Supabase project
- sign up and sign in work against the new backend

### Phase 7: Deploy Supabase Edge Functions

This repo contains multiple edge functions under `supabase/functions/`.

Deploy every function that your product uses. At minimum, review and deploy all existing function directories in the repo.

Typical deploy flow:

```bash
supabase functions deploy auth-code
supabase functions deploy auto-close-stale-contracts
supabase functions deploy broadcast-notification
supabase functions deploy cancel-delete-job
supabase functions deploy clear-pending-funds
supabase functions deploy contest-auto-award
supabase functions deploy daily-job-notifications
supabase functions deploy escrow-release
supabase functions deploy export-contract-pdf
supabase functions deploy kyc-check-status
supabase functions deploy kyc-create-session
supabase functions deploy kyc-webhook
supabase functions deploy launch-contest
supabase functions deploy manage-admin
supabase functions deploy moderate-message
supabase functions deploy moderate-proposal
supabase functions deploy paystack-charge
supabase functions deploy paystack-transfer
supabase functions deploy paystack-webhook
supabase functions deploy publish-contest-winners
supabase functions deploy verify-recaptcha
```

Before production, verify each function's auth expectations in `supabase/config.toml`.

Exit criteria:

- all required functions are deployed
- function invocation succeeds from the app
- webhook endpoints are reachable

### Phase 8: Set Supabase Secrets

You will need to configure secrets used by the functions.

Expected secrets include:

- `PAYSTACK_SECRET_KEY`
- `RECAPTCHA_SECRET_KEY`
- `DIDIT_API_KEY`
- `DIDIT_WORKFLOW_ID`
- `DIDIT_WEBHOOK_SECRET`
- `LOVABLE_API_KEY` only if you temporarily keep Lovable AI Gateway
- `OPENAI_API_KEY` or `GOOGLE_AI_KEY` if you replace Lovable AI Gateway

Notes:

- Supabase automatically provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_DB_URL` to functions.
- The codebase references `DIDIT_WEBHOOK_SECRET`, so include it even though some older docs may not mention it.

Exit criteria:

- function logs show no missing-secret errors
- payment, KYC, and reCAPTCHA requests complete successfully

### Phase 9: Remove Remaining Lovable Dependencies

This rebuild is not fully independent until Lovable-specific services are removed or intentionally retained.

#### 9.1 Google OAuth

The app still contains a Lovable-specific OAuth wrapper:

- `src/integrations/lovable/index.ts`
- `src/pages/Auth.tsx`

Action:

- replace Lovable Cloud OAuth with native Supabase OAuth for Google
- re-test signup/login redirects after the change

#### 9.2 AI Gateway

Some edge functions still call Lovable AI Gateway:

- `supabase/functions/moderate-message/index.ts`
- `supabase/functions/moderate-proposal/index.ts`
- `supabase/functions/daily-job-notifications/index.ts`

Action:

- replace `https://ai.gateway.lovable.dev/...` with your own provider endpoint
- update request payloads if required by the new provider
- store your provider API key as a Supabase secret

#### 9.3 reCAPTCHA Site Key

The frontend currently includes a hardcoded reCAPTCHA site key in `src/pages/Auth.tsx`.

Action:

- move the site key to a frontend environment variable
- use your own reCAPTCHA project before launch

Exit criteria:

- no required production path depends on Lovable infrastructure
- OAuth, AI, and reCAPTCHA are under your control

### Phase 10: Set Up Frontend Hosting

Recommended: Vercel.

Steps:

1. Create a Vercel project from your GitHub repository.
2. Set framework to Vite if Vercel does not auto-detect it.
3. Add frontend environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
4. Deploy to a temporary Vercel URL first.

Use the temporary URL for:

- internal QA
- Supabase auth testing before launch
- webhook dry runs if needed

Exit criteria:

- the app is deployed on a non-production preview URL
- core pages load correctly
- authentication works on the hosted environment

### Phase 11: Configure Auth For Pre-Launch Testing

Even before your real domain goes live, you need correct auth settings.

In Supabase Auth settings:

- set Site URL to your current testing frontend URL
- add redirect URLs for:
  - your Vercel preview or production-on-Vercel URL
  - local development URL such as `http://localhost:5173`
  - password reset callback paths you use

Because your real domain will stay disconnected until launch day, do not switch Site URL to the final domain yet.

Exit criteria:

- signup, login, reset-password, and OAuth redirects work on the test URL

### Phase 12: Configure Third-Party Services

Configure these dashboards to point at the new Supabase project and hosted frontend:

#### Paystack

- add your new webhook URL
- verify test mode first
- validate card, bank transfer, and any supported funding flow

Webhook:

```text
https://YOUR_PROJECT.supabase.co/functions/v1/paystack-webhook
```

#### Didit

- set API credentials
- configure the webhook URL
- verify the workflow ID matches the intended KYC flow

Webhook:

```text
https://YOUR_PROJECT.supabase.co/functions/v1/kyc-webhook
```

#### Google reCAPTCHA

- create your own site key and secret key
- whitelist your preview domain during testing
- add the production domain on launch day

Exit criteria:

- all third-party callbacks hit your new infrastructure
- sandbox/test flows pass end to end

### Phase 13: Configure Scheduled Jobs

Some platform behavior depends on scheduled execution.

At minimum, review cron requirements for:

- `contest-auto-award`
- `daily-job-notifications`
- `auto-close-stale-contracts`
- `clear-pending-funds`

Choose one:

- Supabase `pg_cron` if your plan supports it
- an external scheduler if you want clearer control

Exit criteria:

- scheduled jobs are defined
- each scheduled function can be invoked successfully

### Phase 14: Create Initial Admin And Test Accounts

Because you do not need old users, create fresh accounts in the rebuilt environment.

Steps:

1. Register a standard account through the app.
2. Promote that user to admin using SQL or the admin bootstrap path.
3. Create a small QA set of users:
   - admin
   - client
   - freelancer

Then test:

- signup
- login
- password reset
- role-based routing
- profile completion
- job posting
- proposal flow
- contract flow
- wallet funding
- payout flow
- notifications
- file uploads
- KYC flow

Exit criteria:

- admin access works
- test accounts can complete the core product journeys

### Phase 15: Launch-Day Domain Cutover

Do this only when the platform has passed QA.

#### Before changing DNS

- confirm the Vercel deployment is the exact release you want live
- confirm Supabase secrets are production values
- confirm webhook URLs are production-ready
- confirm the final domain has been added to allowed origins where needed

#### On launch day

1. Add the custom domain in Vercel.
2. Update DNS records at your domain registrar/DNS provider.
3. Wait for DNS propagation.
4. In Supabase Auth settings, change:
   - Site URL
   - Redirect URLs
5. In reCAPTCHA, add the production domain.
6. In Paystack and Didit, confirm any domain-specific settings if applicable.
7. Run a smoke test on the live domain.

#### Post-cutover smoke test

Test immediately on the real domain:

- homepage loads
- signup works
- login works
- password reset email link returns correctly
- Google OAuth works if enabled
- one upload works
- one payment test or low-risk live validation works
- KYC redirect/callback works

Exit criteria:

- the custom domain is live
- auth redirects resolve to the final domain
- payment/KYC/webhook flows remain healthy after cutover

---

## 5. Rebuild Checklist

Use this as the execution checklist.

- [ ] Repo is under your GitHub account
- [ ] `npm install` succeeds
- [ ] `npm run build` succeeds
- [ ] `npm test` succeeds
- [ ] New Supabase project created
- [ ] Supabase credentials stored securely
- [ ] `supabase link` connected to the new project
- [ ] `supabase db push` completed
- [ ] Core tables and RLS verified
- [ ] Initial seed data inserted
- [ ] Storage buckets created
- [ ] Storage policies added
- [ ] Frontend `.env` configured
- [ ] Local app runs against the new Supabase project
- [ ] All required edge functions deployed
- [ ] Supabase secrets configured
- [ ] Paystack test flow verified
- [ ] Didit sandbox flow verified
- [ ] reCAPTCHA configured with your own keys
- [ ] Lovable OAuth dependency replaced or intentionally retained
- [ ] Lovable AI Gateway dependency replaced or intentionally retained
- [ ] Frontend deployed to Vercel preview URL
- [ ] Supabase auth URLs updated for test hosting
- [ ] Scheduled jobs configured
- [ ] Initial admin account created
- [ ] QA accounts created
- [ ] Full end-to-end QA completed
- [ ] Custom domain added in Vercel
- [ ] DNS updated on launch day
- [ ] Supabase auth URLs updated to the production domain
- [ ] Final smoke test passed on the live domain

---

## 6. Known Rebuild Risks

These are the main places this rebuild can fail if not handled deliberately:

### Lovable OAuth still in the app

If you leave Lovable OAuth in place, the platform is not fully independent.

### Lovable AI Gateway still in functions

If you do not replace it, moderation/notification behavior still depends on Lovable.

### Missing secrets

Many functions will fail silently or partially if dashboard secrets are not set.

### Storage policies

Incorrect storage policies can break uploads or expose files too broadly.

### Auth redirect configuration

Bad Site URL or redirect URL settings will break login, password reset, and OAuth.

### Launch-day DNS changes

Domain cutover touches Vercel, DNS, Supabase Auth, reCAPTCHA, and sometimes third-party dashboards. Treat it as a controlled release task, not a casual config change.

---

## 7. Recommended Order Of Execution

If you want the shortest safe path, do the work in this order:

1. Verify the app builds locally
2. Create the new Supabase project
3. Push migrations
4. Seed initial data
5. Create storage buckets and policies
6. Set frontend env vars
7. Deploy edge functions
8. Set Supabase secrets
9. Deploy frontend to Vercel preview URL
10. Fix Lovable OAuth dependency
11. Replace Lovable AI Gateway dependency
12. Configure Paystack, Didit, and reCAPTCHA
13. Configure auth URLs for preview hosting
14. Configure scheduled jobs
15. Create admin/test accounts
16. Run end-to-end QA
17. Cut over the custom domain on launch day

---

## 8. Immediate Next Actions

Start here:

1. Create the new Supabase project
2. Run `supabase link --project-ref ...`
3. Run `supabase db push`
4. Create the storage buckets
5. Set the frontend `.env`
6. Deploy the app to a temporary Vercel URL

Once that is working, tackle the Lovable-specific dependencies before calling the rebuild complete.
