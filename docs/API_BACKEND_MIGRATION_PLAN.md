# API Backend Migration Plan

## Goal

Move ZentraGig from:

- frontend calling Supabase directly

to:

- frontend calling explicit backend endpoints with `axios`
- app state managed through Redux
- business logic handled server-side
- Supabase reduced to infrastructure, not the main app backend surface

This is the target model:

`React app -> Axios API client -> Backend service -> Postgres/Auth/Storage`

---

## Why This Change

The current architecture is too coupled at the frontend layer.

Current problems:

- auth/bootstrap and page data are too intertwined
- pages directly orchestrate database queries
- business rules live in many places at once
- route rendering is affected by network timing
- frontend is doing too much protected-state reasoning
- direct Supabase usage makes failures feel like UI instability

This is manageable for a simpler app. It is not the right long-term structure for:

- contracts
- proposals
- escrow
- wallet operations
- disputes
- admin controls
- onboarding and role enforcement

---

## Recommended Target Stack

### Frontend

- React
- React Router
- Axios
- Redux Toolkit
- Redux Toolkit Query optional later, but not required in phase 1

### Backend

Choose one:

- `NestJS` if you want strong structure and long-term maintainability
- `Express` or `Fastify` if you want faster initial build

Recommended: `NestJS`

Reason:

- better module boundaries
- better DTO validation
- better scaling for auth, jobs, contracts, wallet, disputes, admin

### Data Layer

- Postgres
- Prisma or Drizzle

Recommended: `Prisma`

Reason:

- easiest for a team that wants clear service/repository patterns

### Infra

- keep Supabase Postgres for now
- keep Supabase Storage for now
- keep Supabase Auth temporarily or replace later

This avoids a full infrastructure migration during the architecture fix.

---

## Core Principle

Do not migrate everything at once.

Move from:

- `page -> supabase query`

to:

- `page -> redux thunk / async action -> axios -> backend endpoint`

in slices.

---

## Target Frontend Structure

```text
src/
  api/
    axios.ts
    auth.api.ts
    jobs.api.ts
    contracts.api.ts
    wallet.api.ts
    proposals.api.ts
    contests.api.ts
    notifications.api.ts
    admin.api.ts

  app/
    store.ts
    hooks.ts

  features/
    auth/
      authSlice.ts
      authThunks.ts
      authSelectors.ts
      types.ts

    jobs/
      jobsSlice.ts
      jobsThunks.ts
      jobsSelectors.ts
      types.ts

    contracts/
      contractsSlice.ts
      contractsThunks.ts
      contractsSelectors.ts
      types.ts

    wallet/
      walletSlice.ts
      walletThunks.ts
      walletSelectors.ts
      types.ts

    proposals/
      proposalsSlice.ts
      proposalsThunks.ts
      proposalsSelectors.ts
      types.ts

    notifications/
      notificationsSlice.ts
      notificationsThunks.ts
      notificationsSelectors.ts
      types.ts

  services/
    authStorage.ts
    errorMapper.ts
    session.ts

  types/
    api.ts
    models.ts
```

---

## Target Backend Structure

If using NestJS:

```text
server/
  src/
    main.ts
    app.module.ts

    common/
      guards/
      interceptors/
      filters/
      decorators/
      dto/
      utils/

    modules/
      auth/
        auth.controller.ts
        auth.service.ts
        auth.module.ts
        dto/

      users/
        users.controller.ts
        users.service.ts
        users.module.ts

      jobs/
        jobs.controller.ts
        jobs.service.ts
        jobs.module.ts
        dto/

      proposals/
        proposals.controller.ts
        proposals.service.ts
        proposals.module.ts

      contracts/
        contracts.controller.ts
        contracts.service.ts
        contracts.module.ts

      wallet/
        wallet.controller.ts
        wallet.service.ts
        wallet.module.ts

      contests/
        contests.controller.ts
        contests.service.ts
        contests.module.ts

      notifications/
        notifications.controller.ts
        notifications.service.ts
        notifications.module.ts

      admin/
        admin.controller.ts
        admin.service.ts
        admin.module.ts

    prisma/
      prisma.service.ts
      schema.prisma
```

---

## Auth Model Recommendation

### Near-Term

Keep Supabase Auth temporarily.

Frontend:

- sign in through backend endpoints
- backend validates and returns app-facing session payload

Backend:

- verify Supabase JWT
- expose `/auth/session`
- expose `/auth/bootstrap`
- expose `/auth/logout`

### Later

Optional:

- move completely off Supabase Auth to custom JWT/session auth

Do not do this first.

---

## What Moves First

### Phase 1: Backend Skeleton

Deliver:

- backend app
- health endpoint
- auth middleware
- shared response/error format
- axios client in frontend
- Redux store bootstrapped

Minimal frontend additions:

- `src/api/axios.ts`
- `src/app/store.ts`
- `src/app/hooks.ts`
- `src/features/auth/authSlice.ts`

### Phase 2: Auth Bootstrap Endpoint

Replace frontend auth bootstrap logic first.

Build endpoint:

- `GET /auth/bootstrap`

It should return only:

- user id
- role
- username
- onboarding complete
- admin flag
- display name
- avatar

This replaces the current frontend bootstrap RPC dance.

Frontend impact:

- `useAuth` becomes thin
- Redux `auth` slice owns session/bootstrap state
- route guards read from Redux only

This is the highest-value first move.

### Phase 3: Jobs Module

Move these pages first:

- jobs list
- client jobs
- job details
- proposals received

Reason:

- high traffic
- currently query-heavy
- easiest visible improvement

Example endpoints:

- `GET /jobs`
- `GET /jobs/:id`
- `GET /client/jobs`
- `GET /client/jobs/:jobId/proposals`

### Phase 4: Contracts + Messages

Move:

- contracts list
- contract detail
- messages list
- contract messages

Example endpoints:

- `GET /contracts`
- `GET /contracts/:id`
- `GET /messages/conversations`
- `GET /contracts/:id/messages`
- `POST /contracts/:id/messages`

### Phase 5: Wallet + Transactions

Move:

- wallet balance
- transactions page
- fund wallet
- withdraw
- auth-code protected actions

Example endpoints:

- `GET /wallet`
- `GET /wallet/transactions`
- `POST /wallet/fund`
- `POST /wallet/withdraw`

### Phase 6: Contests, Services, Notifications

Move the rest of the marketplace flows.

### Phase 7: Admin

Move admin last or near-last because it has the most varied actions.

---

## Redux State Recommendation

Do not put everything into one giant store slice.

Recommended slices:

- `auth`
- `jobs`
- `contracts`
- `wallet`
- `proposals`
- `notifications`
- `ui`

### Example `auth` slice state

```ts
type AuthState = {
  user: {
    id: string;
    role: "client" | "freelancer" | "admin" | null;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    onboardingComplete: boolean;
  } | null;
  status: "idle" | "loading" | "authenticated" | "unauthenticated" | "error";
  error: string | null;
};
```

### Example `jobs` slice state

```ts
type JobsState = {
  items: Job[];
  selectedJob: Job | null;
  status: "idle" | "loading" | "succeeded" | "failed";
  refreshStatus: "idle" | "refreshing";
  error: string | null;
};
```

Important:

- distinguish first load from refresh
- never use one `loading` flag for everything

---

## Axios Structure Recommendation

### `src/api/axios.ts`

Responsibilities:

- base URL
- auth header injection
- response normalization
- centralized error mapping

Example shape:

```ts
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### API files

Example:

- `jobs.api.ts`
- `contracts.api.ts`
- `wallet.api.ts`

Each file should export plain request functions only.

No UI logic.

---

## UI State Rules

These rules matter more than the library choice.

### Rule 1

Never full-screen block a route after it has rendered once successfully.

### Rule 2

Use separate state for:

- initial load
- background refresh
- mutation in progress

### Rule 3

Keep stale content visible during refresh.

### Rule 4

Only guards auth state, not page data.

Meaning:

- route guard checks whether user may enter
- page decides how to refresh its own content

### Rule 5

Sensitive flows only block when the user initiates them.

Example:

- auth code check should happen on withdrawal click
- not on page load

---

## What Should Stop Living in Frontend Pages

Move these out of page components:

- multi-query joins
- role-based business branching
- wallet eligibility checks
- contract status transition logic
- dispute resolution preparation
- onboarding completion rules
- offer/proposal acceptance rules

Pages should not decide business state.

Pages should consume shaped data from the backend.

---

## API Response Shape

Use a consistent response structure.

Example:

```json
{
  "success": true,
  "data": { },
  "message": null
}
```

Error shape:

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "You do not have enough balance to fund this milestone."
  }
}
```

This makes frontend reducers and error banners much simpler.

---

## Migration Rules

### Rule 1

Do not rewrite all pages at once.

### Rule 2

For each module:

1. create backend endpoint
2. create axios API file
3. create Redux slice/thunks
4. swap one page to the new flow
5. remove direct Supabase calls from that page

### Rule 3

Keep Supabase only as implementation detail until replacement is complete.

### Rule 4

Do not mix direct Supabase calls and endpoint calls in the same feature for long.

Short transition is fine.
Permanent hybrid logic becomes messy quickly.

---

## Recommended First Concrete Endpoints

Build these first:

- `GET /auth/bootstrap`
- `GET /jobs`
- `GET /client/jobs`
- `GET /contracts`
- `GET /messages/conversations`
- `GET /wallet`

These remove the biggest frontend instability first.

---

## Realtime Recommendation

Do not make page rendering depend on websocket health.

Use realtime only to:

- invalidate cached data
- append new messages
- update notification badges

If websocket fails:

- keep page usable
- fall back to periodic polling or manual refresh

---

## Phase-by-Phase Delivery Order

1. Backend skeleton
2. Axios + Redux foundation
3. Auth bootstrap endpoint
4. Jobs module
5. Contracts + messages
6. Wallet + transactions
7. Offers + proposals
8. Contests + services
9. Admin
10. Remove remaining direct Supabase frontend calls

---

## Success Criteria

You are done when:

- route access no longer depends on frontend DB choreography
- pages do not full-screen reload on tab return
- business logic is server-side
- frontend mainly consumes shaped endpoint responses
- state transitions are observable in Redux
- Supabase becomes infra, not frontend architecture

---

## Immediate Next Step

Create the backend foundation and move auth bootstrap first.

Do not start with wallet or contests.

Best first implementation sequence:

1. add backend app
2. add `GET /auth/bootstrap`
3. add axios base client
4. add Redux auth slice
5. replace current `useAuth` bootstrap with backend bootstrap

That gives the biggest stability gain with the least risky first cut.

---

## Checklist

### Phase 1: Backend Foundation

- [x] Create `server/` application
- [x] Choose backend framework and lock it in
- [ ] Add environment config handling
- [ ] Add global error handler
- [ ] Add request validation layer
- [ ] Add auth middleware / JWT verification
- [x] Add health endpoint: `GET /health`
- [ ] Add database access layer
- [x] Add backend folder/module structure
- [ ] Add shared API response format

### Phase 2: Frontend API Foundation

- [x] Add `src/api/axios.ts`
- [x] Add `src/app/store.ts`
- [x] Add `src/app/hooks.ts`
- [x] Add Redux provider to app root
- [x] Add `auth` slice scaffold
- [ ] Add shared request/error helpers
- [ ] Add `VITE_API_BASE_URL`
- [ ] Confirm frontend can call backend health endpoint

### Phase 3: Auth Bootstrap Migration

- [ ] Create `GET /auth/bootstrap`
- [ ] Return minimal user/bootstrap payload only
- [ ] Add frontend `auth.api.ts`
- [ ] Add Redux `authThunks.ts`
- [ ] Move bootstrap state into Redux
- [ ] Refactor `useAuth` to consume Redux/bootstrap endpoint
- [ ] Remove direct bootstrap RPC dependency from frontend
- [ ] Keep cached bootstrap state in Redux/local storage
- [ ] Verify tab leave/return no longer destabilizes auth

### Phase 4: Jobs Module Migration

- [ ] Create `GET /jobs`
- [ ] Create `GET /jobs/:id`
- [ ] Create `GET /client/jobs`
- [ ] Create `GET /client/jobs/:jobId/proposals`
- [ ] Add `jobs.api.ts`
- [ ] Add `jobs` Redux slice
- [ ] Migrate `Jobs.tsx`
- [ ] Migrate `ClientJobs.tsx`
- [ ] Migrate `JobDetails.tsx`
- [ ] Migrate `ProposalsReceived.tsx`
- [ ] Remove direct Supabase calls from these pages

### Phase 5: Contracts and Messages Migration

- [ ] Create `GET /contracts`
- [ ] Create `GET /contracts/:id`
- [ ] Create `GET /messages/conversations`
- [ ] Create `GET /contracts/:id/messages`
- [ ] Create `POST /contracts/:id/messages`
- [ ] Add `contracts.api.ts`
- [ ] Add `messages.api.ts`
- [ ] Add `contracts` Redux slice
- [ ] Add `messages` Redux slice
- [ ] Migrate `ContractsPage.tsx`
- [ ] Migrate `ContractDetail.tsx`
- [ ] Migrate `Messages.tsx`
- [ ] Make websocket/realtime optional, not required for rendering

### Phase 6: Wallet and Transactions Migration

- [ ] Create `GET /wallet`
- [ ] Create `GET /wallet/transactions`
- [ ] Create `POST /wallet/fund`
- [ ] Create `POST /wallet/withdraw`
- [ ] Create auth-code verification endpoints if needed
- [ ] Add `wallet.api.ts`
- [ ] Add `wallet` Redux slice
- [ ] Migrate `Transactions.tsx`
- [ ] Remove route-level security checks that belong to backend

### Phase 7: Offers and Proposal Management

- [ ] Create `GET /offers/received`
- [ ] Create `GET /offers/sent`
- [ ] Create `GET /proposals/mine`
- [ ] Create accept/reject/withdraw endpoints
- [ ] Add `offers.api.ts`
- [ ] Extend proposals Redux slice
- [ ] Migrate `ExpertProposals.tsx`
- [ ] Migrate `ReceivedOffers.tsx`
- [ ] Migrate `SentOffers.tsx`

### Phase 8: Services and Contests

- [ ] Create services endpoints
- [ ] Create contests endpoints
- [ ] Add `services.api.ts`
- [ ] Add `contests.api.ts`
- [ ] Add matching Redux slices
- [ ] Migrate `BrowseServices.tsx`
- [ ] Migrate `MyServices.tsx`
- [ ] Migrate `BrowseContests.tsx`
- [ ] Migrate `ContestDetail.tsx`
- [ ] Migrate `MyContests.tsx`
- [ ] Migrate `ContestEntries.tsx`

### Phase 9: Notifications and Support

- [ ] Create `GET /notifications`
- [ ] Create `POST /notifications/read`
- [ ] Add `notifications.api.ts`
- [ ] Add `notifications` Redux slice
- [ ] Migrate notification flows
- [ ] Decouple rendering from realtime websocket availability

### Phase 10: Admin Migration

- [ ] Create admin auth/permission middleware
- [ ] Create admin users/jobs/contracts/payments endpoints
- [ ] Add `admin.api.ts`
- [ ] Add admin Redux slices as needed
- [ ] Migrate admin pages incrementally

### Phase 11: Supabase Frontend Decoupling

- [ ] Audit remaining direct Supabase imports in `src/`
- [ ] Remove direct database reads from frontend features already migrated
- [ ] Leave only infra-specific client code where still intentionally used
- [ ] Document which services still depend on Supabase directly

### Phase 12: Cleanup and Stabilization

- [ ] Standardize loading states across all pages
- [ ] Standardize API error banners and retry behavior
- [ ] Add request timing logs in backend
- [ ] Add frontend request error instrumentation
- [ ] Remove temporary migration shims
- [ ] Update README and architecture docs

### Phase 1 Immediate Task List

- [x] Create `server/` directory
- [x] Initialize backend project
- [x] Add health route
- [x] Add auth bootstrap route scaffold
- [x] Add frontend axios client
- [x] Add Redux Toolkit dependencies
- [x] Add Redux store/provider
- [x] Add empty auth slice
- [ ] Wire frontend to call backend health route
