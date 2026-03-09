# ZentraGig — Migration & Ownership Guide

> Last updated: March 2026  
> This document explains how to migrate the ZentraGig project away from Lovable and run it independently.

---

## Table of Contents

1. [Project Structure Overview](#project-structure-overview)
2. [Exporting the Repository](#exporting-the-repository)
3. [Frontend Deployment](#frontend-deployment)
4. [Supabase Migration](#supabase-migration)
5. [Edge Functions Deployment](#edge-functions-deployment)
6. [Storage Bucket Migration](#storage-bucket-migration)
7. [Authentication Migration](#authentication-migration)
8. [Environment Variables](#environment-variables)
9. [Running Fully Independently](#running-fully-independently)

---

## 1. Project Structure Overview

```
zentragig/
├── docs/                          # Documentation (you're reading this)
├── public/                        # Static assets (favicon, robots.txt)
├── src/
│   ├── App.tsx                    # Root component with all routes
│   ├── main.tsx                   # Entry point (renders App)
│   ├── index.css                  # Global CSS with design tokens
│   ├── assets/                    # Images (logo, hero images)
│   ├── components/
│   │   ├── ui/                    # shadcn/ui primitives (Button, Dialog, etc.)
│   │   ├── layout/                # Header, Footer, ExpertStatsBanner
│   │   ├── home/                  # Homepage sections
│   │   ├── admin/                 # Admin-specific components
│   │   ├── contract/              # Contract chat
│   │   ├── messaging/             # Direct messaging components
│   │   ├── wallet/                # Fund/Withdraw modals
│   │   ├── support/               # Floating support widget
│   │   └── *.tsx                  # Shared components (AuthGuard, RoleGuard, etc.)
│   ├── hooks/                     # Custom React hooks
│   │   ├── useAuth.tsx            # Authentication context & provider
│   │   ├── useTheme.tsx           # Theme system
│   │   ├── useMessages.tsx        # Messaging hooks
│   │   ├── useNotifications.tsx   # Notification hooks
│   │   └── *.tsx                  # Other hooks
│   ├── lib/                       # Utility functions
│   │   ├── nigerian-data.ts       # Nigerian states, banks, currency formatting
│   │   ├── service-charge.ts      # Commission calculation
│   │   ├── content-vetting.ts     # Client-side content filters
│   │   ├── message-filters.ts     # Message pattern detection
│   │   ├── notifications.ts       # Notification helpers
│   │   └── utils.ts               # General utilities (cn, etc.)
│   ├── pages/                     # Page components (one per route)
│   │   ├── admin/                 # Admin panel pages
│   │   └── *.tsx                  # User-facing pages
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts          # ⚠️ AUTO-GENERATED — Supabase client init
│   │       └── types.ts           # ⚠️ AUTO-GENERATED — Database types
│   └── test/                      # Test files
├── supabase/
│   ├── config.toml                # ⚠️ AUTO-GENERATED — Supabase config
│   └── functions/                 # Edge functions (Deno runtime)
│       ├── auth-code/
│       ├── cancel-delete-job/
│       ├── contest-auto-award/
│       ├── daily-job-notifications/
│       ├── escrow-release/
│       ├── export-contract-pdf/
│       ├── kyc-check-status/
│       ├── kyc-create-session/
│       ├── kyc-webhook/
│       ├── launch-contest/
│       ├── manage-admin/
│       ├── moderate-message/
│       ├── moderate-proposal/
│       ├── paystack-charge/
│       ├── paystack-transfer/
│       ├── paystack-webhook/
│       ├── publish-contest-winners/
│       └── verify-recaptcha/
├── index.html                     # HTML entry point
├── vite.config.ts                 # Vite build configuration
├── tailwind.config.ts             # Tailwind CSS configuration
├── tsconfig.json                  # TypeScript configuration
├── package.json                   # Dependencies
└── components.json                # shadcn/ui configuration
```

### Key Technology Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS + shadcn/ui |
| State management | React Context (AuthProvider, ThemeProvider) |
| Data fetching | @tanstack/react-query + direct Supabase client |
| Routing | react-router-dom v6 |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions) |
| Payments | Paystack API |
| KYC | Didit API |
| AI | Lovable AI Gateway (Gemini models) |
| Icons | lucide-react |

---

## 2. Exporting the Repository

### From Lovable

1. In Lovable, go to **Settings → GitHub** and connect to a GitHub repository
2. All code will be pushed to the connected repo
3. Clone the repository locally: `git clone <your-repo-url>`
4. Alternatively, use Lovable's export/download feature

### After Export

The exported code is a standard Vite + React project. Verify:

```bash
cd zentragig
npm install    # or bun install
npm run dev    # Should start on localhost:5173
```

---

## 3. Frontend Deployment

The frontend is a standard Vite SPA (Single Page Application). Deploy to any static hosting provider.

### Option A: Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

Or connect GitHub repo to Vercel dashboard.

**Build settings:**
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`

### Option B: Netlify

```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

### Option C: Self-hosted (Nginx)

```bash
npm run build

# Copy dist/ to your server
scp -r dist/ user@server:/var/www/zentragig/

# Nginx config
server {
    listen 80;
    server_name zentragig.com;
    root /var/www/zentragig;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;  # SPA fallback
    }
}
```

### Environment Variables for Frontend

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

**Important:** Update `src/integrations/supabase/client.ts` to use these environment variables:

```typescript
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
```

---

## 4. Supabase Migration

### Option A: Use Existing Lovable Cloud Project

If you continue using the same Supabase instance, you only need the project URL and keys. Contact Lovable support to get your Supabase project credentials.

### Option B: Create a New Supabase Project

1. Create account at [supabase.com](https://supabase.com)
2. Create a new project
3. Run all migrations in order from `supabase/migrations/` folder

#### Database Schema Recreation

The migrations folder contains all SQL needed to recreate the schema. Run them in order:

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase login
supabase link --project-ref your-project-id

# Push migrations
supabase db push
```

#### Critical Database Objects to Verify

After migration, ensure these exist:

1. **Enums:**
   - `user_role` (client, freelancer)
   - `app_role` (admin, moderator, user)
   - `availability_type` (full_time, part_time, flexible)
   - `contract_status` (draft, interviewing, pending_funding, active, in_review, completed, cancelled, disputed)
   - `job_status` (open, in_progress, completed, cancelled, pending_delete)
   - `proposal_status` (pending, accepted, rejected, withdrawn)

2. **Functions:**
   - `handle_new_user()` — trigger on `auth.users`
   - `has_role()` — security definer
   - `is_super_admin()` — security definer
   - `get_funding_status()` — stable
   - `get_contest_entry_count()` — stable
   - `sync_job_status_on_contract_complete()` — trigger
   - `delete_user_account()` — security definer
   - `update_updated_at_column()` — trigger

3. **Triggers:**
   - `on_auth_user_created` → calls `handle_new_user()` on `auth.users` INSERT
   - `sync_job_on_contract_complete` → calls `sync_job_status_on_contract_complete()` on `contracts` UPDATE

4. **RLS Policies:** All tables should have RLS enabled. See `BACKEND_ARCHITECTURE.md` for complete policy listing.

#### Initial Data

After schema creation, seed essential data:

```sql
-- Categories
INSERT INTO categories (name, slug) VALUES
('Mechanical Engineering', 'mechanical-engineering'),
('Architectural Design', 'architectural-design'),
('Electrical Engineering', 'electrical-engineering'),
('Civil Engineering', 'civil-engineering'),
('3D Modeling & Rendering', '3d-modeling-rendering'),
('Drafting & Documentation', 'drafting-documentation');

-- Commission tiers
INSERT INTO platform_settings (key, value) VALUES
('commission_tiers', '[{"max_amount":300000,"rate":20,"label":"Up to ₦300,000"},{"max_amount":2000000,"rate":15,"label":"Up to ₦2,000,000"},{"max_amount":10000000,"rate":10,"label":"Up to ₦10,000,000"},{"max_amount":null,"rate":7,"label":"Above ₦10,000,000"}]');

-- Support settings
INSERT INTO platform_settings (key, value) VALUES
('support_email', '"hello@zentragig.com"'),
('support_phone', '"+234 801 234 5678"'),
('support_whatsapp', '"+234 801 234 5678"');
```

---

## 5. Edge Functions Deployment

### Using Supabase CLI

All edge functions are in `supabase/functions/<name>/index.ts`. Deploy them:

```bash
# Deploy all functions
supabase functions deploy auth-code
supabase functions deploy cancel-delete-job
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

### JWT Verification Configuration

In `supabase/config.toml`, the following functions have `verify_jwt = false` (they handle auth internally or receive external webhooks):

```toml
[functions.manage-admin]
verify_jwt = false

[functions.paystack-webhook]
verify_jwt = false

[functions.kyc-webhook]
verify_jwt = false

[functions.verify-recaptcha]
verify_jwt = false
```

All other functions require JWT (default behavior).

### Setting Secrets

```bash
supabase secrets set PAYSTACK_SECRET_KEY=sk_live_...
supabase secrets set RECAPTCHA_SECRET_KEY=6L...
supabase secrets set DIDIT_API_KEY=...
supabase secrets set DIDIT_WORKFLOW_ID=...
supabase secrets set LOVABLE_API_KEY=...
```

**Note:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_DB_URL` are automatically available in Supabase edge functions.

### AI Gateway Migration

The `moderate-message`, `moderate-proposal`, and `daily-job-notifications` functions use the Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`).

**To migrate away from Lovable AI Gateway:**

1. Replace the gateway URL with a direct provider endpoint:
   - Google AI: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
   - OpenAI: `https://api.openai.com/v1/chat/completions`

2. Update the API key:
   ```bash
   supabase secrets set GOOGLE_AI_KEY=AIza...
   # or
   supabase secrets set OPENAI_API_KEY=sk-...
   ```

3. Update the edge function code to use the new API format

---

## 6. Storage Bucket Migration

### Recreate Buckets

In your new Supabase project:

```sql
-- Via Supabase dashboard or SQL
INSERT INTO storage.buckets (id, name, public) VALUES
('job-attachments', 'job-attachments', true),
('proposal-attachments', 'proposal-attachments', true),
('chat-attachments', 'chat-attachments', true),
('contract-attachments', 'contract-attachments', true),
('contest-banners', 'contest-banners', true),
('service-banners', 'service-banners', true),
('service-images', 'service-images', true),
('avatars', 'avatars', true);
```

### Storage Policies

Add upload policies for each bucket:

```sql
-- Example for avatars bucket
CREATE POLICY "Users can upload avatars" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Anyone can view avatars" ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can update own avatars" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### Migrating Existing Files

If you need to move files from the old Supabase project:

1. Use the Supabase dashboard to download files manually
2. Or use the Supabase JS client to programmatically copy:

```javascript
const { data } = await oldSupabase.storage.from('avatars').list();
for (const file of data) {
  const { data: fileData } = await oldSupabase.storage.from('avatars').download(file.name);
  await newSupabase.storage.from('avatars').upload(file.name, fileData);
}
```

---

## 7. Authentication Migration

### Auth Configuration

1. **Email/Password:** Enabled by default in Supabase
2. **Email confirmation:** Ensure auto-confirm is disabled in Supabase Auth settings
3. **Email templates:** Customize confirmation and password reset email templates

### Auth Trigger

Ensure the `handle_new_user()` trigger is attached to `auth.users`:

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

### User Migration

If migrating users to a new Supabase project:

1. Export users from the old project via Supabase dashboard (or API)
2. Import using `supabase.auth.admin.createUser()` for each user
3. Users will need to reset their passwords (or use magic link for first login)
4. Auth codes (hashed) can be migrated via the `profiles` table

**Note:** Authentication state is managed by Supabase sessions. After migration, all users will need to log in again.

---

## 8. Environment Variables

### Frontend (.env)

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...anon-key
VITE_SUPABASE_PROJECT_ID=your-project-ref
```

### Edge Functions (Supabase Secrets)

| Secret | Where to Get It | Required By |
|---|---|---|
| `PAYSTACK_SECRET_KEY` | [Paystack Dashboard](https://dashboard.paystack.com) → Settings → API | paystack-charge, paystack-transfer, paystack-webhook, escrow-release |
| `RECAPTCHA_SECRET_KEY` | [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin) | verify-recaptcha |
| `DIDIT_API_KEY` | Didit dashboard | kyc-create-session, kyc-check-status, kyc-webhook |
| `DIDIT_WORKFLOW_ID` | Didit dashboard | kyc-create-session |
| `LOVABLE_API_KEY` | Lovable platform (or replace with direct AI API) | moderate-message, moderate-proposal, daily-job-notifications |

### Webhook URLs to Configure

After deployment, configure these callback URLs in third-party services:

| Service | Webhook URL | Endpoint |
|---|---|---|
| Paystack | `https://your-project.supabase.co/functions/v1/paystack-webhook` | paystack-webhook |
| Didit KYC | `https://your-project.supabase.co/functions/v1/kyc-webhook` | kyc-webhook |

---

## 9. Running Fully Independently

### Complete Checklist

- [ ] Export repository from Lovable (or clone from GitHub)
- [ ] Create new Supabase project (or get credentials for existing one)
- [ ] Run all database migrations
- [ ] Seed initial data (categories, settings)
- [ ] Create storage buckets with policies
- [ ] Deploy all 18 edge functions
- [ ] Set all secrets in Supabase
- [ ] Update `src/integrations/supabase/client.ts` with new project URL and key
- [ ] Create `.env` file with frontend environment variables
- [ ] Deploy frontend to hosting provider (Vercel/Netlify/custom)
- [ ] Configure Paystack webhook URL
- [ ] Configure Didit KYC webhook URL
- [ ] Configure reCAPTCHA for your domain
- [ ] Set up cron jobs for `contest-auto-award` and `daily-job-notifications`
- [ ] Create initial admin user and bootstrap permissions
- [ ] Replace Lovable AI Gateway URLs if not continuing with Lovable
- [ ] Test all payment flows with Paystack test keys
- [ ] Test KYC flow with Didit sandbox
- [ ] Migrate existing data if applicable

### Setting Up Cron Jobs

For `contest-auto-award` and `daily-job-notifications`, use Supabase's `pg_cron` extension or an external scheduler:

```sql
-- Enable pg_cron (requires Supabase Pro plan)
-- Run contest-auto-award daily at midnight
SELECT cron.schedule(
  'contest-auto-award',
  '0 0 * * *',
  $$SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/contest-auto-award',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  )$$
);

-- Run daily-job-notifications at 8 AM WAT
SELECT cron.schedule(
  'daily-job-notifications',
  '0 7 * * *',
  $$SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/daily-job-notifications',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  )$$
);
```

### Creating First Admin

1. Register a normal user account via the signup form
2. Verify email and log in
3. Add admin role via SQL:

```sql
INSERT INTO user_roles (user_id, role) VALUES ('user-uuid-here', 'admin');
```

4. Log out and log back in — you'll be redirected to `/admin`
5. The system will auto-bootstrap all permissions for the first admin

### Domain & DNS

After deployment, update:
1. Supabase Auth settings → Site URL (your production domain)
2. Supabase Auth settings → Redirect URLs (add your domain)
3. Paystack dashboard → Webhook URL
4. reCAPTCHA settings → Allowed domains
5. Any hardcoded references to `zentragig.com` in the codebase

### Ongoing Maintenance

| Task | Frequency |
|---|---|
| Monitor Paystack webhook delivery | Daily |
| Review moderation logs for false positives | Weekly |
| Check admin activity log for anomalies | Weekly |
| Review and resolve open disputes | As needed |
| Approve/feature platform reviews | As needed |
| Update commission tiers if needed | Quarterly |
| Rotate API keys/secrets | Quarterly |
| Review and update legal documents | Annually |
| Database backup verification | Monthly |

---

*End of Migration & Ownership Guide*
