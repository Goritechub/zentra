# Auth Bootstrap Refactor

## Implementation Checklist

- [x] Define the auth bootstrap target state and phased rollout
- [x] Introduce explicit bootstrap status in `useAuth`
- [x] Separate bootstrap readiness from later full-profile hydration
- [x] Update `AuthGuard` to block on bootstrap state instead of partial profile state
- [x] Update `RoleGuard` to route from bootstrap role
- [x] Normalize header behavior for bootstrap-ready vs profile-hydrating states
- [x] Replace blank `return null` fallbacks on the highest-impact protected pages
- [x] Add a dedicated onboarding / incomplete-account route
- [x] Reduce duplicate page-level auth/profile fetch assumptions

## Problem

The current auth flow treats `session`, `profile`, and `admin status` as one combined gate.

That creates a bad failure mode:

- Supabase auth session is valid
- `profiles` fetch is slow, missing, or transiently fails
- parts of the app treat the user as signed in
- other parts of the app wait for `profile`
- the UI enters a half-authenticated state

Symptoms already visible in the codebase:

- some protected routes render with `user` but no `profile`
- header shows inconsistent controls depending on viewport and component branch
- some pages return `null` if `profile` is missing
- some pages still work because they only depend on `user`

This is not mainly an Edge Functions problem. It is an auth bootstrap design problem.

## Root Cause

`src/hooks/useAuth.tsx` currently does all of this during bootstrap:

1. resolve session
2. fetch full `profiles` row
3. check `user_roles` for admin
4. only then settle auth state

That means routing depends on full profile hydration.

The app currently uses `profile` for two different concerns:

- routing identity
  - role
  - admin / non-admin path decisions
  - whether onboarding is complete
- rich profile data
  - avatar
  - phone
  - location
  - optional fields

Those should not share the same critical path.

## Refactor Goal

Split auth state into two layers:

1. bootstrap identity
2. full profile data

The app should route based on a small, reliable bootstrap state, not a full profile fetch.

## Target State

### 1. Introduce a lightweight bootstrap model

Create a bootstrap auth object with only the fields needed to safely route:

- `user`
- `session`
- `role`
- `is_admin`
- `onboarding_complete`
- `auth_bootstrap_status`

Suggested bootstrap status values:

- `loading`
- `authenticated_ready`
- `authenticated_incomplete`
- `unauthenticated`
- `error`

This should become the source of truth for route guards.

### 2. Stop using full `profile` as a route gate

Full profile loading should happen after bootstrap and be treated as page data, not auth truth.

That means:

- route guards use bootstrap state
- headers use bootstrap state for core nav
- profile-heavy pages can still fetch/refresh full profile separately

### 3. Separate onboarding completion from profile hydration

The app needs a single answer to:

`Can this user enter the main app yet?`

That should not require loading the entire `profiles` row.

Use a dedicated onboarding completion rule such as:

- required role exists
- required username exists
- any mandatory first-run setup is complete

Return one boolean for this.

### 4. Remove global admin lookup from the heavy path where possible

The app currently checks admin role for every authenticated user.

Preferred options:

- fetch role/admin flags in one small bootstrap query
- or cache them in auth metadata / a compact bootstrap source
- avoid extra cross-table auth bootstrap queries where not needed

## Recommended Data Model

### Option A: Bootstrap From A Slim DB Query

After session resolves, fetch only a tiny subset:

- from `profiles`
  - `id`
  - `role`
  - `username`
- from `user_roles`
  - admin existence only

Derive:

- `onboarding_complete = !!role && !!username`
- `is_admin = user_roles contains admin`

This is the safest near-term approach because it fits the current schema.

### Option B: Move Bootstrap Claims Into Auth Metadata

Store bootstrap claims in Supabase auth metadata:

- `role`
- `username_set`
- `onboarding_complete`

Pros:

- fewer boot queries
- faster route decision

Cons:

- metadata drift risk
- requires strict synchronization whenever profile changes

This is better only if maintained carefully.

### Recommended Choice

Use **Option A first**.

Reason:

- smallest migration risk
- minimal schema disruption
- fixes the current problem without inventing a new sync problem

## Proposed Hook Design

Refactor `useAuth` into something like:

```ts
type BootstrapStatus =
  | "loading"
  | "authenticated_ready"
  | "authenticated_incomplete"
  | "unauthenticated"
  | "error";

interface AuthBootstrap {
  user: User | null;
  session: Session | null;
  role: "client" | "freelancer" | "admin" | null;
  isAdmin: boolean;
  onboardingComplete: boolean;
  status: BootstrapStatus;
}
```

Then expose profile separately:

```ts
interface FullProfileState {
  profile: Profile | null;
  profileLoading: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
}
```

So `useAuth()` becomes conceptually:

- bootstrap auth state
- full profile state

not just one `loading` boolean plus `profile`.

## Routing Rules

### AuthGuard

`AuthGuard` should use bootstrap status, not `profile`.

Rules:

- `loading` -> spinner
- `unauthenticated` -> redirect to `/auth`
- `authenticated_incomplete` -> redirect to onboarding
- `authenticated_ready` -> allow route
- `error` -> show recovery screen or retry state

### RoleGuard

`RoleGuard` should use `role` from bootstrap state.

It should not block on full profile loading.

### Admin Routing

Admin routing should depend on `isAdmin` from bootstrap state.

No separate admin flash-prevention logic should be required at page level.

## Onboarding Strategy

Create a dedicated onboarding route, for example:

- `/onboarding`

This route handles:

- first-time Google users
- any authenticated user with incomplete bootstrap state

Minimum onboarding fields:

- role
- username

Optional fields can remain for later profile editing.

This removes the need to overload `/auth` with all bootstrap recovery behavior.

## Header Strategy

The header should render based on bootstrap state, not full profile presence.

Example:

- if unauthenticated:
  - show `Sign In`
  - show `Get Started`
- if authenticated but incomplete:
  - show `Complete setup`
  - show `Sign Out`
- if authenticated and ready:
  - show normal app nav

Do not show:

- desktop skeleton with no account actions
- mobile account actions that disagree with desktop

Header and mobile menu should use the same state rules.

## Page Strategy

Pages should be split into three categories.

### 1. Route-gated pages

Examples:

- dashboard
- messages
- contracts
- jobs

These should rely on bootstrap auth state only.

### 2. Profile-heavy pages

Examples:

- my profile
- expert profile management

These can render a local skeleton if full profile data is still loading.

They should not return `null` forever if profile fails.

### 3. Hybrid pages

Examples:

- messages page
- contract detail

These may route based on bootstrap role, while loading richer participant/profile data separately.

## Failure Handling

### Current Bad Failure

Authenticated session + failed profile fetch currently leads to undefined UI behavior.

### Target Failure Behavior

If bootstrap query fails:

- keep user authenticated
- show a recoverable blocking state
- provide:
  - retry
  - sign out
  - optional support message

If full profile fetch fails:

- app shell may still load if bootstrap is valid
- only profile-dependent sections should degrade

This is the key separation.

## Performance Improvements

### 1. Use a slimmer bootstrap query

Do not fetch full `profiles.*` just to determine route state.

### 2. Reduce duplicated auth-time reads

Current auth boot logic does:

- session resolution
- profile query
- admin query

Some pages then immediately do more profile-related reads.

Minimize that first hop.

### 3. Defer non-critical data

Do not block route entry on:

- avatar
- phone
- city/state
- optional freelancer data

### 4. Add explicit timeouts and fallback states

If bootstrap query exceeds a threshold:

- remain on blocking auth bootstrap screen
- show retry
- do not partially enter the app

## Suggested Implementation Phases

### Phase 1: Stabilize Routing

Goal:

- eliminate half-authenticated rendering

Changes:

- add bootstrap status to `useAuth`
- update `AuthGuard`
- update `RoleGuard`
- stop relying on `profile` for route gating

Files likely affected:

- `src/hooks/useAuth.tsx`
- `src/components/AuthGuard.tsx`
- `src/components/RoleGuard.tsx`
- `src/App.tsx`

### Phase 2: Normalize Header Behavior

Goal:

- consistent account UI while bootstrap/profile state changes

Changes:

- update `Header.tsx`
- remove viewport-specific logic divergence
- add explicit incomplete-auth state

Files likely affected:

- `src/components/layout/Header.tsx`

### Phase 3: Stop Blank Screens

Goal:

- no `return null` on missing profile for protected pages

Changes:

- replace null returns with:
  - route-level redirect
  - setup prompt
  - local loading/error state

Files likely affected:

- `src/pages/Dashboard.tsx`
- `src/pages/MyProfile.tsx`
- any similar page using `if (!user || !profile) return null`

### Phase 4: Add Dedicated Onboarding

Goal:

- one canonical place for incomplete accounts

Changes:

- add `/onboarding`
- redirect incomplete users there
- move first-time Google completion logic there if desired

Files likely affected:

- `src/pages/Auth.tsx`
- new onboarding page/component
- route config in `src/App.tsx`

### Phase 5: Optimize Bootstrap Query

Goal:

- reduce latency and auth startup work

Changes:

- replace full profile bootstrap fetch with minimal select
- revisit admin status lookup pattern

## Concrete Code Smells To Remove

### In `useAuth.tsx`

- using full profile fetch as auth truth
- settling `loading = false` while profile can still be null and semantically required

### In `AuthGuard.tsx`

- allowing authenticated user through without validated bootstrap readiness

### In `Header.tsx`

- showing messages nav for any `user`
- hiding account actions until full profile exists
- desktop/mobile divergence

### In protected pages

- `if (!user || !profile) return null`
- page-level routing decisions based on incomplete profile state

## Recommended First Implementation

If this is tackled now, the best first refactor is:

1. add `bootstrapStatus`, `role`, and `onboardingComplete` to `useAuth`
2. change `AuthGuard` and `RoleGuard` to use those values
3. make `Header` consistent with bootstrap state
4. replace null-return pages with explicit fallbacks

This gives the biggest reliability gain without requiring a schema change.

## Expected Outcome

After the refactor:

- session-valid users will not partially enter the app without a valid bootstrap state
- slow profile fetches will no longer create broken mixed UI
- messages/contracts/dashboard will behave consistently
- onboarding and routing logic will be easier to reason about
- profile loading can be slower without breaking auth correctness

## Non-Goals

This refactor should not attempt all of these at once:

- redesign full profile editing UX
- rework every page’s data fetching strategy
- move all role data into auth metadata immediately

Keep the first pass focused on auth bootstrap correctness.
