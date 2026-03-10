# Wallet & Escrow System Analysis

> Updated: 2026-03-10 | Post-refactoring — all financial operations are now atomic, concurrency-safe, and idempotent.

---

## 1. WALLET STRUCTURE

### 1.1 `wallets` Table

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid | `gen_random_uuid()` | Primary key |
| `user_id` | uuid | — | FK → `profiles.id`, **one-to-one** |
| `balance` | integer | `0` | Available balance in **Naira** |
| `escrow_balance` | integer | `0` | Funds locked in escrow in **Naira** |
| `total_earned` | integer | `0` | Lifetime earnings |
| `total_spent` | integer | `0` | Lifetime spending |
| `updated_at` | timestamptz | `now()` | Last modification |

- RLS: Users can view/update own wallet; admins can view all.
- No DELETE policy — wallets are never deleted except via the `delete_user_account` RPC.
- **CHECK constraint**: `balance >= 0` — prevents negative available balances at the database level.

### 1.2 `wallet_transactions` Table

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid | `gen_random_uuid()` | Primary key |
| `user_id` | uuid | — | Owner of the transaction |
| `amount` | integer | — | Transaction amount in **Naira** |
| `balance_after` | integer | `0` | Snapshot of wallet balance after this transaction |
| `type` | text | — | `credit`, `debit`, `escrow_lock`, `escrow_release`, `withdrawal`, `reversal` |
| `description` | text | nullable | Human-readable description |
| `reference` | text | nullable | Unique operation key (e.g. `fund_ms_{id}`, `contest_prize_{id}_{pos}`, `withdraw_{uuid}`) |
| `status` | text | `'completed'` | `completed`, `pending`, `reversed` |
| `contract_id` | uuid | nullable | FK → `contracts.id` |
| `milestone_id` | uuid | nullable | FK → `milestones.id` |
| `created_at` | timestamptz | `now()` | — |

**Unique index**: `idx_wallet_tx_reference_unique` — partial unique index on `reference` where `reference IS NOT NULL`, preventing duplicate financial operations.

### 1.3 How Balances Are Stored & Updated

All balance updates now happen inside **PostgreSQL `SECURITY DEFINER` functions** that run as single atomic transactions:

```
1. SELECT * FROM wallets WHERE user_id = X FOR UPDATE   →  row-level lock
2. Validate balance >= required amount
3. UPDATE wallets SET balance = balance - amount ...     →  atomic within same transaction
4. INSERT INTO wallet_transactions ...                   →  same transaction
5. RETURN result                                         →  COMMIT or ROLLBACK
```

If any step fails, the entire function rolls back automatically via PostgreSQL's implicit transaction.

---

## 2. ESCROW STRUCTURE

### 2.1 `escrow_ledger` Table

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid | `gen_random_uuid()` | Primary key |
| `contract_id` | uuid | — | FK → `contracts.id` |
| `milestone_id` | uuid | nullable | FK → `milestones.id` |
| `held_amount` | integer | `0` | Amount locked |
| `released_amount` | integer | `0` | Amount released |
| `platform_fee` | integer | `0` | Commission deducted |
| `expert_amount` | integer | `0` | Net paid to expert |
| `status` | text | `'held'` | `held`, `released`, `refunded` |
| `created_at` | timestamptz | `now()` | — |
| `updated_at` | timestamptz | `now()` | — |

**Unique index**: `idx_escrow_ledger_milestone_held` — partial unique index on `milestone_id` where `status = 'held'`, preventing duplicate escrow locks for the same milestone.

### 2.2 `escrow_transactions` Table

| Column | Type | Notes |
|--------|------|-------|
| `type` | text | `deposit`, `release` |
| `payer_id` | uuid | Client who funded |
| `payee_id` | uuid | Freelancer who received (nullable for deposits) |
| `amount` | integer | Transaction amount |
| `status` | text | `pending`, `completed` |

### 2.3 How Escrow Is Funded

**Milestone Escrow** — via `fund_milestone_atomic` RPC:

All steps execute atomically within one database transaction:

1. Read milestone + joined contract
2. Verify caller is client, milestone status is `pending`
3. `SELECT ... FOR UPDATE` on client wallet — acquires row lock
4. Check `balance >= milestone.amount`
5. UPDATE wallet: `balance -= amount`, `escrow_balance += amount`, `total_spent += amount`
6. INSERT `wallet_transactions` (type: `escrow_lock`, reference: `fund_ms_{milestone_id}`)
7. INSERT `escrow_ledger` (status: `held`)
8. INSERT `escrow_transactions` (type: `deposit`)
9. UPDATE milestone status → `funded`
10. Optionally activate contract if `pending_funding`

If any step fails → automatic rollback. The unique reference `fund_ms_{id}` prevents duplicate funding.

**Contest Escrow** — via `launch_contest_atomic` RPC:

1. Calculate total prize pool
2. `SELECT ... FOR UPDATE` on client wallet
3. Check `balance >= total_pool`
4. INSERT contest record (status: `active`)
5. UPDATE wallet: `balance -= total_pool`, `escrow_balance += total_pool`
6. INSERT `wallet_transactions` (reference: `contest_escrow_{contest_id}`)

Atomic — no manual rollback needed.

### 2.4 How Escrow Is Released

**Milestone Release** — via `release_milestone_atomic` RPC:

1. Read milestone + contract; verify caller is client, status is `submitted`
2. `SELECT ... FOR UPDATE` on `escrow_ledger` entry with status `held`
3. Idempotency: if ledger already `released`, return error immediately
4. Load commission tiers from `platform_settings`
5. Calculate: `platformFee = amount × commissionRate`, `expertAmount = amount - platformFee`
6. UPDATE client wallet: `escrow_balance -= amount`
7. `SELECT ... FOR UPDATE` on freelancer wallet → credit: `balance += expertAmount`
8. UPDATE `escrow_ledger`: status → `released`, record fee split
9. INSERT two `wallet_transactions` (one per party, with unique references `release_client_{id}` / `release_expert_{id}`)
10. INSERT `escrow_transactions` (type: `release`)
11. INSERT `platform_revenue` record
12. UPDATE milestone status → `approved`
13. Check if all milestones approved → complete contract

All atomic. Edge function then handles post-commit notifications and optional Paystack payout (best-effort).

**Contest Prize Release** — via `publish_contest_winners_atomic` RPC:

1. `SELECT ... FOR UPDATE` on contest row — prevents concurrent calls
2. Verify status is not `completed` or `ended`
3. Fetch nominees, verify count matches prize tiers
4. `SELECT ... FOR UPDATE` on client wallet
5. For each winner (up to 5):
   a. `SELECT ... FOR UPDATE` on winner wallet (create if absent)
   b. Credit winner: `balance += prize`, `total_earned += prize`
   c. INSERT `wallet_transactions` (reference: `contest_prize_{contest_id}_{position}`)
   d. Debit client escrow: `escrow_balance -= prize`
   e. INSERT notification
6. UPDATE contest status → `completed`

Atomic — if any winner payout fails, all rollback (no partial payouts).

---

## 3. SQL / RPC FUNCTIONS

### 3.1 `fund_milestone_atomic(_user_id, _milestone_id)`

**Purpose**: Lock milestone funds from client wallet into escrow.

**Row locks**: `wallets` (client) via `FOR UPDATE`

**Idempotency**: Checks `milestone.status != 'pending'`; unique reference `fund_ms_{id}` on `wallet_transactions`; unique partial index on `escrow_ledger(milestone_id)` where `status = 'held'`.

**Atomicity**: Full — single PL/pgSQL function = single transaction.

### 3.2 `release_milestone_atomic(_user_id, _milestone_id)`

**Purpose**: Release escrow funds to freelancer, deduct platform commission, record revenue.

**Row locks**: `escrow_ledger` row via `FOR UPDATE`; freelancer `wallets` row via `FOR UPDATE`.

**Idempotency**: Checks for existing `released` ledger entry; unique references `release_client_{id}` / `release_expert_{id}`.

**Atomicity**: Full.

### 3.3 `publish_contest_winners_atomic(_user_id, _contest_id, _is_auto_award)`

**Purpose**: Pay all contest winners atomically.

**Row locks**: `contests` row via `FOR UPDATE`; client `wallets` via `FOR UPDATE`; each winner `wallets` via `FOR UPDATE`.

**Idempotency**: Checks `contest.status IN ('completed', 'ended')` under lock; unique references `contest_prize_{contest_id}_{position}`.

**Atomicity**: Full — all winners paid or none. No partial payout state possible.

### 3.4 `launch_contest_atomic(_user_id, ...params)`

**Purpose**: Create contest and lock prize pool in escrow atomically.

**Row locks**: Client `wallets` via `FOR UPDATE`.

**Idempotency**: Unique reference `contest_escrow_{contest_id}`.

**Atomicity**: Full.

### 3.5 `withdraw_wallet_atomic(_user_id, _amount, _bank_detail_id)`

**Purpose**: Atomically debit wallet and create pending withdrawal request (before Paystack API call).

**Row locks**: `wallets` via `FOR UPDATE`.

**Idempotency**: Generates unique reference `withdraw_{uuid}`. Balance check under lock prevents double-spend.

**Atomicity**: Full — balance debit, transaction log, and withdrawal request all in one transaction.

### 3.6 `reverse_withdrawal_atomic(_user_id, _withdrawal_id, _reference, _reason)`

**Purpose**: Reverse a failed withdrawal — refund balance, mark original transaction as reversed, log reversal.

**Row locks**: `withdrawal_requests` via `FOR UPDATE`; `wallets` via `FOR UPDATE`.

**Idempotency**: Checks `withdrawal.status NOT IN ('pending', 'processing')` — already-finalized withdrawals cannot be reversed again.

**Atomicity**: Full — refund + status update + reversal log all in one transaction.

### 3.7 `credit_wallet_atomic(_user_id, _amount, _description, _reference)`

**Purpose**: Credit a wallet (e.g. from Paystack webhook on successful charge).

**Row locks**: `wallets` via `FOR UPDATE`.

**Idempotency**: Checks `wallet_transactions` for existing record with same `reference` before crediting. Returns `{duplicate: true}` if already processed.

**Atomicity**: Full.

### 3.8 `resolve_dispute_atomic(_admin_id, _dispute_id, _contract_id, _resolution_type, ...)`

**Purpose**: Resolve a dispute — release to freelancer, refund client, or partial split.

**Row locks**: Both client and freelancer wallets via `FOR UPDATE` (locked in consistent UUID order to prevent deadlocks).

**Idempotency**: Status checks under lock.

**Atomicity**: Full.

---

## 4. UPDATED EDGE FUNCTION FLOWS

### 4.1 `escrow-release/index.ts`

**Fund Milestone action**:
```
1. Authenticate user (JWT)
2. Call supabase.rpc('fund_milestone_atomic', { _user_id, _milestone_id })
3. If success → send notifications + system message (post-commit, non-critical)
4. Return result
```

**Approve Release action**:
```
1. Authenticate user (JWT)
2. Call supabase.rpc('release_milestone_atomic', { _user_id, _milestone_id })
3. If success → send notifications, attempt Paystack payout (best-effort)
4. Return result
```

All financial state changes happen inside the RPC. The edge function only handles auth, notifications, and external API calls.

### 4.2 `publish-contest-winners/index.ts`

```
1. Authenticate user (JWT)
2. Call supabase.rpc('publish_contest_winners_atomic', { _user_id, _contest_id })
3. Return result (notifications are sent inside the RPC)
```

### 4.3 `contest-auto-award/index.ts`

```
1. Query overdue contests (status = 'active', deadline < now)
2. For each contest:
   a. Select top entries as nominees
   b. Mark entries as nominees
   c. Call supabase.rpc('publish_contest_winners_atomic', { _user_id: client_id, _contest_id, _is_auto_award: true })
   d. This atomically pays winners — fixing the previous bug where auto-award did NOT pay out prizes
```

### 4.4 `paystack-transfer/index.ts`

**User Withdrawal**:
```
1. Authenticate user
2. Call supabase.rpc('withdraw_wallet_atomic', { _user_id, _amount, _bank_detail_id })
   → Returns { success, withdrawal_id, recipient_code, reference }
3. Call Paystack Transfer API
4. If Paystack fails → Call supabase.rpc('reverse_withdrawal_atomic', { ... })
   → Atomically refunds balance, marks original tx as reversed, logs reversal
5. If Paystack succeeds → Update withdrawal_requests with transfer_code
```

**Admin Revenue Withdrawal**: Unchanged flow (reads `platform_revenue`, calls Paystack, updates `platform_settings`).

### 4.5 `paystack-webhook/index.ts` (charge.success)

```
1. Verify HMAC signature
2. Update paystack_references status
3. Call supabase.rpc('credit_wallet_atomic', { _user_id, _amount, _description, _reference })
   → Returns { success, duplicate } — if reference already processed, skips silently
4. If success and not duplicate → send notification
```

---

## 5. DATABASE CONSTRAINTS & INDEXES

### 5.1 CHECK Constraints

| Table | Constraint | Rule |
|-------|-----------|------|
| `wallets` | `chk_wallet_balance_non_negative` | `balance >= 0` |

Prevents any operation from driving the available balance below zero, even if application logic has a bug.

### 5.2 Unique Indexes (Idempotency)

| Index | Table | Columns | Condition |
|-------|-------|---------|-----------|
| `idx_wallet_tx_reference_unique` | `wallet_transactions` | `reference` | `WHERE reference IS NOT NULL` |
| `idx_escrow_ledger_milestone_held` | `escrow_ledger` | `milestone_id` | `WHERE status = 'held'` |

These prevent:
- Duplicate milestone funding (same `fund_ms_{id}` reference)
- Duplicate escrow releases (same `release_client_{id}` / `release_expert_{id}` reference)
- Duplicate contest payouts (same `contest_prize_{id}_{pos}` reference)
- Duplicate wallet credits (same Paystack reference)
- Duplicate escrow ledger entries for a milestone in `held` status

---

## 6. RACE CONDITION ANALYSIS (POST-FIX)

### 6.1 Two Withdrawals Simultaneously

**PROTECTED ✅**

Both requests call `withdraw_wallet_atomic`. The first to acquire `FOR UPDATE` lock proceeds; the second blocks until the first commits. The second then reads the updated (lower) balance and either succeeds or returns "Insufficient balance".

### 6.2 Two Milestone Fundings Simultaneously

**PROTECTED ✅**

- **Same milestone**: First call sets status to `funded`; second call sees `status != 'pending'` and returns error. Unique reference `fund_ms_{id}` also prevents duplicate `wallet_transactions`.
- **Different milestones, same client**: `FOR UPDATE` on the client wallet serializes the operations. No stale balance reads.

### 6.3 Contest Winners Published Twice (Retry)

**PROTECTED ✅**

`FOR UPDATE` on the `contests` row serializes calls. First call sets status to `completed`; second call sees `status IN ('completed', 'ended')` and returns error. Unique references `contest_prize_{id}_{pos}` also prevent duplicate credits.

### 6.4 Escrow Release Called Twice

**PROTECTED ✅**

`FOR UPDATE` on `escrow_ledger` row serializes calls. First call sets status to `released`; second call finds no `held` entry and checks for existing `released` entry, returning "already released" error. Unique references prevent duplicate `wallet_transactions`.

### 6.5 Webhook Delivered Twice

**PROTECTED ✅**

`credit_wallet_atomic` checks for existing `wallet_transactions` with same reference before crediting. Returns `{duplicate: true}` on second call. The unique index on `reference` provides database-level enforcement.

---

## 7. TRANSACTION SAFETY

### 7.1 Atomicity

All financial RPCs are PL/pgSQL functions. PostgreSQL wraps each function call in an implicit transaction. If any statement fails (constraint violation, runtime error, etc.), the entire function rolls back automatically.

### 7.2 Rollback Protection

| Scenario | Protection |
|----------|-----------|
| Client debited but freelancer not credited | Impossible — both happen in same `release_milestone_atomic` transaction |
| First contest winner paid but third fails | Impossible — all winners paid in same `publish_contest_winners_atomic` transaction; any failure rolls back all |
| Escrow ledger updated but wallet not | Impossible — same transaction |
| Contest marked completed but prizes not paid | Impossible — status update and prize credits are in same transaction |
| Withdrawal debit logged but Paystack fails | Clean reversal via `reverse_withdrawal_atomic`: marks original tx as `reversed`, creates `reversal` tx, refunds balance |

### 7.3 Paystack Amount Convention

Amounts are stored in **Naira (integers)** in the database. When calling the Paystack API, values are converted to **kobo (× 100)**. The webhook handler converts back: `amountNaira = Math.round(amountKobo / 100)`.

---

## 8. ARCHITECTURE SUMMARY

```
┌─────────────────┐
│  Edge Function   │  ← Auth, external APIs (Paystack), notifications
│  (Deno/TS)       │
└────────┬────────┘
         │  supabase.rpc('..._atomic', { params })
         ▼
┌─────────────────┐
│  PostgreSQL RPC  │  ← All financial state changes
│  (PL/pgSQL)      │  ← SELECT ... FOR UPDATE (row locks)
│                  │  ← Implicit BEGIN/COMMIT transaction
│                  │  ← Unique references (idempotency)
│                  │  ← CHECK constraints (balance >= 0)
└─────────────────┘
```

**Principle**: Edge functions handle authentication, external API calls, and notifications. All money movement is centralized in database-side transactional functions that guarantee atomicity, prevent races, and enforce idempotency.
