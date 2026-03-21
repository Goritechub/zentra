# Render Deployment Runbook (Backend + Frontend)

## Scope
- Deploy Nest backend (`server/`) as a dedicated Render Web Service.
- Deploy frontend as a static site (Render Static Site or existing frontend host).
- Wire production domain, CORS, health checks, env vars, and rollback process.

## Target URLs
- Frontend: `https://zentragig.com`
- API: `https://api.zentragig.com`

---

## 1) Backend Service on Render

## Create Web Service
- Service type: `Web Service`
- Root directory: `server`
- Runtime: `Node`
- Region: nearest to primary users
- Build command: `npm ci && npm run build`
- Start command: `npm run start:prod`
- Health check path: `/health`

## Minimum instance recommendation
- Start with at least 1 always-on instance (no sleep/cold start plan if possible).

---

## 2) Required Backend Environment Variables

- `NODE_ENV=production`
- `PORT=10000` (Render default internal)
- `SUPABASE_URL=<your supabase project url>`
- `SUPABASE_SERVICE_ROLE_KEY=<service role key>`
- `FRONTEND_ORIGIN=https://zentragig.com`
- `FRONTEND_ORIGIN_PREVIEW=https://*.onrender.com` (optional, if you allow preview)

Optional:
- `LOG_LEVEL=info`
- `SENTRY_DSN=<dsn>`

Important:
- Never place `SUPABASE_SERVICE_ROLE_KEY` in frontend env.

---

## 3) Frontend Config

If frontend is on Render Static Site:
- Build command: `npm ci && npm run build`
- Publish directory: `dist`

Frontend env:
- `VITE_API_BASE_URL=https://api.zentragig.com`
- Keep only public Supabase vars if still needed during auth transition:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

---

## 4) CORS Policy (Backend)

Production allowlist should include only:
- `https://zentragig.com`
- `https://www.zentragig.com` (if used)
- Optional preview domains if needed

Do not use `*` in production for app API CORS.

---

## 5) Custom Domain + TLS

## API domain
- Add custom domain to backend service: `api.zentragig.com`
- In DNS, create CNAME (or ALIAS/ANAME per DNS provider) to Render target.
- Wait for certificate provisioning (Render-managed TLS).

## Frontend domain
- Point apex/subdomain per your frontend host setup.
- Ensure HTTPS redirect enabled.

---

## 6) Health, Restart, and Reliability

- Health endpoint: `GET /health` returns 200 only when app is ready.
- Render health checks enabled on `/health`.
- Auto-restart on crash enabled by platform defaults.
- Keep startup time low to avoid probe flaps.

Recommended:
- Add readiness logs at startup:
  - config loaded
  - db/supabase client initialized
  - server listening

---

## 7) Logs and Alerts

## Logs
- Use structured logs for:
  - request method/path/status/duration
  - auth/bootstrap failures
  - upstream Supabase errors

## Alerts
- Alert on:
  - repeated health check failures
  - high 5xx rate
  - latency spikes

If using external monitoring (Sentry/Datadog), attach release version to logs.

---

## 8) Zero-Downtime / Safe Deploy Pattern

- Use Render auto-deploy from main branch.
- Prefer immutable builds and atomic switch.
- Before deploy:
  - `server` build passes
  - frontend build passes
  - smoke tests against staging/preview pass

Post-deploy smoke checks:
1. `GET /health` is `200`
2. Auth bootstrap succeeds
3. Notifications/messages endpoints respond
4. Key pages load without hard refresh

Rollback trigger:
- Health flapping > 3 min
- Major auth/bootstrap breakage
- Elevated 5xx sustained

Rollback action:
- Roll back to previous Render deploy from dashboard.

---

## 9) Render Blueprint (Optional)

Create `render.yaml` at repo root if you want infra as code:

```yaml
services:
  - type: web
    name: zentragig-api
    runtime: node
    rootDir: server
    buildCommand: npm ci && npm run build
    startCommand: npm run start:prod
    healthCheckPath: /health
    autoDeploy: true
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: FRONTEND_ORIGIN
        value: https://zentragig.com
```

Note:
- Keep secret vars `sync: false` and set them in Render dashboard.

---

## 10) Production Cutover Checklist

1. Backend deployed and healthy on Render URL.
2. API custom domain `api.zentragig.com` active with TLS.
3. Frontend `VITE_API_BASE_URL` points to API custom domain.
4. CORS allowlist set to production frontend origin(s).
5. Smoke test login/bootstrap/dashboard/messages/notifications.
6. Monitor logs for 15-30 minutes.
7. Announce cutover complete.

---

## 11) Post-Cutover Cleanup

- Remove old localhost/dev fallback API URLs from production env.
- Lock down any temporary preview CORS if no longer needed.
- Continue frontend Supabase exit plan until only auth transition pieces remain.
