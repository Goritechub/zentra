# AUTH_SYSTEM_MAP.md — Full Authentication System Audit

**Generated:** 2026-03-10  
**Project:** ZentraGig Marketplace

---

## 1. AUTH FLOW OVERVIEW

### Signup Flow (Email/Password)
1. User visits `/auth` → selects "Sign Up" tab → chooses role (Client or Expert)
2. Fills form: Full Name, Username, Email, Password, Occupation → accepts Terms
3. Completes reCAPTCHA v2 checkbox → token sent to `verify-recaptcha` edge function
4. Username uniqueness checked via `profiles` table query
5. `supabase.auth.signUp()` called with `user_metadata: { full_name, username }`
6. **Email confirmation required** (auto-confirm is NOT enabled)
7. Occupation stored in `localStorage` as `pending_occupation` (applied after first login)
8. Success screen shown → user must verify email before signing in

### Signup Flow (Google OAuth)
1. User clicks "Sign in with Google" on either sign-in or sign-up tab
2. Desired role stored in `localStorage` as `pending_oauth_role` with timestamp
3. `lovable.auth.signInWithOAuth("google")` called (via `@lovable.dev/cloud-auth-js`)
4. User redirected to Google → returns to `window.location.origin`
5. On return, `onAuthStateChange` fires → `useAuth` loads session
6. Post-OAuth `useEffect` in `Auth.tsx` polls for profile (up to 10 retries, 300ms apart)
7. If profile is < 30 seconds old (new user), role updated from default `client` to intended role
8. Existing users: role is never overridden

### Profile Creation (Database Trigger)
- **Trigger:** `on_auth_user_created` on `auth.users`
- **Function:** `handle_new_user()` (SECURITY DEFINER)
- **Behavior:** Inserts into `public.profiles` with:
  - `id` = `NEW.id`
  - `email` = `NEW.email`
  - `full_name` = `user_metadata.full_name` (or empty string)
  - `role` = **hardcoded `'client'`** (ignores any metadata role — prevents privilege escalation)
  - `username` = `user_metadata.username`

### Login Flow
1. User visits `/auth` → enters email/username + password
2. If username entered (no `@`), lookup `profiles.email` by username (10s timeout)
3. `supabase.auth.signInWithPassword()` called (10s timeout)
4. On success: immediate navigation (no waiting for profile fetch)
5. Route determined by: `user_roles` table check for admin → `user_metadata.role` for freelancer/client
6. Error mapping translates Supabase codes to user-friendly messages (429, 503, network, etc.)

### Session Validation
- `useAuth` hook sets up `onAuthStateChange` listener FIRST, then calls `getSession()`
- Session resolved → `loading=false` immediately (unblocks auth gate)
- Profile fetched in background with 3 retries + exponential backoff (300ms, 600ms, 900ms)
- Latest-call-wins pattern prevents stale state from overlapping fetches

### Auth Code Verification (2FA-like)
- 6-digit numeric code, hashed with PBKDF2-HMAC-SHA256 (100,000 iterations)
- **Setup:** Prompted after login via `AuthCodeSetupGuard` (dismissable for 24h)
- **Enforcement:** Required before sensitive actions via `useRequireAuthCode` hook
- **Admin gate:** Admin panel requires auth code verification on every session

### Role Assignment
- All new users → `'client'` role via `handle_new_user` trigger (hardcoded)
- OAuth users: role updated post-redirect if profile is < 30 seconds old
- Admin role: stored in `user_roles` table (separate from `profiles.role`)
- Role switching: users can switch between client/freelancer via account menu

### Auth Guards / Route Protection
1. **`AuthGuard`** — Wraps authenticated routes; redirects guests to `/auth?redirect=...`; redirects admins to `/admin`; wraps children in `AuthCodeSetupGuard`
2. **`RoleGuard`** — Blocks users with wrong `profile.role` from specific routes
3. **`AdminLayout`** — Checks `user_roles` for admin, verifies auth code per-session, checks suspension status, enforces permission-based nav filtering

---

## 2. AUTH-RELATED DATABASE TABLES

### `auth.users` (Supabase managed)
- **Purpose:** Core authentication table (email, password hash, metadata)
- **Trigger:** `on_auth_user_created` → calls `handle_new_user()`
- **Read by:** Edge functions (via `getUser()`), `handle_new_user` trigger
- **Written by:** `supabase.auth.signUp()`, `supabase.auth.admin.createUser()`, `delete_user_account`, `admin_close_user_account`

### `profiles`
- **Purpose:** Public user profile data linked to auth.users
- **Key columns:** `id` (matches auth.users.id), `email`, `full_name`, `username`, `role` (user_role enum: client/freelancer/admin), `avatar_url`, `is_verified`, `auth_code_dismissed_at`, `occupation`, `theme_preference`, `full_name_edited`, `username_edited`
- **RLS:** Users can read/update own profile; profiles are publicly readable for some fields
- **Trigger:** `update_profiles_updated_at` (auto-updates `updated_at`)
- **Read by:** `useAuth` (fetchProfile), Auth.tsx (username lookup, occupation apply), AdminLayout, many pages
- **Written by:** `handle_new_user` trigger, Auth.tsx (OAuth role update, occupation update), MyProfile page

### `user_roles`
- **Purpose:** RBAC role assignments (separate from profiles.role to prevent privilege escalation)
- **Columns:** `id`, `user_id`, `role` (app_role enum: admin/moderator/user), `created_at`
- **RLS:** No public read policies visible (likely read by `has_role` SECURITY DEFINER function)
- **Read by:** Auth.tsx (admin check on login), AdminLayout (admin verification), `has_role()` function (used in all RLS policies)
- **Written by:** `manage-admin` edge function (create_admin, remove_admin, bootstrap)

### `auth_codes`
- **Purpose:** Stores PBKDF2-hashed 6-digit security codes
- **Columns:** `user_id` (PK), `auth_code_hash`, `created_at`, `updated_at`
- **RLS:** Users can SELECT own code only; no INSERT/UPDATE/DELETE from client (managed by edge function via service role)
- **Read by:** `auth-code` edge function
- **Written by:** `auth-code` edge function (set, change, reset), `manage-admin` edge function (create_admin, reset_admin_code)

### `admin_permissions`
- **Purpose:** Granular permission assignments for admin users
- **Columns:** `id`, `user_id`, `permission` (string), `granted_by`, `created_at`
- **Permissions:** users, jobs, contests, contracts, payments, disputes, reviews, platform_settings, activity_log, admin_management
- **RLS:** Admins can insert/view (via authenticated + has_role check)
- **Read by:** AdminLayout (permission filtering), `manage-admin` edge function
- **Written by:** `manage-admin` edge function (bootstrap, create_admin, update_permissions)

### `admin_status`
- **Purpose:** Admin account suspension tracking
- **Columns:** `user_id`, `is_suspended`, `suspended_at`, `suspended_by`, `created_at`, `updated_at`
- **Read by:** `manage-admin` edge function (check_suspended)
- **Written by:** `manage-admin` edge function (suspend_admin, create_admin, bootstrap)

### `admin_activity_log`
- **Purpose:** Audit trail for all admin actions
- **Columns:** `id`, `admin_id`, `action`, `target_type`, `target_id`, `details` (jsonb), `created_at`
- **RLS:** Admins can insert and view
- **Read by:** AdminActivity page
- **Written by:** `manage-admin` edge function, various admin operations

### `wallets`
- **Purpose:** User wallet balances (used in auth checks for account deletion)
- **Relevant columns:** `user_id`, `balance`, `escrow_balance`
- **Auth relevance:** `delete_user_account` and `admin_close_user_account` check wallet balance > 0 before allowing deletion

### `kyc_verifications`
- **Purpose:** Identity verification status
- **Auth relevance:** KYC status checked before certain financial operations; linked to user identity

---

## 3. AUTH TRIGGERS

### `on_auth_user_created`
- **Table:** `auth.users`
- **Function:** `handle_new_user()`
- **SQL:**
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'client',
    NEW.raw_user_meta_data->>'username'
  );
  RETURN NEW;
END;
$function$
```
- **Behavior:** Creates a `profiles` row for every new auth user. Role is hardcoded to `'client'` regardless of metadata. This is a critical security measure preventing privilege escalation at signup.

### `update_profiles_updated_at`
- **Table:** `profiles`
- **Function:** `update_updated_at_column()`
- **Behavior:** Auto-sets `updated_at` timestamp on profile changes

---

## 4. AUTH RPC / DATABASE FUNCTIONS

### `handle_new_user()`
- **Type:** Trigger function
- **Security:** SECURITY DEFINER
- **Called by:** `on_auth_user_created` trigger on `auth.users`
- **See:** Section 3 for full definition

### `has_role(_user_id uuid, _role app_role)`
- **Returns:** boolean
- **Security:** SECURITY DEFINER (stable)
- **Purpose:** Checks if a user has a specific role in `user_roles` table. Used extensively in RLS policies across all tables to gate admin access.
- **SQL:**
```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$
```
- **Called by:** RLS policies on ~20+ tables (disputes, contracts, admin_activity_log, complaints, support_chats, etc.)

### `delete_user_account(_user_id uuid)`
- **Returns:** jsonb
- **Security:** SECURITY DEFINER
- **Purpose:** Self-service account deletion. Checks wallet balance and active contracts before cascading delete across 25+ tables including `auth.users`.
- **Called from:** MyProfile page (via `supabase.rpc()`)

### `admin_close_user_account(_admin_id uuid, _target_user_id uuid)`
- **Returns:** jsonb
- **Security:** SECURITY DEFINER
- **Purpose:** Admin-initiated account closure. Additional checks: caller must be super admin, cannot close own/other super admin accounts. Same cascading delete as above.
- **Called from:** AdminUsers page (via `supabase.rpc()`)

### `is_super_admin(_user_id uuid)` (inferred)
- **Purpose:** Used inside `admin_close_user_account` to verify super admin status
- **Likely checks:** `admin_permissions` table for `admin_management` permission

---

## 5. AUTH EDGE FUNCTIONS

### `auth-code`
- **Purpose:** Manage 6-digit auth codes (set, verify, change, check, reset, check_strength)
- **Tables read:** `auth_codes` (via service role)
- **Tables written:** `auth_codes` (insert, update, delete via service role)
- **Requires JWT:** Yes (validates via `supabase.auth.getUser()`)
- **Security:** Uses PBKDF2-HMAC-SHA256 with 100k iterations, 16-byte salt. Rejects weak patterns (sequential, repeating). Service role used for all DB operations (bypasses RLS).
- **Actions:**
  - `set` — Create new code (rejects if one exists)
  - `verify` — Compare input against stored hash
  - `change` — Requires current code verification first
  - `check` — Returns `{ has_code: boolean }`
  - `reset` — Deletes code after verifying current
  - `check_strength` — Validates code pattern

### `manage-admin`
- **Purpose:** Full admin lifecycle management
- **Tables read:** `user_roles`, `admin_permissions`, `admin_status`, `profiles`
- **Tables written:** `user_roles`, `admin_permissions`, `admin_status`, `admin_activity_log`, `profiles`, `auth_codes`; also calls `supabase.auth.admin.createUser()`
- **Requires JWT:** Yes (validates admin role via `user_roles` table)
- **Actions:** bootstrap, list_admins, create_admin, update_permissions, reset_admin_code, suspend_admin, check_suspended, remove_admin
- **Security risks:**
  - Admin creation uses `email_confirm: true` (auto-confirms, bypassing email verification)
  - `bootstrap` action only runs if no permissions exist globally — first admin to trigger it gets super admin

### `verify-recaptcha`
- **Purpose:** Server-side reCAPTCHA v2 token verification
- **Tables read/written:** None
- **Requires JWT:** No (called during signup before auth)
- **Called by:** Auth.tsx signup flow

### `kyc-create-session` / `kyc-check-status` / `kyc-webhook`
- **Purpose:** KYC identity verification lifecycle
- **Auth relevance:** Linked to user identity; KYC status gates certain financial operations
- **Requires JWT:** Yes (except webhook)

---

## 6. FRONTEND AUTH FILES

### `src/hooks/useAuth.tsx`
- **Purpose:** Core auth provider — session management, profile fetching, sign-up/in/out
- **Auth state:** `user`, `session`, `profile`, `loading`, `profileLoading`
- **API calls:** `supabase.auth.getSession()`, `supabase.auth.onAuthStateChange()`, `supabase.auth.signUp()`, `supabase.auth.signInWithPassword()`, `supabase.auth.signOut()`, `supabase.from("profiles").select()`
- **Key patterns:** Latest-call-wins, 3 retry with backoff for profile fetch, loading=false on session resolve (not profile)

### `src/pages/Auth.tsx` (~1266 lines)
- **Purpose:** Combined login/signup/forgot-password page
- **Auth state reads:** `user`, `profile`, `loading`, `profileLoading`, `refreshProfile`
- **API calls:** `signUp()`, `signIn()`, `supabase.functions.invoke("verify-recaptcha")`, `supabase.from("profiles")` (username check, email lookup, occupation update), `supabase.from("user_roles")` (admin check), `lovable.auth.signInWithOAuth("google")`, `supabase.auth.resetPasswordForEmail()`, `supabase.auth.getSession()`
- **Key features:** reCAPTCHA v2, Zod validation, password strength meter, occupation field, username/email dual login, role-based redirect, OAuth role assignment

### `src/pages/ResetPassword.tsx`
- **Purpose:** Password reset form (accessed via email link)
- **Auth state reads:** Listens for `PASSWORD_RECOVERY` event via `onAuthStateChange`
- **API calls:** `supabase.auth.updateUser({ password })`
- **Security:** Only accessible with valid recovery token in URL hash

### `src/components/AuthGuard.tsx`
- **Purpose:** Route protection wrapper — redirects unauthenticated users, blocks admins from non-admin routes
- **Auth state reads:** `user`, `profile`, `loading`, `profileLoading`
- **Wraps children in:** `AuthCodeSetupGuard`

### `src/components/RoleGuard.tsx`
- **Purpose:** Role-based route restriction — blocks users with wrong `profile.role`
- **Auth state reads:** `user`, `profile`, `loading`
- **Redirect:** Wrong role → `/dashboard`

### `src/components/AuthCodeSetupGuard.tsx`
- **Purpose:** Post-login guard — prompts auth code setup if not configured (dismissable for 24h)
- **Auth state reads:** `user`, `profile` (for `auth_code_dismissed_at`)
- **API calls:** `supabase.functions.invoke("auth-code", { action: "check" })`, `supabase.functions.invoke("auth-code", { action: "set" })`, `supabase.from("profiles").update({ auth_code_dismissed_at })`

### `src/components/AuthCodeSetupModal.tsx`
- **Purpose:** Standalone modal for forced auth code setup (cannot be dismissed — used for sensitive actions)
- **API calls:** `supabase.functions.invoke("auth-code", { action: "set" })`

### `src/components/AuthCodeVerifyModal.tsx`
- **Purpose:** Modal for verifying existing auth code before sensitive actions
- **API calls:** `supabase.functions.invoke("auth-code", { action: "verify" })`
- **Fallback:** If no code set, redirects to `AuthCodeSetupModal`

### `src/hooks/useRequireAuthCode.tsx`
- **Purpose:** Hook that gates sensitive actions behind auth code check → setup → verify flow
- **API calls:** `supabase.functions.invoke("auth-code", { action: "check" })`
- **Usage:** Withdrawals, milestone funding, escrow release, payout detail changes, contest winner publishing

### `src/components/AuthCodeInput.tsx`
- **Purpose:** 6-digit OTP-style input component (used across all auth code UI)

### `src/pages/admin/AdminLayout.tsx`
- **Purpose:** Admin panel shell — verifies admin role, auth code, suspension status, permission filtering
- **Auth state reads:** `user`, `loading` from `useAuth`
- **API calls:** `supabase.from("user_roles")` (admin check), `supabase.from("admin_permissions")` (permission load), `supabase.functions.invoke("auth-code")` (verify), `supabase.functions.invoke("manage-admin")` (check_suspended, bootstrap)

### `src/integrations/lovable/index.ts`
- **Purpose:** Lovable Cloud OAuth wrapper — handles Google sign-in via `@lovable.dev/cloud-auth-js`
- **API calls:** `lovableAuth.signInWithOAuth()`, `supabase.auth.setSession()`

### `src/lib/admin-permissions.ts`
- **Purpose:** Static permission definitions and presets (Super Admin, Moderator, Dispute Adjudicator, Finance Admin)

### `src/hooks/usePlatformFreeze.tsx`
- **Purpose:** Checks if signups are paused or platform is frozen (gates signup)
- **Auth relevance:** Blocks `signUp()` when frozen

---

## 7. AUTH PERFORMANCE BOTTLENECKS

### 1. Profile Fetch on Every Auth State Change
- `loadUserAndProfile` is called on every `onAuthStateChange` event (including token refresh)
- Each call fetches the full profile from the database with up to 3 retries
- **Impact:** Unnecessary DB queries on token refresh events

### 2. Duplicate Admin Role Checks
- `Auth.tsx` redirect logic queries `user_roles` for admin check
- `AdminLayout` independently queries `user_roles` for the same check
- `AuthGuard` checks `profile.role === "admin"` (different table!)
- **Impact:** 2-3 separate queries to determine admin status on login

### 3. AuthCodeSetupGuard Check on Every Protected Page
- `AuthCodeSetupGuard` calls `supabase.functions.invoke("auth-code", { action: "check" })` on mount
- This is an edge function call (cold start possible) on every authenticated page load
- **Impact:** Adds latency to every page navigation; no caching

### 4. OAuth Profile Polling
- Post-OAuth flow polls `profiles` table up to 10 times (300ms intervals = 3 seconds worst case)
- **Impact:** Visible delay for new OAuth users

### 5. Multiple Session Checks at Startup
- `getSession()` AND `onAuthStateChange` both trigger `loadUserAndProfile`
- Latest-call-wins pattern mitigates but doesn't eliminate the double-fetch

### 6. RoleGuard Waits for Profile
- `RoleGuard` shows a loading spinner until `profile` is available
- Profile fetch is background and may take time after session resolves
- **Impact:** Brief loading flash on role-gated pages

---

## 8. AUTH ERROR SOURCES

### 1. Profile-Session Race Condition
- Session resolves immediately, but profile may not exist yet (trigger not executed)
- Auth.tsx has a fallback `useEffect` that retries profile fetch after 500ms
- **Risk:** On slow DB, profile may not exist when dashboard components query it

### 2. OAuth Role Assignment Race
- `handle_new_user` trigger creates profile with `role='client'`
- OAuth flow then updates role to intended value
- **Risk:** Brief window where profile has wrong role; components loading during this window see incorrect role

### 3. Stacked Auth Guards
- Route structure: `AuthGuard` → `AuthCodeSetupGuard` → `RoleGuard` → page component
- Each guard independently checks auth state and shows loading spinners
- **Risk:** Multiple re-renders and flash of loading states

### 4. Admin Role Source Inconsistency
- `profiles.role` can be `'admin'` but this is NOT the source of truth
- `user_roles` table is the actual admin role source (used by `has_role()` in RLS)
- `AuthGuard` checks `profile.role === "admin"` while `AdminLayout` checks `user_roles`
- **Risk:** Desync if `profiles.role` and `user_roles` diverge

### 5. Auth Code Edge Function Cold Starts
- `auth-code` and `manage-admin` edge functions may have cold start latency
- Used in critical paths (login to admin, sensitive actions)
- No client-side caching of "has_code" status

### 6. No Session Persistence Across Auth Code Verification
- Admin auth code verified state (`codeVerified`) is component state, not persisted
- If `AdminLayout` remounts (e.g., React Suspense boundary), user must re-verify
- **Risk:** Unexpected re-verification prompts

### 7. Password Reset Page Timeout
- `ResetPassword.tsx` has a 3-second fallback timeout for checking recovery token
- If `onAuthStateChange` fires late, user may see "invalid link" screen briefly

### 8. Missing Indexes (Potential)
- `profiles.username` — used for login lookup; should have unique index
- `user_roles(user_id, role)` — used by `has_role()` in every RLS check; should have unique index
- `auth_codes.user_id` — PK so indexed
- **Risk:** Without indexes, username lookup and role checks may be slow at scale

---

## 9. AUTH DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                        SIGNUP FLOW                              │
│                                                                 │
│  User → Auth.tsx (signup form)                                  │
│    ├─ reCAPTCHA → verify-recaptcha edge function                │
│    ├─ Username check → profiles table                           │
│    ├─ supabase.auth.signUp() → auth.users                      │
│    │   └─ TRIGGER: on_auth_user_created                         │
│    │       └─ handle_new_user() → profiles (role='client')      │
│    └─ Email verification required                               │
│                                                                 │
│  Google OAuth:                                                  │
│    ├─ lovable.auth.signInWithOAuth("google")                    │
│    ├─ Redirect → Google → Return                                │
│    ├─ onAuthStateChange → session                               │
│    ├─ Trigger creates profile (role='client')                   │
│    └─ Auth.tsx updates role if new user (< 30s old)             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        LOGIN FLOW                               │
│                                                                 │
│  User → Auth.tsx (signin form)                                  │
│    ├─ Username? → lookup profiles.email                         │
│    ├─ supabase.auth.signInWithPassword()                        │
│    ├─ onAuthStateChange → useAuth (session + profile bg fetch)  │
│    ├─ Check user_roles for admin → /admin                       │
│    ├─ Check user_metadata.role → /jobs or /dashboard            │
│    └─ Navigate immediately (don't wait for profile)             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    ROUTE PROTECTION                             │
│                                                                 │
│  Request → React Router                                         │
│    ├─ Public: /, /auth, /how-it-works, /reset-password, /terms  │
│    │                                                            │
│    ├─ Authenticated:                                            │
│    │   └─ AuthGuard                                             │
│    │       ├─ loading? → spinner                                │
│    │       ├─ !user? → redirect /auth?redirect=...              │
│    │       ├─ admin on non-admin route? → redirect /admin       │
│    │       └─ AuthCodeSetupGuard                                │
│    │           ├─ Check auth-code edge fn (has_code?)            │
│    │           ├─ No code + not dismissed? → setup modal         │
│    │           └─ Render children                               │
│    │                                                            │
│    ├─ Role-gated:                                               │
│    │   └─ AuthGuard → RoleGuard                                 │
│    │       ├─ Wait for profile                                  │
│    │       ├─ Wrong role? → redirect /dashboard                 │
│    │       └─ Render children                                   │
│    │                                                            │
│    └─ Admin:                                                    │
│        └─ AuthGuard → AdminLayout                               │
│            ├─ Check user_roles for admin                        │
│            ├─ Load admin_permissions                             │
│            ├─ Auth code verification (per session)               │
│            ├─ Suspension check                                  │
│            ├─ Permission-based nav filtering                    │
│            └─ Render admin pages                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                 SENSITIVE ACTION GATE                            │
│                                                                 │
│  User action (withdraw, fund milestone, etc.)                   │
│    └─ useRequireAuthCode()                                      │
│        ├─ Check auth-code (has_code?)                           │
│        ├─ No code → AuthCodeSetupModal (forced)                 │
│        │    └─ Set code → AuthCodeVerifyModal                   │
│        └─ Has code → AuthCodeVerifyModal                        │
│             └─ Verify → Execute action                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. FILE LIST SUMMARY

### Database Layer
| Item | Type |
|------|------|
| `handle_new_user()` | PG Trigger Function (SECURITY DEFINER) |
| `has_role()` | PG Function (SECURITY DEFINER) |
| `delete_user_account()` | PG RPC Function (SECURITY DEFINER) |
| `admin_close_user_account()` | PG RPC Function (SECURITY DEFINER) |
| `is_super_admin()` | PG Function (SECURITY DEFINER) |
| `on_auth_user_created` | Trigger on `auth.users` |
| `profiles` | Table |
| `user_roles` | Table |
| `auth_codes` | Table |
| `admin_permissions` | Table |
| `admin_status` | Table |
| `admin_activity_log` | Table |

### Edge Functions
| File | Purpose |
|------|---------|
| `supabase/functions/auth-code/index.ts` | Auth code CRUD + verification |
| `supabase/functions/manage-admin/index.ts` | Admin lifecycle management |
| `supabase/functions/verify-recaptcha/index.ts` | Signup reCAPTCHA verification |
| `supabase/functions/kyc-create-session/index.ts` | KYC session creation |
| `supabase/functions/kyc-check-status/index.ts` | KYC status check |
| `supabase/functions/kyc-webhook/index.ts` | KYC webhook handler |

### Frontend — Auth Core
| File | Purpose |
|------|---------|
| `src/hooks/useAuth.tsx` | Auth context provider (session, profile, sign-in/out) |
| `src/pages/Auth.tsx` | Login/Signup/Forgot Password page |
| `src/pages/ResetPassword.tsx` | Password reset page |
| `src/integrations/lovable/index.ts` | Google OAuth wrapper |

### Frontend — Guards & Modals
| File | Purpose |
|------|---------|
| `src/components/AuthGuard.tsx` | Route protection (auth required) |
| `src/components/RoleGuard.tsx` | Role-based route restriction |
| `src/components/AuthCodeSetupGuard.tsx` | Post-login auth code setup prompt |
| `src/components/AuthCodeSetupModal.tsx` | Forced auth code setup (sensitive actions) |
| `src/components/AuthCodeVerifyModal.tsx` | Auth code verification modal |
| `src/components/AuthCodeInput.tsx` | 6-digit OTP input component |
| `src/hooks/useRequireAuthCode.tsx` | Hook gating sensitive actions behind auth code |
| `src/pages/admin/AdminLayout.tsx` | Admin panel shell with auth code + permission gates |

### Frontend — Supporting
| File | Purpose |
|------|---------|
| `src/lib/admin-permissions.ts` | Permission definitions and presets |
| `src/hooks/usePlatformFreeze.tsx` | Signup pause / platform freeze checks |
| `src/hooks/useTheme.tsx` | Theme provider (reads profile.theme_preference) |
| `src/components/layout/Header.tsx` | Header with role-based nav, auth state display |
| `src/components/KycRequiredModal.tsx` | KYC gate for financial operations |
| `src/hooks/useKycVerification.tsx` | KYC status hook |
| `src/App.tsx` | Route definitions with guard wrappers |

---

*End of audit. No code was modified.*
