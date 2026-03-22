# Backend Repo Split + Production Rollout (Phased Runbook)

## Goal
- Split backend into its own GitHub repo.
- Keep frontend and backend working independently during transition.
- Deploy production-grade infrastructure in a second phase.

## Recommended Repo Layout
- `zentragig-frontend` (React/Vite app)
- `zentragig-api` (Nest backend currently in `server/`)

---

## Phase 1: Split Backend Into Its Own Repo (No Downtime)

## Step 1: Create the new backend repository
1. Create a private GitHub repo named `zentragig-api`.
2. Do not initialize with README/license/gitignore (empty repo).

## Step 2: Copy backend code into a clean local folder
From your machine:

```powershell
# from a parent workspace directory
mkdir zentragig-api
cd zentragig-api
git init
```

Copy these from current monorepo into `zentragig-api`:
- `server/*` (all backend source)
- backend-specific docs you want to keep:
  - `docs/RENDER_DEPLOYMENT_RUNBOOK.md`
  - backend architecture docs if needed

Do not copy frontend files.

## Step 3: Verify backend runs standalone
Inside new `zentragig-api`:

```powershell
npm ci
npm run build
npm run start:dev
```

Confirm:
- `GET /health` returns 200.
- Auth/bootstrap endpoint works with valid token.

## Step 4: Add backend env scaffolding
Create `.env.example` at backend repo root (no secrets):

```env
NODE_ENV=development
PORT=3000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
FRONTEND_ORIGIN=http://localhost:8080/
# FRONTEND_ORIGIN_PROD=https://zentragig.com
```

Create `.gitignore` at backend repo root:

```gitignore
node_modules/
dist/
.env
.env.*
```

`FRONTEND_ORIGIN` is the exact frontend URL allowed by backend CORS.
- Local dev example: `http://localhost:8080/`
- Production example (keep commented until go-live): `https://zentragig.com`

OAuth callback allowlist must be exact:
- Dev callback: `http://localhost:8080/auth`
- Prod callback: `https://zentragig.com/auth` (keep disabled until go-live)

Frontend should start Google login via backend endpoint for cleaner UX:
- `GET /auth/oauth/google/start?redirectTo=http://localhost:8080/auth`
- Backend then redirects to Supabase OAuth URL.

## Step 5: Push backend repo

```powershell
git add .
git commit -m "Initial backend extraction from monorepo"
git branch -M main
git remote add origin <YOUR_GITHUB_BACKEND_REPO_URL>
git push -u origin main
```

## Step 6: Keep frontend working with split backend
In frontend repo:
1. Keep `VITE_API_BASE_URL` pointing to backend URL (local for dev first).
2. Verify frontend still compiles and all API calls flow through Axios.
3. Do not remove old `server/` folder immediately until validation is complete.

## Step 7: Parallel-run validation window
For 2-5 days (or your preferred window):
- Backend served from new repo locally/staging.
- Frontend points to that backend.
- Validate:
  - login/bootstrap
  - dashboard
  - notifications/messages
  - proposals/contracts core flows

## Step 8: Remove backend from frontend repo after validation
In `zentragig-frontend`:
1. Delete `server/` only after successful parallel validation.
2. Keep API docs reference links updated to new backend repo.

---

## Phase 1.5: Guardrails So Re-split Issues Don’t Reappear

- Add CI check in frontend:
  - block backend-only files and accidental server code additions.
- Add CI check in backend:
  - build + tests + lint before merge.
- Add architecture rule:
  - frontend app data access must go through backend APIs.

---

## Phase 2: Production Infrastructure Rollout

## Step 1: Deploy backend service
Recommended starter: Render Web Service.

Backend deploy settings:
- Root: repo root (`zentragig-api`)
- Build: `npm ci && npm run build`
- Start: `npm run start:prod`
- Health check: `/health`

## Step 2: Configure backend production env
Set in Render:
- `NODE_ENV=production`
- `PORT=10000`
- `SUPABASE_URL=<value>`
- `SUPABASE_SERVICE_ROLE_KEY=<secret>`
- `FRONTEND_ORIGIN=https://zentragig.com`

Never expose service role key in frontend.

## Step 3: Set API domain + TLS
1. Add custom domain: `api.zentragig.com`.
2. Set DNS CNAME/ALIAS to Render endpoint.
3. Confirm certificate issuance and HTTPS access.

## Step 4: Frontend production deploy wiring
Frontend env:
- `VITE_API_BASE_URL=https://api.zentragig.com`

Rebuild/redeploy frontend after env update.

## Step 5: CORS hardening
Allow only:
- `https://zentragig.com`
- `https://www.zentragig.com` (if used)
- preview domains only if explicitly needed

No wildcard CORS in production.

## Step 6: Reliability and observability
- Enable Render health checks + restart policy.
- Add log-based monitoring:
  - 5xx spikes
  - auth/bootstrap failures
  - startup errors
- Add alerting (email/Slack/etc).

## Step 7: Zero-downtime habits
- Use production-safe deploy windows.
- Validate `/health` before traffic checks.
- Keep rollback path ready (previous deploy restore).

---

## Phase 3: Post-Production Cleanup and Hardening

- Remove temporary transition configs and fallback URLs.
- Tighten CORS to only final domains.
- Add rate-limiting and request logging middleware if missing.
- Add backup/incident runbook.
- Add weekly dependency/security patch cadence.

---

## End-to-End Verification Checklist

## Repo split success
- [ ] Backend builds and runs from `zentragig-api` repo alone.
- [ ] Frontend builds and runs from `zentragig-frontend` repo alone.
- [ ] API communication works via `VITE_API_BASE_URL`.

## Production readiness
- [ ] Backend deployed and healthy on Render.
- [ ] `api.zentragig.com` live with TLS.
- [ ] CORS restricted correctly.
- [ ] Service role key only in backend env.
- [ ] Monitoring + alerts active.

## Functional smoke test
- [ ] Sign in/out
- [ ] Auth bootstrap
- [ ] Dashboard data load
- [ ] Notifications/messages counts
- [ ] Proposal and contest flows
- [ ] Retry recovery works after backend restart (no hard tab refresh required)

---

## Suggested Timeline
- Day 1: Repo split and standalone backend verification.
- Day 2: Staging integration and flow tests.
- Day 3: Render production deploy + custom domain.
- Day 4: Monitoring tuning + cleanup.

---

## Notes
- Keep auth transition realistic: frontend may still use Supabase auth client until full auth proxy strategy is complete.
- Treat this as an incremental migration, not a big-bang rewrite.
