# Frontend Supabase Exit + Production Deployment Plan

## Objective
- Remove direct Supabase data access from the frontend.
- Route all data operations through backend API endpoints.
- Prepare production-grade deployment for backend + frontend with secure configuration, reliability, and observability.

## Current State Summary
- Significant migration already completed for many pages.
- Remaining direct Supabase usage still exists in `src/hooks`, `src/components`, `src/lib`, and a few pages.
- Current direct usage types:
  - `supabase.from(...)` table reads/writes
  - `supabase.rpc(...)`
  - `supabase.functions.invoke(...)`
  - `supabase.storage.from(...)`
  - `supabase.channel(...)` / `removeChannel(...)` realtime subscriptions
  - `supabase.auth.*` (session/auth flows)

## Target Architecture
- Frontend:
  - Uses only `src/api/*.api.ts` (Axios backend client) for app data.
  - Keeps only minimal client auth SDK usage until auth proxy migration is complete.
- Backend:
  - Owns all Supabase access using service-role key.
  - Exposes role-scoped modules: `admin/`, `expert/`, `client/`, and `shared/`.
- Supabase:
  - Becomes backend infrastructure dependency, not a frontend data source.

## Migration Rules
- No new direct `supabase.from/rpc/functions/storage` in frontend app logic.
- All frontend reads/writes must go through backend controllers/services.
- Realtime and storage flows should be API-mediated (signed URL or upload token pattern).

---

## Execution Plan

## Phase 1: Freeze and Inventory
- Add lint/CI guard:
  - Fail build if new direct `supabase.from(...)`/`rpc(...)` appears outside approved auth wrapper files.
- Generate and maintain a migration checklist from scan output.
- Mark each item with:
  - `module owner` (`admin`, `expert`, `client`, `shared`)
  - `operation type` (`read`, `write`, `realtime`, `storage`, `edge-function`)

## Phase 2: Read Path Completion
- Migrate all remaining frontend reads (`from select`, `rpc`) to backend endpoints.
- Prioritize by user-critical paths:
  1. Auth/bootstrap-dependent widgets
  2. Dashboard/notifications/messages counters
  3. Profile and contract detail side panels
- Add response DTO typing for each new endpoint.

## Phase 3: Write Path Completion
- Migrate all remaining frontend writes (`insert/update/delete`) to backend.
- Apply validation at backend boundary:
  - Input schema validation
  - ownership/authorization checks
  - consistent error contracts

## Phase 4: Storage and Edge Functions
- Replace direct upload calls with backend-managed flow:
  - Option A: backend signed upload URL + direct browser upload
  - Option B: backend upload proxy (smaller files only)
- Replace direct `functions.invoke` with backend endpoints that call function/server logic internally.

## Phase 5: Realtime Consolidation
- Move realtime subscription setup into backend-compatible strategy:
  - keep websocket in frontend only for non-sensitive channels or
  - use backend websocket/SSE gateway for normalized events.
- Standardize reconnect/backoff behavior and stale-tab recovery.

## Phase 6: Auth Boundary Tightening
- Keep frontend Supabase auth only as transitional layer.
- Introduce backend session introspection endpoint as source of truth for app state.
- Remove all non-auth frontend Supabase client usage.

## Phase 7: Hardening + Cleanup
- Remove dead Supabase code paths and wrappers no longer used.
- Enforce architectural rule in CI:
  - frontend app code cannot import raw Supabase client except approved auth files.
- Update architecture docs and runbooks.

---

## Deployment Plan (Production)

## 1) Deploy backend as its own web service
- Deploy `server/` to Render/Railway/Fly/AWS (recommended: Render web service for simplicity).
- Start command: Nest production start.
- Ensure at least 1 always-on instance (avoid cold starts if possible).

## 2) Set `FRONTEND_API_BASE_URL` to backend HTTPS URL
- Frontend environment:
  - `VITE_API_BASE_URL=https://api.yourdomain.com`
- No localhost URLs in production builds.

## 3) Keep Supabase secrets only in backend env
- Backend-only:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Frontend:
  - only publishable anon key if still needed for auth transition.
- Never expose service role key to frontend.

## 4) Health checks, auto-restart, logs, alerts
- Health endpoint: `GET /health`.
- Platform health check path: `/health`.
- Enable automatic restart on failure.
- Centralized logs:
  - request IDs
  - auth/bootstrap timing
  - upstream Supabase errors
- Alerts:
  - high 5xx rate
  - health check flaps
  - elevated latency.

## 5) TLS + custom domain
- Use `api.zentragig.com` (or equivalent).
- Enforce HTTPS.
- Add HSTS at edge/platform if available.

## 6) Strict CORS
- Allow only production frontend origins, plus preview domains if needed.
- Block wildcard origin in production.
- Allow credentials only where required.

## 7) Process/container strategy for zero-downtime
- Use rolling deploys or blue/green where platform supports it.
- Set graceful shutdown timeout.
- Ensure readiness probes before traffic cutover.

---

## Environment Matrix

## Backend (Production)
- `NODE_ENV=production`
- `PORT`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FRONTEND_ORIGIN=https://zentragig.com` (and optional preview domains)
- Optional:
  - `LOG_LEVEL`
  - `SENTRY_DSN` (or equivalent)

## Frontend (Production)
- `VITE_API_BASE_URL=https://api.zentragig.com`
- Auth-only public vars if still required:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

---

## CI/CD Gates
- Backend:
  - `npm run build` and tests
  - fail on type errors
- Frontend:
  - `npm run build`
  - lint rule for forbidden direct Supabase data usage
- Pre-deploy checks:
  - CORS config present
  - required env vars set
  - health endpoint responding

---

## Rollout Strategy
- Step 1: Deploy backend endpoints first.
- Step 2: Ship frontend changes behind feature flags where risky.
- Step 3: Canary traffic (small percentage) and monitor.
- Step 4: Full rollout.
- Step 5: Remove legacy direct Supabase frontend code.

---

## Immediate Work Queue (Suggested)
- Pass A: Remove remaining `supabase.from(...)` in `hooks/components/lib`.
- Pass B: Remove remaining `supabase.rpc(...)` frontend usage.
- Pass C: Replace remaining `supabase.functions.invoke(...)` with backend APIs.
- Pass D: Migrate storage upload flows to backend-signed upload contracts.
- Pass E: Realtime strategy unification and reconnect policy.
- Pass F: CI rule enforcement + final architecture doc updates.

---

## Definition of Done
- Frontend app logic performs zero direct Supabase data operations.
- All data, storage policy decisions, and edge-function invocations are backend-mediated.
- Production deployment uses dedicated API domain with TLS, strict CORS, health checks, restart strategy, logs, and alerting.
- Runbook validated by restart/recovery test: stale tab + backend restart recovers without hard reload.
