# ZentraGig

ZentraGig is an engineering and technical services marketplace. It connects clients with engineers, CAD specialists, and technical professionals for project-based work, proposals, contracts, messaging, payments, and platform administration.

## Features

- Client and freelancer accounts
- Job posting and proposal workflows
- Contracts, milestones, and escrow support
- Messaging and file attachments
- Contest flows
- Admin dashboard and moderation tools
- Supabase-backed auth, database, storage, and Edge Functions

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Supabase

## Getting Started

Install dependencies:

```sh
npm install
```

Run the website locally:

```sh
npm run dev
```

Then open the local address shown in the terminal, usually:

```text
http://localhost:8080
```

Create a local environment file:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID=YOUR_PROJECT_REF
VITE_RECAPTCHA_SITE_KEY=YOUR_RECAPTCHA_SITE_KEY
```

Start the development server:

```sh
npm run dev
```

Create a production build:

```sh
npm run build
```

Run tests:

```sh
npm test
```

## Supabase

This repository includes:

- database migrations in `supabase/migrations/`
- Edge Functions in `supabase/functions/`
- local Supabase config in `supabase/config.toml`

Typical setup:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Deploy functions as needed:

```sh
npx supabase functions deploy FUNCTION_NAME
```

## Configuration

Server-side secrets should be stored in Supabase Edge Function secrets, not in frontend env files.

Depending on enabled features, this project may use secrets such as:

- `OPENAI_API_KEY`
- `PAYSTACK_SECRET_KEY`
- `RECAPTCHA_SECRET_KEY`
- `DIDIT_API_KEY`
- `DIDIT_WORKFLOW_ID`
- `DIDIT_WEBHOOK_SECRET`
- `CRON_SECRET`

## Deployment

Recommended setup:

- Frontend: Vercel
- Backend, auth, storage, database, and functions: Supabase

For the full rebuild and launch process, see [docs/REBUILD_ROADMAP.md](docs/REBUILD_ROADMAP.md).
