# ZentraGig Payment Architecture

## 1. Architecture Overview

ZentraGig does **not** use Paystack as an escrow service. Paystack is a **payment processor and temporary float**. The escrow logic lives entirely inside the Supabase database.

```
Money path:
  Client Bank
      ↓  (card / bank transfer / USSD)
  Paystack Merchant Balance   ← temporary holding
      ↓  (T+1 auto-settlement OR Titan Trust transfer source)
  ZentraGig Bank / PT Account
      ↓  (Paystack Transfer API)
  Expert Bank Account
```

The internal "escrow" is purely accounting:
- `wallets.escrow_balance` — client funds locked for a milestone
- `wallets.pending_clearance` — expert earnings in the 48h fraud hold
- `wallets.balance` — spendable expert balance

No real money moves between these internal states. Real money only moves at two points:
1. **In**: client pays via Paystack → merchant balance
2. **Out**: expert withdraws via Paystack Transfer API → expert's bank

---

## 2. Paystack Components

| Component | Purpose | API |
|---|---|---|
| Charge API | Client card/bank/USSD payments | `POST /charge`, `POST /transaction/initialize` |
| Transfer API | Outgoing expert payouts | `POST /transfer` (source: "balance") |
| Recipient API | Register expert bank accounts | `POST /transferrecipient` |
| Webhook | Async payment/transfer events | `charge.success`, `transfer.success`, `transfer.failed` |

---

## 3. The Settlement Problem

**Default Paystack behaviour (Nigeria):** T+1 daily auto-settlement.

```
Day 1, 2pm: Client pays ₦90,000
Day 1, 11pm: Paystack settles ₦88,650 (after 1.5% fee) to ZentraGig Sterling Bank
Day 2, end of day: Paystack Merchant Balance = ₦0
Day 3, 10am: Expert's 48h hold clears, they click Withdraw
             → Paystack Transfer API called with source: "balance"
             → FAILS: "Insufficient balance in your Paystack wallet"
```

The 48h fraud hold **worsens** this gap — the balance is always drained before the expert can withdraw.

**Current workaround:** ZentraGig manually sends ₦72k from Sterling Bank to expert.

---

## 4. The Paystack-Titan PT Account Solution *(in progress)*

Paystack offers a **Partnership Transfer (PT) Account** — a Titan Trust Bank account created specifically for running Paystack Transfers.

**How it fixes the problem:**
- `source: "balance"` in the Transfer API draws from the **Titan Trust PT Account** (not the Paystack merchant wallet)
- Settlement destination is changed from Sterling Bank → Titan Trust Account
- Client payments → settle to Titan Trust → expert withdrawals draw from Titan Trust → automatic

**Setup steps:**
1. Sign the Standing Debit Order consent (Paystack dashboard → Accounts tab → PT Accounts)
2. Submit KYC (Paystack uses existing KYC to open Titan Trust account)
3. Titan Trust account created (ZentraGig: NEXLAYER ADDITIVE MANUFACTURING)
4. Change settlement destination: Settings → Accounts → Change → select Titan Trust account
5. All future transfers draw from Titan Trust automatically

**Consent signed:** 25 June 2024 (standing debit order with Titan Trust Bank)

**Status:** PT Account setup pending KYC submission completion.

---

## 5. Money Flow Diagrams

### Current State (broken — T+1 drains balance)
```
Client pays ₦90k
    → Paystack Merchant Balance +₦88,650 (after 1.5% fee)
    → T+1 auto-settlement → ZentraGig Sterling Bank +₦88,650
    → Paystack Merchant Balance = ₦0

Expert wants to withdraw ₦72k (after 48h hold)
    → Paystack Transfer API (source: "balance") → FAILS (balance ₦0)
    → Admin manually sends ₦72k from Sterling Bank to expert
```

### Temporary State (manual admin flow — this plan)
```
Client pays ₦90k → same as above (Sterling Bank receives settlement)

Expert clicks Withdraw ₦72k
    → wallet.balance deducted immediately (prevents double-spend)
    → withdrawal_requests created (status: pending)
    → Admin notified by email + dashboard
    → Expert sees: "Processing — 1–2 business days"

Admin sees pending request in dashboard
Admin manually transfers ₦72k via Paystack dashboard or bank transfer
Admin clicks "Mark as Paid" in ZentraGig admin panel
    → withdrawal_requests.status = "completed"
    → wallet_transactions (withdrawal) = "completed"
    → Expert notified: "Your withdrawal has been sent"
```

### Target State (PT Account active — fully automatic)
```
Client pays ₦90k
    → Paystack Merchant Balance +₦88,650
    → T+1 settlement → Titan Trust PT Account +₦88,650

Expert clicks Withdraw ₦72k (after 48h hold clears to balance)
    → withdraw_wallet_atomic RPC: wallet.balance deducted
    → Paystack Transfer API (source: "balance") → draws from Titan Trust
    → Transfer fires immediately
    → transfer.success webhook → withdrawal_requests completed
    → Expert receives ₦72k in their bank account
```

---

## 6. Internal Wallet Architecture

### Tables

**`wallets`** — current balances per user
| Column | Description |
|---|---|
| `balance` | Spendable amount (cleared, post-fraud-hold) |
| `escrow_balance` | Locked while client milestone is active |
| `pending_clearance` | Expert earnings in 48h fraud hold |
| `total_earned` | Lifetime earnings (never decreases) |
| `total_spent` | Lifetime client spending |

**`wallet_transactions`** — complete ledger of all movements
| Column | Description |
|---|---|
| `type` | `escrow_credit`, `escrow_hold`, `escrow_release`, `withdrawal`, `refund`, etc. |
| `clearance_at` | Set on `escrow_release` transactions; null after clearance |
| `status` | null/pending → completed |

**`escrow_ledger`** — per-milestone escrow tracking
| Column | Description |
|---|---|
| `held_amount` | Client's locked amount |
| `released_amount` | Amount released on approval |
| `platform_fee` | ZentraGig's commission (18–20%) |
| `expert_amount` | Expert's net payout |

**`platform_revenue`** — ZentraGig's earnings log
- `commission_amount` = `platform_fee` per milestone
- Admin withdraws revenue via Settings → Accounts in admin panel

**`withdrawal_requests`** — expert withdrawal queue
| Status | Meaning |
|---|---|
| `pending` | Wallet deducted; transfer not yet sent |
| `processing` | Paystack transfer initiated (auto flow only) |
| `completed` | Money sent; confirmed |
| `failed` | Transfer failed; wallet reversed |

**`payout_transfers`** — Paystack transfer attempt log (legacy/admin retry)

---

## 7. The 48-Hour Fraud Hold

**Why it exists:** Protects against fraudulent milestone approvals. Gives clients time to dispute before money leaves the platform.

**How it works:**
1. Client approves milestone → `release_milestone_atomic` RPC runs
2. Expert's `wallets.pending_clearance` increases by their net amount
3. A `wallet_transactions` record is created with `type = 'escrow_release'` and `clearance_at = now() + 48 hours`
4. Every 5 minutes, the scheduler (`releaseClearedFunds`) checks for transactions where `clearance_at <= now()`
5. Cleared transactions: `pending_clearance` → `balance`, `wallet_transactions.status = 'completed'`, milestone → `paid`
6. Expert gets "Funds Ready to Withdraw" notification
7. Expert can now click Withdraw

**Display:** Transactions page shows a live countdown timer per pending_clearance amount. Shows ceiling hours ("48h", "47h"... "1h", "Releasing..."). Balance card updates automatically after the scheduler runs.

---

## 8. Temporary Manual Withdrawal Flow *(current)*

See Section 5 (Temporary State diagram) above.

**Expert experience:**
- Sees balance after 48h clears
- Clicks Withdraw → selects bank account + amount (min ₦5,000)
- Sees: *"Your withdrawal request has been submitted. Funds will arrive within 1–2 business days."*
- Wallet balance reduces immediately
- Gets notified when admin marks as paid

**Admin experience:**
- Gets email: "Expert [Name] has requested a withdrawal of ₦[amount] to [Bank] – [Account]. Process in the admin dashboard."
- Sees pending request in Admin → Payments → Withdrawals tab
- Row shows: expert name, amount, bank name, account number, date
- Manually sends via Paystack dashboard or bank transfer
- Clicks **"Mark as Paid"** → status flips to completed → expert notified

---

## 9. Reverting to Automatic (when PT Account is live)

When the Titan Trust PT Account is active and settlement destination is changed to Titan Trust, re-enable automatic transfers by:

**In `zentra-backend/src/modules/wallet/wallet.service.ts` — `withdraw` action:**

```typescript
// RESTORE: Re-add Paystack Transfer API call after withdraw_wallet_atomic succeeds
const transferRes = await fetch(`${BASE}/transfer`, {
  method: "POST", headers,
  body: JSON.stringify({
    source: "balance",
    amount: amount * 100,
    recipient: result.recipient_code,
    reason: "Withdrawal from platform wallet"
  }),
});
const transferData: any = await transferRes.json();
if (!transferData.status) {
  await this.supabase.rpc("reverse_withdrawal_atomic", {
    _user_id: user.id, _withdrawal_id: result.withdrawal_id,
    _reference: result.reference, _reason: transferData.message || "Transfer failed",
  });
  throw new BadRequestException(transferData.message || "Transfer failed");
}
await this.supabase.from("withdrawal_requests")
  .update({ transfer_code: transferData.data?.transfer_code, status: "processing" })
  .eq("id", result.withdrawal_id);
return { success: true, transfer_code: transferData.data?.transfer_code };

// REMOVE: the admin notification block and manual success return
```

The `transfer.success` and `transfer.failed` webhooks in `supabase/functions/paystack-webhook/index.ts` already handle the completion/reversal — no webhook changes needed.

The "Mark as Paid" button in the admin panel remains as a fallback for edge cases.
