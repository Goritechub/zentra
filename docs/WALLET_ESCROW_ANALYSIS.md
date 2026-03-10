# Wallet & Escrow System Analysis

> Generated: 2026-03-10 | Analysis of existing implementation — no code changes made.

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
- **No row-level locking** — updates use read-then-write via the Supabase JS client.

### 1.2 `wallet_transactions` Table

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | uuid | `gen_random_uuid()` | Primary key |
| `user_id` | uuid | — | Owner of the transaction |
| `amount` | integer | — | Transaction amount in **Naira** |
| `balance_after` | integer | `0` | Snapshot of wallet balance after this transaction |
| `type` | text | — | `credit`, `debit`, `escrow_lock`, `escrow_release`, `withdrawal` |
| `description` | text | nullable | Human-readable description |
| `reference` | text | nullable | Paystack reference or `contest_escrow_*`, `contest_prize_*` |
| `status` | text | `'completed'` | Transaction status |
| `contract_id` | uuid | nullable | FK → `contracts.id` |
| `milestone_id` | uuid | nullable | FK → `milestones.id` |
| `created_at` | timestamptz | `now()` | — |

### 1.3 How Balances Are Stored & Updated

All balance updates use a **read-then-write** pattern:

```
1. SELECT wallet WHERE user_id = X  →  get current balance
2. UPDATE wallet SET balance = currentBalance ± amount WHERE user_id = X
```

**There is no `SELECT ... FOR UPDATE`, no database-level locking, and no `BEGIN/COMMIT` transaction wrapping.** Every operation is an individual Supabase client call.

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

### 2.2 `escrow_transactions` Table

Separate audit trail for escrow deposits/releases:

| Column | Type | Notes |
|--------|------|-------|
| `type` | text | `deposit`, `release` |
| `payer_id` | uuid | Client who funded |
| `payee_id` | uuid | Freelancer who received (nullable for deposits) |
| `amount` | integer | Transaction amount |
| `status` | text | `pending`, `completed` |

### 2.3 How Escrow Is Funded

**Milestone Escrow** (`escrow-release` → `fund_milestone` action):
1. Read milestone + joined contract
2. Verify caller is client, milestone status is `pending`
3. Read client wallet → check `balance >= milestone.amount`
4. UPDATE wallet: `balance -= amount`, `escrow_balance += amount`, `total_spent += amount`
5. INSERT `wallet_transactions` (type: `escrow_lock`)
6. INSERT `escrow_ledger` (status: `held`)
7. INSERT `escrow_transactions` (type: `deposit`)
8. UPDATE milestone status → `funded`
9. Optionally activate contract if `pending_funding`
10. Notify expert + system message

**Contest Escrow** (`launch-contest` edge function):
1. Authenticate user
2. Calculate total prize pool (sum of 5 prize tiers)
3. Read client wallet → check `balance >= totalPrizePool`
4. INSERT contest record (status: `active`)
5. UPDATE wallet: `balance -= totalPrizePool`, `escrow_balance += totalPrizePool`, `total_spent += totalPrizePool`
6. If wallet update fails → DELETE the contest (manual rollback)
7. INSERT `wallet_transactions` (type: `debit`, reference: `contest_escrow_{id}`)

### 2.4 How Escrow Is Released

**Milestone Release** (`escrow-release` → `approve_release` action):
1. Read milestone + contract; verify caller is client, status is `submitted`
2. Find `escrow_ledger` entry with status `held` (creates one if missing)
3. Load commission tiers from `platform_settings` (fallback to hardcoded defaults)
4. Calculate: `platformFee = amount × commissionRate`, `expertAmount = amount - platformFee`
5. UPDATE client wallet: `escrow_balance -= amount`
6. UPDATE/INSERT freelancer wallet: `balance += expertAmount`, `total_earned += expertAmount`
7. UPDATE `escrow_ledger`: status → `released`, record fee split
8. INSERT two `wallet_transactions` (one per party)
9. INSERT `escrow_transactions` (type: `release`)
10. INSERT `platform_revenue` record
11. UPDATE milestone status → `approved`
12. Notify expert
13. Attempt Paystack bank payout (best-effort, no rollback on failure)
14. Check if all milestones approved → complete contract

**Contest Prize Release** (`publish-contest-winners`):
1. Authenticate caller as contest owner
2. Verify contest not already `ended`/`completed`
3. Fetch nominees, verify count matches prize tiers
4. For each nominee (up to 5):
   a. Read winner wallet (create if absent)
   b. UPDATE winner wallet: `balance += prizeAmount`, `total_earned += prizeAmount`
   c. INSERT `wallet_transactions` (type: `credit`, reference: `contest_prize_{id}_{position}`)
   d. Read client wallet → UPDATE: `escrow_balance -= prizeAmount`
   e. Notify winner
5. UPDATE contest status → `completed`
6. Mark entries as winners

---

## 3. FINANCIAL EDGE FUNCTIONS — DETAILED ANALYSIS

### 3.1 `fund_milestone` (in `escrow-release/index.ts`)

| Aspect | Detail |
|--------|--------|
| **Tables Read** | `milestones` (+ joined `contracts`), `wallets` |
| **Tables Written** | `wallets`, `wallet_transactions`, `escrow_ledger`, `escrow_transactions`, `milestones`, `contracts`, `notifications`, `contract_messages` |
| **Order of Operations** | Read milestone → check auth → check status → read wallet → update wallet → insert tx log → insert ledger → insert escrow tx → update milestone → update contract → notify |
| **Database Transactions** | ❌ **None** — all operations are sequential, independent Supabase client calls |
| **Row Locking** | ❌ **None** — read-then-write without `FOR UPDATE` |
| **Idempotency Protection** | ⚠️ **Partial** — checks `milestone.status !== "pending"` to prevent re-funding, but no unique constraint on the operation |

### 3.2 `approve_release` (in `escrow-release/index.ts`)

| Aspect | Detail |
|--------|--------|
| **Tables Read** | `milestones` (+ `contracts`), `escrow_ledger`, `wallets` (client + freelancer), `platform_settings` |
| **Tables Written** | `wallets` (both parties), `escrow_ledger`, `wallet_transactions`, `escrow_transactions`, `platform_revenue`, `milestones`, `contracts`, `payout_transfers`, `notifications`, `contract_messages`, `bank_details` |
| **Order of Operations** | Read milestone → check status → find/create ledger → calc commission → update client wallet → update/create freelancer wallet → update ledger → insert tx logs → insert escrow tx → insert revenue → update milestone → notify → attempt Paystack payout → check contract completion |
| **Database Transactions** | ❌ **None** |
| **Row Locking** | ❌ **None** |
| **Idempotency Protection** | ⚠️ **Partial** — checks `milestone.status !== "submitted"`, but if two requests read `submitted` simultaneously, both proceed |

### 3.3 `publish-contest-winners` (in `publish-contest-winners/index.ts`)

| Aspect | Detail |
|--------|--------|
| **Tables Read** | `contests`, `contest_entries`, `wallets` (per winner + client) |
| **Tables Written** | `contest_entries`, `contests`, `wallets` (per winner + client), `wallet_transactions`, `notifications` |
| **Order of Operations** | Auth → read contest → check status → read nominees → loop: update entry → update winner wallet → insert tx → update client escrow → notify |
| **Database Transactions** | ❌ **None** |
| **Row Locking** | ❌ **None** |
| **Idempotency Protection** | ⚠️ **Partial** — checks `status === "ended" || "completed"`, but two simultaneous calls could both read `selecting_winners` and proceed |

### 3.4 `withdraw` (in `paystack-transfer/index.ts`)

| Aspect | Detail |
|--------|--------|
| **Tables Read** | `wallets`, `bank_details` |
| **Tables Written** | `wallets`, `withdrawal_requests`, `wallet_transactions` |
| **Order of Operations** | Read wallet → check balance → read bank → **debit wallet immediately** → call Paystack API → insert withdrawal request → insert tx log → if Paystack fails: **refund wallet** |
| **Database Transactions** | ❌ **None** |
| **Row Locking** | ❌ **None** |
| **Idempotency Protection** | ❌ **None** — no deduplication mechanism |
| **Rollback** | ⚠️ **Manual** — on Paystack failure, sets wallet balance back to original value. But the `wallet_transactions` debit record is **NOT deleted** on refund, creating an orphaned debit entry. |

### 3.5 `paystack-webhook` (charge.success handler)

| Aspect | Detail |
|--------|--------|
| **Tables Read** | `paystack_references`, `wallet_transactions` (for dedup check), `wallets` |
| **Tables Written** | `paystack_references`, `wallets`, `wallet_transactions`, `notifications` |
| **Order of Operations** | Verify HMAC signature → update reference status → read reference → check for existing wallet_transaction with same reference → if not exists: read wallet → update/insert wallet → insert wallet_transaction → notify |
| **Database Transactions** | ❌ **None** |
| **Row Locking** | ❌ **None** |
| **Idempotency Protection** | ✅ **Yes** — checks `wallet_transactions` for existing record with same `reference` before crediting. However, this is a non-atomic check-then-insert (TOCTOU vulnerability). |

### 3.6 `admin_withdraw_revenue` (in `paystack-transfer/index.ts`)

| Aspect | Detail |
|--------|--------|
| **Tables Read** | `platform_revenue`, `platform_settings`, `bank_details` |
| **Tables Written** | `platform_settings`, `admin_activity_log` |
| **Order of Operations** | Verify super admin → sum all commission_amount → read total_withdrawn → calc available → check amount → read bank → call Paystack → update total_withdrawn → log activity |
| **Database Transactions** | ❌ **None** |
| **Row Locking** | ❌ **None** |
| **Idempotency Protection** | ❌ **None** |

### 3.7 `contest-auto-award` (scheduled function)

| Aspect | Detail |
|--------|--------|
| **Tables Read** | `contests`, `contest_entries` |
| **Tables Written** | `contests`, `contest_entries`, `notifications` |
| **⚠️ CRITICAL BUG** | Auto-award marks nominees as winners but **does NOT pay out prizes**. Winner wallets are never credited. The prize pool remains locked in the client's escrow indefinitely. |
| **Idempotency Protection** | ⚠️ **Partial** — status check prevents re-processing, but no atomic guard |

---

## 4. RACE CONDITION ANALYSIS

### 4.1 Two Withdrawals Simultaneously

**VULNERABLE: YES — Critical**

```
Thread A: read wallet.balance = 10,000
Thread B: read wallet.balance = 10,000
Thread A: UPDATE wallet SET balance = 10,000 - 5,000 = 5,000
Thread B: UPDATE wallet SET balance = 10,000 - 5,000 = 5,000
Result: Both succeed. 10,000 withdrawn but balance shows 5,000 (5,000 lost)
```

The read-then-write pattern with no row locking allows **double-spend**. Two Paystack transfers would be initiated for the same funds.

### 4.2 Two Milestone Fundings Simultaneously

**VULNERABLE: YES — Moderate**

Same pattern: two concurrent `fund_milestone` calls for different milestones on the same client wallet can cause the second to use a stale balance snapshot, resulting in the wallet going below its actual available balance.

For the **same** milestone, the `status !== "pending"` check provides **partial** protection, but two requests reading `pending` simultaneously would both proceed.

### 4.3 Contest Winners Published Twice (Retry)

**VULNERABLE: YES — Critical**

```
Request A: reads contest.status = "selecting_winners"
Request B: reads contest.status = "selecting_winners"  (retry before A completes)
Both proceed: winners credited twice, client escrow double-debited
```

The status check (`status === "ended" || "completed"`) is non-atomic. No unique constraint on winner payouts. No transaction reference deduplication.

### 4.4 Escrow Release Called Twice

**VULNERABLE: YES — Critical**

```
Request A: reads milestone.status = "submitted"
Request B: reads milestone.status = "submitted"
Both proceed: freelancer paid twice, client escrow double-debited (could go negative)
```

The `Math.max(0, escrow_balance - amount)` in some paths prevents negative escrow but doesn't prevent the freelancer from being credited twice.

---

## 5. TRANSACTION SAFETY

### 5.1 BEGIN/COMMIT Transactions

**❌ No edge function uses database transactions.**

All operations are individual Supabase JS client calls (`supabase.from(...).update(...)`, `.insert(...)`). Each is an independent HTTP request to the PostgREST API. There is no transactional grouping.

### 5.2 Rollback Protection

| Function | Rollback Mechanism |
|----------|-------------------|
| `launch-contest` | Manual: deletes contest if wallet update fails |
| `withdraw` | Manual: resets wallet balance if Paystack API fails (but leaves orphaned wallet_transaction) |
| `fund_milestone` | ❌ None — if escrow_ledger insert fails after wallet debit, funds are lost |
| `approve_release` | ❌ None — if freelancer credit fails after client debit, funds disappear |
| `publish-contest-winners` | ❌ None — partial payouts leave inconsistent state |
| `resolve_dispute` | ❌ None |

### 5.3 What Happens If Insert Fails After Wallet Update

**Scenario**: `fund_milestone` debits wallet successfully, then `escrow_ledger` insert fails.

**Result**:
- Wallet balance is reduced ✓
- Escrow balance is increased ✓
- No escrow_ledger record exists ✗
- Milestone remains `pending` ✗
- User sees reduced balance but milestone appears unfunded
- **No automatic recovery** — requires manual database intervention

### 5.4 Paystack Amount Convention

Amounts are stored in **Naira (integers)** in the database. When calling the Paystack API, values are converted to **kobo (× 100)**. The webhook handler converts back: `amountNaira = Math.round(amountKobo / 100)`.

---

## 6. SUMMARY OF RISKS

| Risk | Severity | Affected Functions |
|------|----------|--------------------|
| **No atomic transactions** — all multi-step operations can partially fail | 🔴 Critical | All financial functions |
| **No row locking** — concurrent reads cause stale balance writes | 🔴 Critical | All wallet updates |
| **Double-spend on withdrawals** — no deduplication | 🔴 Critical | `withdraw` |
| **Double-payout on escrow release** — status check is non-atomic | 🔴 Critical | `approve_release` |
| **Double-payout on contest winners** — no idempotency key | 🔴 Critical | `publish-contest-winners` |
| **Contest auto-award doesn't pay winners** — prizes stuck in escrow | 🔴 Critical | `contest-auto-award` |
| **Orphaned transaction records on withdrawal failure** — debit logged but refunded | 🟡 Moderate | `withdraw` |
| **Manual rollback is incomplete** — only `launch-contest` and `withdraw` attempt it | 🟡 Moderate | `fund_milestone`, `approve_release` |
| **Commission tier caching** — edge function caches tiers for entire invocation lifetime | 🟢 Low | `escrow-release` |

---

## 7. RECOMMENDATIONS (Not Yet Implemented)

1. **Use database functions (RPCs) with `BEGIN/COMMIT`** for all financial operations to guarantee atomicity
2. **Use `SELECT ... FOR UPDATE`** row locking on wallet reads before writes
3. **Add idempotency keys** — unique constraints on `(milestone_id, type)` in escrow_ledger, unique references for contest payouts
4. **Fix `contest-auto-award`** — it must call the payout logic when auto-awarding winners
5. **Clean up orphaned transactions** — withdrawal failure should delete the debit wallet_transaction or mark it as `reversed`
6. **Add `balance >= 0` check constraints** on the `wallets` table to prevent negative balances at the database level
