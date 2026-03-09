# ZentraGig — Backend Architecture Documentation

> Last updated: March 2026  
> This document provides a comprehensive overview of the entire backend architecture for the ZentraGig freelance marketplace platform.

---

## Table of Contents

1. [Database Structure](#database-structure)
2. [Edge Functions](#edge-functions)
3. [Storage Structure](#storage-structure)
4. [Authentication Flow](#authentication-flow)
5. [Data Flows](#data-flows)

---

## Database Structure

The platform uses Supabase (PostgreSQL) with Row-Level Security (RLS) policies on all tables. Below is a complete reference for every table.

---

### Table: `profiles`

**Purpose:** Stores core user account information for every registered user (client, freelancer, or admin).

**Used by pages:** Dashboard, Profile, Messaging, Jobs, Contests, Contracts, Admin Users, Header (avatar/name)

**Important columns:**
| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Matches `auth.users.id` |
| `email` | text | User's email address |
| `full_name` | text | Full name (enforced 2+ words at signup) |
| `username` | text | Unique username (immutable after signup) |
| `role` | enum (`client`, `freelancer`) | Primary user role |
| `avatar_url` | text | Profile picture URL |
| `state`, `city` | text | Location information |
| `phone`, `whatsapp` | text | Contact numbers |
| `is_verified` | boolean | KYC verification status |
| `auth_code_hash` | text | SHA-256 hash of 6-digit transaction auth code |
| `theme_preference` | text | Selected color theme |
| `full_name_edited` | boolean | Whether full name was changed after signup |
| `username_edited` | boolean | Whether username was changed after signup |

**Relationships:**
- Referenced by: `freelancer_profiles`, `wallets`, `reviews`, `proposals`, `contracts`, `messages`, `bank_details`, `kyc_verifications`, `certifications`, `work_experience`, `complaints`, `offers`, `contest_entries`, `service_offers`, `platform_reviews`

**RLS:** Users can read/update own profile. Everyone can read profiles (for expert browsing).

**Created by:** `handle_new_user()` trigger on `auth.users` insert.

---

### Table: `freelancer_profiles`

**Purpose:** Stores extended professional information for users with the "freelancer" role.

**Used by pages:** Expert Profile, Dashboard, Freelancers browse, Job matching

**Important columns:**
| Column | Type | Description |
|---|---|---|
| `user_id` | uuid (FK → profiles) | One-to-one with profiles |
| `title` | text | Professional title (e.g., "Senior CAD Engineer") |
| `bio` | text | Professional biography |
| `skills` | text[] | Array of skill tags |
| `skill_levels` | jsonb | Skill proficiency mapping |
| `hourly_rate` | integer | Hourly rate in Naira |
| `min_project_rate` | integer | Minimum project rate |
| `availability` | enum | `full_time`, `part_time`, `flexible` |
| `years_experience` | integer | Years of professional experience |
| `rating` | numeric | Average rating from reviews |
| `total_jobs_completed` | integer | Completed contract count |

**Relationships:**
- FK: `user_id` → `profiles.id` (one-to-one)
- Referenced by: `portfolio_items`

**RLS:** Everyone can read. Freelancers can insert/update own profile.

---

### Table: `portfolio_items`

**Purpose:** Stores portfolio work samples for freelancers.

**Used by pages:** Manage Portfolio, Expert Profile

**Important columns:**
| Column | Type | Description |
|---|---|---|
| `freelancer_profile_id` | uuid (FK) | Links to freelancer_profiles |
| `title` | text | Project title |
| `description` | text | Project description |
| `images` | text[] | Array of image URLs |
| `software_used` | text[] | Software tools used |
| `project_type` | text | Type of project |

**RLS:** Everyone can read. Freelancers can manage own items.

---

### Table: `jobs`

**Purpose:** Stores job postings created by clients.

**Used by pages:** Jobs browse, Post Job, Client Jobs, Job Details, Admin Jobs

**Important columns:**
| Column | Type | Description |
|---|---|---|
| `client_id` | uuid (FK → profiles) | Job poster |
| `title` | text | Job title |
| `description` | text | Full job description |
| `budget_min`, `budget_max` | integer | Budget range in Naira |
| `required_skills` | text[] | Required skill tags |
| `required_software` | text[] | Required software |
| `required_skill_levels` | jsonb | Skill level requirements |
| `status` | enum | `open`, `in_progress`, `completed`, `cancelled`, `pending_delete` |
| `visibility` | text | `public` or `invite_only` |
| `is_remote` | boolean | Remote work flag |
| `delivery_days` | integer | Expected delivery timeline |
| `invited_expert_ids` | text[] | For invite-only jobs |
| `attachments` | text[] | Job attachment URLs |

**Relationships:**
- FK: `client_id` → `profiles.id`
- Referenced by: `proposals`, `contracts`, `offers`, `job_views`

**RLS:** Everyone can read open jobs. Clients can CRUD own jobs. Admins have full access.

---

### Table: `job_views`

**Purpose:** Tracks which freelancers have viewed which jobs (for analytics).

**Used by pages:** Job Details (view counter), Admin analytics

**Columns:** `job_id` (FK → jobs), `viewer_id` (FK → profiles), `created_at`

---

### Table: `proposals`

**Purpose:** Stores freelancer applications/bids for jobs.

**Used by pages:** Apply Job, Proposals Received, Expert Proposals, Admin

**Important columns:**
| Column | Type | Description |
|---|---|---|
| `job_id` | uuid (FK → jobs) | Target job |
| `freelancer_id` | uuid (FK → profiles) | Applicant |
| `bid_amount` | integer | Proposed price in Naira |
| `cover_letter` | text | Application letter (moderated) |
| `delivery_days` | integer | Proposed delivery time |
| `payment_type` | text | `project` or `milestone` |
| `milestones` | jsonb | Proposed milestone breakdown |
| `status` | enum | `pending`, `accepted`, `rejected`, `withdrawn` |
| `attachments` | text[] | Proposal attachments |
| `edit_count` | integer | Number of times edited |

**RLS:** Freelancers can create/update own. Job owners can view/update. Admins can view/delete.

---

### Table: `offers`

**Purpose:** Stores direct offers/invitations from clients to freelancers.

**Used by pages:** Sent Offers (client), Received Offers (freelancer)

**Important columns:** `client_id`, `freelancer_id`, `job_id` (optional), `title`, `description`, `budget`, `status`

**RLS:** Clients can create. Both parties can view their own.

---

### Table: `contracts`

**Purpose:** Central entity representing an active working relationship between client and freelancer. All post-proposal activity is tied to a contract.

**Used by pages:** Contracts, Contract Detail, Messages, Disputes, Admin Contracts

**Important columns:**
| Column | Type | Description |
|---|---|---|
| `client_id` | uuid (FK → profiles) | Client |
| `freelancer_id` | uuid (FK → profiles) | Expert |
| `job_id` | uuid (FK → jobs, nullable) | Original job |
| `proposal_id` | uuid (FK → proposals, nullable) | Accepted proposal |
| `amount` | integer | Total contract value in Naira |
| `status` | enum | `draft`, `interviewing`, `pending_funding`, `active`, `in_review`, `completed`, `cancelled`, `disputed` |
| `job_title`, `job_description` | text | Immutable snapshot of original job |
| `accepted_bid_amount`, `accepted_cover_letter`, `accepted_payment_type` | various | Immutable snapshot of accepted proposal |
| `started_at`, `completed_at` | timestamptz | Lifecycle timestamps |

**Relationships:**
- FK: `client_id`, `freelancer_id` → `profiles`
- FK: `job_id` → `jobs`
- FK: `proposal_id` → `proposals`
- Referenced by: `milestones`, `contract_messages`, `contract_attachments`, `disputes`, `escrow_ledger`, `escrow_transactions`, `reviews`, `payout_transfers`, `hidden_conversations`, `notifications`

**RLS:** Contract participants can view/update. Admins have full access.

---

### Table: `milestones`

**Purpose:** Defines deliverable phases within a contract, each with its own funding and approval cycle.

**Used by pages:** Contract Detail

**Important columns:**
| Column | Type | Description |
|---|---|---|
| `contract_id` | uuid (FK → contracts) | Parent contract |
| `title` | text | Milestone name |
| `amount` | integer | Milestone value in Naira |
| `status` | text | `pending`, `funded`, `in_progress`, `submitted`, `approved`, `disputed`, `paid` |
| `funded_at`, `submitted_at`, `approved_at` | timestamptz | Lifecycle timestamps |
| `submission_notes` | text | Expert's delivery notes |
| `submission_attachments` | text[] | Delivery files |
| `due_date` | timestamptz | Optional deadline |

**RLS:** Contract participants can manage. Admins have access.

---

### Table: `milestone_submissions`

**Purpose:** Tracks individual submission attempts per milestone (supports resubmission after rejection).

**Columns:** `milestone_id`, `contract_id`, `submitted_by`, `notes`, `attachments`, `status`, `review_notes`, `reviewed_by`, `reviewed_at`

---

### Table: `contract_messages`

**Purpose:** Chat messages within a contract context. All project communication happens here.

**Used by pages:** Contract Detail (chat), Messages

**Important columns:** `contract_id`, `sender_id`, `content`, `is_system_message`, `is_read`, `edited_at`

**RLS:** Only contract participants can send/view messages. Admins can view all.

---

### Table: `contract_attachments`

**Purpose:** Files shared within contract context (chat, milestones, deliverables).

**Columns:** `contract_id`, `message_id`, `milestone_id`, `file_url`, `file_name`, `file_type`, `file_size`, `context` (`chat`, `milestone`, `deliverable`), `uploaded_by`

---

### Table: `messages`

**Purpose:** Direct messages between users (outside contract context). Used for pre-contract communication.

**Used by pages:** Messages

**Columns:** `sender_id`, `receiver_id`, `content`, `attachments`, `is_read`

**Note:** All messages go through the `moderate-message` edge function for content policy enforcement.

---

### Table: `hidden_conversations`

**Purpose:** Allows users to hide contract conversations from their messaging view.

**Columns:** `user_id`, `contract_id`

---

### Table: `wallets`

**Purpose:** Stores user wallet balances (available and escrow).

**Used by pages:** Dashboard, Transactions, Wallet modals, Admin Payments

**Important columns:**
| Column | Type | Description |
|---|---|---|
| `user_id` | uuid (FK → profiles) | Wallet owner |
| `balance` | integer | Available balance in Naira |
| `escrow_balance` | integer | Funds locked in escrow |
| `total_earned` | integer | Lifetime earnings |
| `total_spent` | integer | Lifetime spending |

**RLS:** Users can view/update own wallet. Admins can view all.

---

### Table: `wallet_transactions`

**Purpose:** Unified ledger of all wallet credits and debits.

**Used by pages:** Transactions, Admin Payments

**Important columns:** `user_id`, `type` (`credit`, `debit`, `escrow_lock`, `escrow_release`, `withdrawal`), `amount`, `balance_after`, `description`, `reference`, `contract_id`, `milestone_id`, `status`

---

### Table: `escrow_ledger`

**Purpose:** Tracks escrow holds and releases per milestone.

**Columns:** `contract_id`, `milestone_id`, `held_amount`, `released_amount`, `platform_fee`, `expert_amount`, `status` (`held`, `released`, `refunded`)

---

### Table: `escrow_transactions`

**Purpose:** Records individual escrow events (deposits, releases).

**Columns:** `contract_id`, `milestone_id`, `payer_id`, `payee_id`, `amount`, `type` (`deposit`, `release`), `status`, `reference`

---

### Table: `platform_revenue`

**Purpose:** Records platform commission earned from each released milestone.

**Used by pages:** Admin Payments (revenue tab)

**Columns:** `contract_id`, `milestone_id`, `gross_amount`, `commission_rate`, `commission_amount`, `net_to_freelancer`

**RLS:** Admins only (insert + select).

---

### Table: `bank_details`

**Purpose:** Stores verified bank account information for withdrawals.

**Used by pages:** Wallet Withdraw modal, Admin revenue withdrawal

**Columns:** `user_id`, `bank_code`, `bank_name`, `account_number`, `account_name`, `recipient_code` (Paystack), `is_default`

---

### Table: `withdrawal_requests`

**Purpose:** Tracks withdrawal attempts and their status.

**Used by pages:** Admin Payments (withdrawals tab)

**Columns:** `user_id`, `amount`, `bank_detail_id`, `transfer_code`, `status`, `reason`

---

### Table: `payout_transfers`

**Purpose:** Records automatic Paystack transfer attempts after milestone approval.

**Columns:** `contract_id`, `milestone_id`, `expert_id`, `amount`, `platform_fee`, `transfer_code`, `status`, `paystack_response`

---

### Table: `paystack_references`

**Purpose:** Tracks all Paystack payment initialization references for wallet funding.

**Columns:** `user_id`, `reference`, `amount`, `channel` (`card`, `bank`, `ussd`), `status`, `paystack_response`, `purpose`, `contract_id`, `milestone_id`

---

### Table: `disputes`

**Purpose:** Tracks disputes raised on contracts, including evidence and resolution.

**Used by pages:** Dispute Detail, Admin Disputes

**Important columns:** `contract_id`, `milestone_id`, `raised_by`, `respondent_id`, `reason`, `evidence_urls`, `status`, `dispute_status` (`awaiting_response`, `under_review`, `resolved`), `adjudicator_id`, `resolution_type` (`release_to_freelancer`, `refund_client`, `partial_split`, `no_funds`), `resolution_explanation`, `resolution_split_client`, `resolution_split_freelancer`, `response_deadline`

---

### Table: `reviews`

**Purpose:** Post-contract reviews between clients and freelancers.

**Used by pages:** Expert Profile, Contract Detail, Admin Reviews

**Columns:** `contract_id`, `reviewer_id`, `reviewee_id`, `rating`, `comment`, plus granular ratings: `rating_skills`, `rating_quality`, `rating_availability`, `rating_deadlines`, `rating_communication`, `rating_cooperation`

---

### Table: `contests`

**Purpose:** Design/CAD contests where multiple freelancers submit entries and compete for prizes.

**Used by pages:** Browse Contests, Contest Detail, Launch Contest, My Contests, Admin Contests

**Important columns:** `client_id`, `title`, `description`, `category`, `prize_first` through `prize_fifth`, `deadline`, `required_skills`, `required_software`, `status` (`active`, `selecting_winners`, `ended`, `completed`), `visibility` (`open`, `invite_only`), `banner_image`, `rules`, `winner_selection_method`, `winner_justifications`, `deadline_extended_once`

---

### Table: `contest_entries`

**Purpose:** Freelancer submissions to contests.

**Columns:** `contest_id`, `freelancer_id`, `description`, `attachments`, `is_nominee`, `is_winner`, `prize_position`, `edit_count`, `last_edited_at`

---

### Table: `contest_comments`

**Purpose:** Discussion threads on contest pages.

**Columns:** `contest_id`, `user_id`, `parent_id` (threading), `content`

---

### Table: `contest_comment_likes`

**Purpose:** Like counts on contest comments.

---

### Table: `comment_mentions`

**Purpose:** @mentions in contest comments.

---

### Table: `contest_follows`

**Purpose:** Users following contests for updates.

---

### Table: `service_offers`

**Purpose:** Fixed-price service listings created by freelancers.

**Used by pages:** My Services, Browse Services

**Columns:** `freelancer_id`, `title`, `description`, `category`, `skills`, `price`, `pricing_type`, `delivery_days`, `delivery_unit`, `revisions_allowed`, `banner_image`, `images`, `is_active`

---

### Table: `notifications`

**Purpose:** In-app notifications for all user events.

**Used by pages:** Notification Bell (Header), Notifications page

**Columns:** `user_id`, `type`, `title`, `message`, `is_read`, `link_url`, `contract_id`

---

### Table: `categories`

**Purpose:** Platform-wide job/service categories.

**Used by pages:** Post Job, Browse, Admin Settings

**Columns:** `name`, `slug`, `description`, `icon`

---

### Table: `kyc_verifications`

**Purpose:** Identity verification records (Didit integration).

**Used by pages:** KYC Verification Card, Admin Verification

**Important columns:** `user_id`, `didit_session_id`, `verification_url`, `kyc_status` (`not_started`, `pending`, `verified`, `failed`, `manual_review`), `kyc_provider_status`, `kyc_provider_result` (jsonb), `full_name_on_id`, `date_of_birth`, `country`, `document_type`, `verification_level`, `admin_notes`, `zentra_verified`, `zentra_verified_by`

---

### Table: `platform_reviews`

**Purpose:** Platform experience reviews (prompted after contract completion).

**Used by pages:** Homepage testimonials, Admin Platform Reviews

**Columns:** `user_id`, `rating`, `comment`, `contracts_at_review`, `is_approved`, `is_featured`

---

### Table: `platform_settings`

**Purpose:** Key-value store for platform configuration.

**Used by pages:** Admin Settings, Support, Commission calculation

**Known keys:** `commission_tiers`, `support_email`, `support_phone`, `support_whatsapp`, `total_revenue_withdrawn`

**RLS:** Anyone can read. Admins can insert/update.

---

### Table: `legal_documents`

**Purpose:** Platform legal pages (Terms, Privacy Policy, etc.)

**Used by pages:** Terms page, Admin Legal Documents

**Columns:** `title`, `slug`, `content`, `is_published`, `sort_order`

---

### Table: `complaints`

**Purpose:** User-submitted support tickets/complaints.

**Used by pages:** Contact, Admin Support

**Columns:** `user_id`, `subject`, `category`, `message`, `attachments`, `status` (`new`, `in_progress`, `resolved`), `admin_notes`

---

### Table: `support_chat_messages`

**Purpose:** Live chat messages between users and admin support.

**Columns:** `chat_id`, `sender_id`, `sender_type` (`user`, `admin`), `message`, `attachments`, `is_read`

---

### Table: `user_roles`

**Purpose:** Stores admin role assignments (separate from profile.role for security).

**Important:** Used by `has_role()` security definer function for RLS policies.

**Columns:** `user_id`, `role` (enum: `admin`, `moderator`, `user`)

---

### Table: `admin_permissions`

**Purpose:** Granular permission assignments for admin users.

**Permission types:** `users`, `jobs`, `contests`, `contracts`, `payments`, `disputes`, `reviews`, `platform_settings`, `activity_log`, `admin_management`

**Columns:** `user_id`, `permission`, `granted_by`

---

### Table: `admin_activity_log`

**Purpose:** Immutable audit trail of all admin actions.

**Columns:** `admin_id`, `action`, `target_type`, `target_id`, `details` (jsonb)

---

### Table: `moderation_logs`

**Purpose:** Records content policy violations detected by the moderation system.

**Columns:** `user_id`, `content_type` (`message`, `proposal`), `raw_content`, `violation_reason`, `confidence`

---

### Table: `user_violation_counts`

**Purpose:** Tracks accumulated violations per user for progressive enforcement.

**Columns:** `user_id`, `total_violations`, `last_violation_at`, `is_suspended`, `messaging_restricted_until`

**Escalation:** 1 violation = warning, 2 = 24h messaging restriction, 3+ = account suspension.

---

### Table: `certifications`

**Purpose:** Professional certifications listed on freelancer profiles.

**Columns:** `user_id`, `name`, `issuer`, `year_obtained`, `credential_url`

---

### Table: `work_experience`

**Purpose:** Work history entries for freelancer profiles.

**Columns:** `user_id`, `company`, `role`, `description`, `start_year`, `end_year`, `is_current`

---

### Table: `saved_experts`

**Purpose:** Client bookmarks/favorites of freelancers.

**Columns:** `client_id`, `freelancer_id`

---

## Database Functions

| Function | Type | Purpose |
|---|---|---|
| `handle_new_user()` | Trigger (AFTER INSERT on auth.users) | Creates profile row from signup metadata |
| `has_role(uuid, app_role)` | Security Definer | Checks user_roles table (used in RLS policies) |
| `is_super_admin(uuid)` | Security Definer | Checks for `admin_management` permission |
| `get_funding_status(uuid, int, int, uuid)` | Stable | Returns wallet balance and escrow held for a client |
| `get_contest_entry_count(uuid)` | Stable | Counts entries for a contest |
| `sync_job_status_on_contract_complete()` | Trigger | Sets job to `completed` when contract completes |
| `delete_user_account(uuid)` | Security Definer | Full account deletion with safety checks |
| `update_updated_at_column()` | Trigger | Auto-updates `updated_at` timestamps |

---

## Edge Functions

The platform has 16 edge functions deployed on Supabase. All use CORS headers and JWT-based authentication (except webhooks).

---

### 1. `auth-code`

**Purpose:** Manages 6-digit transaction authentication codes (set, verify, change, check, reset).

**Triggers:** Called from frontend for auth code setup guard, wallet withdrawals, contest publishing, revenue withdrawal.

**Input:** `{ action: "set"|"verify"|"change"|"check"|"reset"|"check_strength", code?, current_code?, new_code? }`

**Logic:**
- **set:** Validates code strength (rejects all-same, sequential, repeating patterns), hashes with SHA-256, stores in `profiles.auth_code_hash`
- **verify:** Hashes input and compares to stored hash
- **change:** Verifies current code, validates new code strength, ensures different from old, updates hash
- **check:** Returns `{ has_code: boolean }`
- **reset:** Verifies current code, clears hash (allows re-setup)

**Tables touched:** `profiles`

**Security:** Requires authenticated user. Code never stored in plaintext.

---

### 2. `verify-recaptcha`

**Purpose:** Server-side verification of reCAPTCHA v2 tokens during signup/login.

**Input:** `{ token: string }`

**Output:** `{ success: boolean, error?: string }`

**External API:** Google reCAPTCHA `siteverify` endpoint

**Secret:** `RECAPTCHA_SECRET_KEY`

---

### 3. `moderate-message`

**Purpose:** Two-layer content moderation for direct messages (regex + AI).

**Triggers:** Called before sending any direct message.

**Input:** `{ receiver_id, content, attachments }`

**Logic:**
1. Check if user is suspended or messaging-restricted
2. **Layer A (Regex):** 25+ patterns checking for emails, phone numbers, WhatsApp references, social media handles, URLs, bank details, profanity, obfuscated contact info
3. **Layer B (AI):** Sends content to Gemini Flash Lite for nuanced detection (>0.9 confidence threshold)
4. If violation detected: records in `moderation_logs`, increments `user_violation_counts`, returns error
5. If clean: inserts message into `messages` table

**Tables touched:** `messages`, `moderation_logs`, `user_violation_counts`

**External API:** Lovable AI Gateway (Gemini 2.5 Flash Lite)

---

### 4. `moderate-proposal`

**Purpose:** Same two-layer moderation for proposal cover letters.

**Triggers:** Called when freelancer submits a proposal.

**Input:** `{ job_id, bid_amount, delivery_days, cover_letter, attachments, payment_type, milestones, delivery_unit }`

**Additional checks:** Duplicate application prevention, job status verification (must be `open`), user suspension check.

**Tables touched:** `proposals`, `moderation_logs`, `user_violation_counts`, `jobs`

---

### 5. `paystack-charge`

**Purpose:** Handles wallet funding via Paystack (card, bank transfer, USSD).

**Triggers:** Fund Wallet modal.

**Actions:**
- `initiate`: Creates Paystack transaction (redirect-based for card/bank, charge API for USSD)
- `submit_pin`, `submit_otp`, `submit_phone`, `submit_birthday`, `submit_address`: Multi-step charge verification
- `check_pending`: Polls Paystack for transaction status

**Important logic:** Amount conversion from Naira to kobo (×100) for Paystack API. Double-credit prevention via reference uniqueness check.

**Tables touched:** `paystack_references`, `wallets`, `wallet_transactions`

**External API:** Paystack Transaction/Charge APIs

**Secret:** `PAYSTACK_SECRET_KEY`

---

### 6. `paystack-webhook`

**Purpose:** Receives Paystack webhook events for payment confirmation.

**Triggers:** POST from Paystack servers (no JWT — uses HMAC-SHA512 signature verification).

**Events handled:**
- `charge.success`: Credits wallet, creates transaction record, sends notification
- `transfer.success`: Updates payout status, marks milestone as paid, notifies expert
- `transfer.failed`: Updates payout status, notifies expert

**Security:** Verifies `x-paystack-signature` header using HMAC-SHA512. Double-credit prevention via existing transaction reference check.

**Tables touched:** `paystack_references`, `wallets`, `wallet_transactions`, `payout_transfers`, `milestones`, `notifications`

---

### 7. `paystack-transfer`

**Purpose:** Handles bank account management and withdrawal processing.

**Actions:**
- `list_banks`: Fetches Nigerian bank list from Paystack
- `resolve_account`: Verifies bank account details
- `save_bank`: Creates Paystack transfer recipient, saves bank details
- `withdraw`: User withdrawal — deducts from wallet, initiates Paystack transfer
- `admin_withdraw_revenue`: Super Admin revenue withdrawal — verifies admin status, checks available revenue, initiates transfer, logs activity

**Tables touched:** `bank_details`, `wallets`, `wallet_transactions`, `withdrawal_requests`, `platform_revenue`, `platform_settings`, `admin_activity_log`

**External API:** Paystack Bank/Transfer APIs

---

### 8. `escrow-release`

**Purpose:** The most complex function — handles the entire escrow lifecycle.

**Actions:**
- `fund_milestone`: Client locks funds in escrow for a milestone
- `submit_delivery`: Expert submits work for a milestone
- `approve_release`: Client approves delivery → calculates commission, releases funds to expert, records revenue, attempts auto-payout via Paystack
- `reject_milestone`: Client rejects submission (resets to funded status)
- `raise_dispute`: Either party raises a dispute → freezes funds, notifies respondent with 48h deadline
- `resolve_dispute`: Admin adjudicator resolves dispute with 4 resolution types (release to freelancer, refund client, partial split, no funds)

**Commission calculation:** Dynamic tiered rates loaded from `platform_settings.commission_tiers` with hardcoded fallback:
- ≤₦300,000: 20%
- ≤₦2,000,000: 15%
- ≤₦10,000,000: 10%
- >₦10,000,000: 7%

**Auto-completion:** When all milestones in a contract are approved, the contract status automatically changes to `completed`.

**Tables touched:** `milestones`, `contracts`, `wallets`, `wallet_transactions`, `escrow_ledger`, `escrow_transactions`, `platform_revenue`, `disputes`, `notifications`, `contract_messages`, `payout_transfers`, `bank_details`

---

### 9. `kyc-create-session`

**Purpose:** Creates a new KYC verification session with Didit.

**Input:** `{ callback_url? }`

**Logic:** Sends `workflow_id` and `vendor_data` (user ID) to Didit API, stores session ID and verification URL in `kyc_verifications`.

**External API:** Didit Verification API v3

**Secrets:** `DIDIT_API_KEY`, `DIDIT_WORKFLOW_ID`

---

### 10. `kyc-webhook`

**Purpose:** Receives Didit webhook callbacks after identity verification completes.

**Triggers:** POST from Didit servers (no JWT).

**Logic:**
1. Maps Didit status (`Approved`, `Declined`, `Need Review`) to internal status
2. Extracts document data (name, DOB, country, document type)
3. **Auto-validation (if Didit approved):**
   - Name matching: Compares profile name to ID name (requires ≥2 matching name parts)
   - Age check: Must be 18+ based on DOB
4. Updates `kyc_verifications` and `profiles.is_verified`
5. Sends notification with specific rejection reason if failed

**Tables touched:** `kyc_verifications`, `profiles`, `notifications`

---

### 11. `kyc-check-status`

**Purpose:** Polls Didit for verification status (used when webhook hasn't arrived).

**Logic:** Same name/age validation as webhook. Updates DB if status changed.

**External API:** Didit Session Decision API

---

### 12. `launch-contest`

**Purpose:** Creates a contest and locks prize pool in escrow.

**Input:** Contest details (title, description, prizes, deadline, skills, etc.)

**Logic:**
1. Validates required fields and prize pool > 0
2. Checks client wallet balance ≥ total prize pool
3. Creates contest with `status: active`
4. Deducts from wallet balance, adds to escrow balance
5. Records wallet transaction
6. On wallet failure: rolls back by deleting the contest

**Tables touched:** `contests`, `wallets`, `wallet_transactions`

---

### 13. `publish-contest-winners`

**Purpose:** Publishes selected nominees as winners and distributes prizes.

**Triggers:** Client clicks "Publish Winners" (requires auth code verification).

**Logic:**
1. Validates contest ownership, nominee count matches prize tiers
2. Marks nominees as winners with prize positions
3. Updates contest status to `completed`
4. For each winner: credits wallet, creates transaction record, deducts from client escrow
5. Sends congratulatory notifications

**Tables touched:** `contest_entries`, `contests`, `wallets`, `wallet_transactions`, `notifications`

---

### 14. `contest-auto-award`

**Purpose:** Automated contest lifecycle management (designed to run on a cron schedule).

**Logic:**
1. Finds contests past deadline still in `active` → updates to `selecting_winners`, notifies client
2. At 22 days past deadline: sends 3-day reminder
3. At 24 days: sends final 1-day warning
4. At 25 days: auto-awards nominees as winners OR flags for admin if no nominees selected

**Tables touched:** `contests`, `contest_entries`, `notifications`

---

### 15. `cancel-delete-job`

**Purpose:** Cancels and deletes a job posting with cascading cleanup.

**Logic:**
1. Verifies job ownership and no active contracts
2. Notifies all applicants that the job was cancelled
3. Rejects all pending proposals
4. Nullifies `job_id` on related contracts and offers (avoids FK violations)
5. Deletes the job

**Tables touched:** `jobs`, `proposals`, `contracts`, `offers`, `messages`

---

### 16. `manage-admin`

**Purpose:** Admin account management (Super Admin only).

**Actions:**
- `bootstrap`: First-time setup — grants all permissions to the first admin
- `list_admins`: Lists all admin users with their permissions
- `create_admin`: Creates a new admin user (via `auth.admin.createUser`)
- `update_permissions`: Modifies an admin's permission set
- `remove_admin`: Revokes admin role and permissions

**Security:** All mutating actions require `admin_management` permission. Cannot modify own permissions or remove self.

**Tables touched:** `user_roles`, `admin_permissions`, `profiles`, `admin_activity_log`

---

### 17. `export-contract-pdf`

**Purpose:** Generates an HTML report of a complete contract (for admin review/export).

**Triggers:** Admin panel contract view.

**Output:** Full HTML document with contract details, milestones, message history, attachments, disputes.

**Access:** Admin only (verified via `has_role` RPC).

---

### 18. `daily-job-notifications`

**Purpose:** AI-powered job matching notifications for freelancers.

**Logic:**
1. Fetches jobs posted in last 24 hours
2. For each freelancer: finds matching jobs based on skill overlap
3. Uses Gemini Flash Lite to compose personalized notification text
4. Currently logs to console (email service integration pending)

**External API:** Lovable AI Gateway

---

## Storage Structure

### Bucket: `job-attachments` (Public)
- **Contents:** Files attached to job postings (PDFs, images, CAD files)
- **Used by:** Post Job, Job Details

### Bucket: `proposal-attachments` (Public)
- **Contents:** Files attached to proposals
- **Used by:** Apply Job, Proposals Received

### Bucket: `chat-attachments` (Public)
- **Contents:** Files shared in direct messages
- **Used by:** Messages page

### Bucket: `contract-attachments` (Public)
- **Contents:** Files shared within contract chat and milestone submissions
- **Used by:** Contract Detail

### Bucket: `contest-banners` (Public)
- **Contents:** Banner images for contest listings
- **Used by:** Launch Contest, Contest Detail

### Bucket: `service-banners` (Public)
- **Contents:** Banner images for freelancer service offers
- **Used by:** My Services

### Bucket: `service-images` (Public)
- **Contents:** Gallery images for service offer details
- **Used by:** My Services, Browse Services

### Bucket: `avatars` (Public)
- **Contents:** User profile pictures
- **Used by:** My Profile, Header, everywhere avatars appear

---

## Authentication Flow

### Email/Password Signup

1. User fills signup form with full name (2+ words, 2+ chars each), username, email, password (strength indicator), role (client/freelancer)
2. reCAPTCHA v2 verification via `verify-recaptcha` edge function
3. `supabase.auth.signUp()` called with `user_metadata: { full_name, role, username }`
4. `handle_new_user()` trigger fires on `auth.users` INSERT → creates `profiles` row with metadata
5. Confirmation email sent (auto-confirm is disabled)
6. Success screen displayed showing next step: set authentication code
7. After email confirmation and login → `AuthCodeSetupGuard` forces 6-digit code setup (unclosable modal)

### Login

1. `supabase.auth.signInWithPassword()` called
2. `AuthProvider` receives `SIGNED_IN` event → fetches profile
3. Theme loaded from `profiles.theme_preference`
4. Admin users redirected to `/admin`, freelancers to `/jobs`, clients to `/dashboard`
5. `AuthCodeSetupGuard` checks if code is set, forces setup if not

### Role System

- `profiles.role`: Primary display role (`client` or `freelancer`) — determines UI navigation
- `user_roles` table: Security role (`admin`) — used by RLS policies via `has_role()` function
- `admin_permissions` table: Granular admin permissions — used for admin panel navigation/access
- Users can switch between client/freelancer role (both profiles maintained)

### Session Management (Frontend)

- `AuthProvider` wraps entire app, provides `user`, `profile`, `loading` state
- `AuthGuard` component redirects unauthenticated users to `/auth`
- `RoleGuard` component restricts routes by profile role
- `AuthCodeSetupGuard` enforces auth code configuration
- Sign out clears state and redirects to `/auth`

---

## Data Flows

### Jobs System

```
Client posts job → jobs table (status: open)
  → Freelancers browse and apply via moderate-proposal
    → proposals table (status: pending)
      → Client reviews proposals
        → Accepts proposal → Contract created (status: interviewing)
          → Client funds first milestone → Contract active
        → Rejects proposal → proposal.status = rejected
  → Client can cancel/delete via cancel-delete-job
    → All applicants notified, proposals rejected, job deleted
```

### Proposals System

```
Freelancer submits proposal:
  1. Moderation check (regex + AI) via moderate-proposal
  2. Duplicate check (one proposal per job per freelancer)
  3. Job status check (must be open)
  4. Proposal inserted with payment_type and optional milestones
  5. Client can: accept (→ create contract), reject, or shortlist
  6. Freelancer can: edit (limited edits) or withdraw
```

### Contracts & Milestones

```
Contract created from accepted proposal:
  → Status: interviewing → pending_funding
  → Client funds milestone via escrow-release/fund_milestone:
    1. Deducts from wallet balance
    2. Adds to wallet escrow_balance
    3. Creates escrow_ledger entry (held)
    4. Creates escrow_transaction (deposit)
    5. Milestone status → funded, Contract status → active
  → Expert works and submits delivery:
    1. Milestone status → submitted
    2. Client notified
  → Client approves via escrow-release/approve_release:
    1. Commission calculated (tiered: 7-20%)
    2. Client escrow_balance reduced
    3. Expert wallet balance credited (amount - commission)
    4. platform_revenue recorded
    5. Automatic Paystack payout attempted if bank details exist
    6. If all milestones approved → contract completed
  → OR Client rejects:
    1. Milestone reset to funded status
    2. Expert can resubmit
  → OR Either party raises dispute:
    1. Contract status → disputed
    2. Respondent has 48 hours to respond
    3. Admin adjudicator resolves with split options
```

### Wallets and Escrow

```
Wallet Funding:
  User selects payment method (Card/Bank/USSD)
    → paystack-charge/initiate
      → Redirects to Paystack checkout (card/bank)
      → OR multi-step USSD flow
    → paystack-webhook receives charge.success
      → Credits wallet (amount ÷ 100 for kobo→naira conversion)
      → Records wallet_transaction

Escrow Flow:
  Client funds milestone → balance → escrow_balance
  Expert delivers + approved → escrow_balance released
    → Commission deducted → platform_revenue
    → Net amount → expert's wallet balance
    → Auto-payout attempt to expert's bank

Withdrawal:
  User requests withdrawal via paystack-transfer/withdraw
    → Validates wallet balance
    → Deducts from balance
    → Initiates Paystack transfer
    → Records withdrawal_request + wallet_transaction
    → paystack-webhook confirms or reverses
```

### Contests and Contest Entries

```
Client launches contest:
  1. Wallet balance check ≥ total prize pool
  2. Contest created via launch-contest
  3. Prize pool locked in escrow
  4. Freelancers submit entries (attachments + description)
  5. Client reviews, nominates finalists
  6. Client publishes winners via publish-contest-winners (auth code required):
     a. Nominees marked as winners with positions
     b. Prize amounts credited to winner wallets
     c. Client escrow reduced
  7. OR Auto-award at 25 days past deadline via contest-auto-award:
     a. Nominees auto-promoted to winners
     b. Same prize distribution
```

### Messaging

```
Direct Messages (pre-contract):
  Sender → moderate-message edge function
    → Regex moderation (25+ patterns)
    → AI moderation (Gemini Flash Lite, >0.9 confidence)
    → If clean: inserted into messages table
    → If violation: blocked, recorded in moderation_logs

Contract Messages (within contract):
  Sent directly to contract_messages table (RLS enforced)
  System messages generated by escrow actions
  Attachments stored in contract_attachments
```

### Verification / KYC (Didit)

```
User initiates verification:
  1. Frontend calls kyc-create-session
  2. Edge function creates Didit session with workflow_id
  3. Returns verification_url → user redirected to Didit
  4. User completes document + selfie verification on Didit
  5. Didit sends result via kyc-webhook:
     a. Document data extracted (name, DOB, country)
     b. Name matching: profile name vs ID name (≥2 matching parts)
     c. Age verification: must be 18+
     d. If all pass: profiles.is_verified = true, notification sent
     e. If fail: kyc_status = failed, specific reason in admin_notes
  6. Frontend polls kyc-check-status as fallback
```

---

## Environment Variables / Secrets

| Secret | Purpose |
|---|---|
| `SUPABASE_URL` | Database connection URL |
| `SUPABASE_ANON_KEY` | Public API key (used for user-context queries) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) |
| `SUPABASE_DB_URL` | Direct database connection string |
| `PAYSTACK_SECRET_KEY` | Paystack API authentication |
| `RECAPTCHA_SECRET_KEY` | Google reCAPTCHA v2 server-side verification |
| `DIDIT_API_KEY` | Didit KYC API authentication |
| `DIDIT_WORKFLOW_ID` | Didit verification workflow identifier |
| `LOVABLE_API_KEY` | Lovable AI Gateway (for Gemini models) |
| `SUPABASE_PUBLISHABLE_KEY` | Frontend-safe Supabase key |

---

*End of Backend Architecture Documentation*
