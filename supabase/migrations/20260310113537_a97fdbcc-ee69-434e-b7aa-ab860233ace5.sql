
-- Add pending_clearance to wallets
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS pending_clearance integer NOT NULL DEFAULT 0;

-- Add clearance_at to wallet_transactions (when funds become available)
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS clearance_at timestamptz DEFAULT NULL;

-- Add withdrawals_frozen platform setting check (done via platform_settings table, no schema change needed)

-- Recreate release_milestone_atomic to credit pending_clearance instead of balance
CREATE OR REPLACE FUNCTION public.release_milestone_atomic(
  _user_id uuid,
  _milestone_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  _milestone record;
  _ledger_id uuid;
  _held_amount integer;
  _commission_rate numeric;
  _platform_fee integer;
  _expert_amount integer;
  _fl_new_balance integer;
  _fl_pending integer;
  _client_escrow integer;
  _all_approved boolean;
  _tiers jsonb;
  _fl_wallet record;
  _clearance_at timestamptz;
BEGIN
  SELECT m.id, m.title, m.amount, m.status, m.contract_id,
         c.client_id, c.freelancer_id
  INTO _milestone
  FROM milestones m JOIN contracts c ON c.id = m.contract_id
  WHERE m.id = _milestone_id;

  IF _milestone IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Milestone not found'); END IF;
  IF _milestone.client_id != _user_id THEN RETURN jsonb_build_object('success', false, 'error', 'Not authorized'); END IF;
  IF _milestone.status != 'submitted' THEN RETURN jsonb_build_object('success', false, 'error', 'Milestone not submitted for approval'); END IF;

  SELECT id, held_amount INTO _ledger_id, _held_amount
  FROM escrow_ledger WHERE milestone_id = _milestone_id AND status = 'held' FOR UPDATE;

  IF _ledger_id IS NULL THEN
    PERFORM 1 FROM escrow_ledger WHERE milestone_id = _milestone_id AND status = 'released';
    IF FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Milestone already released'); END IF;
    INSERT INTO escrow_ledger (contract_id, milestone_id, held_amount, status)
    VALUES (_milestone.contract_id, _milestone_id, _milestone.amount, 'held')
    RETURNING id, held_amount INTO _ledger_id, _held_amount;
  END IF;

  SELECT value INTO _tiers FROM platform_settings WHERE key = 'commission_tiers';
  _commission_rate := 0.20;
  IF _tiers IS NOT NULL AND jsonb_typeof(_tiers) = 'array' THEN
    FOR i IN 0..jsonb_array_length(_tiers) - 1 LOOP
      IF (_tiers->i->>'max_amount') IS NULL OR _held_amount <= (_tiers->i->>'max_amount')::integer THEN
        _commission_rate := (_tiers->i->>'rate')::numeric / 100.0; EXIT;
      END IF;
    END LOOP;
  END IF;

  _platform_fee := round(_held_amount * _commission_rate)::integer;
  _expert_amount := _held_amount - _platform_fee;

  -- Debit client escrow
  UPDATE wallets SET escrow_balance = GREATEST(0, escrow_balance - _held_amount), updated_at = now()
  WHERE user_id = _milestone.client_id;
  SELECT escrow_balance INTO _client_escrow FROM wallets WHERE user_id = _milestone.client_id;

  -- Credit freelancer PENDING CLEARANCE (not balance)
  _clearance_at := now() + interval '48 hours';
  SELECT * INTO _fl_wallet FROM wallets WHERE user_id = _milestone.freelancer_id FOR UPDATE;
  IF _fl_wallet IS NOT NULL THEN
    _fl_pending := _fl_wallet.pending_clearance + _expert_amount;
    _fl_new_balance := _fl_wallet.balance;
    UPDATE wallets SET pending_clearance = _fl_pending, total_earned = total_earned + _expert_amount, updated_at = now()
    WHERE user_id = _milestone.freelancer_id;
  ELSE
    _fl_pending := _expert_amount;
    _fl_new_balance := 0;
    INSERT INTO wallets (user_id, balance, pending_clearance, total_earned) VALUES (_milestone.freelancer_id, 0, _expert_amount, _expert_amount);
  END IF;

  UPDATE escrow_ledger SET released_amount = _held_amount, platform_fee = _platform_fee,
    expert_amount = _expert_amount, status = 'released', updated_at = now() WHERE id = _ledger_id;

  INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description, contract_id, milestone_id, reference, clearance_at) VALUES
    (_milestone.client_id, 'escrow_release', _held_amount, COALESCE(_client_escrow, 0),
     'Released milestone: ' || _milestone.title, _milestone.contract_id, _milestone.id, 'release_client_' || _milestone_id, NULL),
    (_milestone.freelancer_id, 'escrow_release', _expert_amount, _fl_new_balance,
     'Payment received: ' || _milestone.title || ' (pending clearance)', _milestone.contract_id, _milestone.id, 'release_expert_' || _milestone_id, _clearance_at);

  INSERT INTO escrow_transactions (contract_id, milestone_id, payer_id, payee_id, amount, type, status)
  VALUES (_milestone.contract_id, _milestone.id, _milestone.client_id, _milestone.freelancer_id, _expert_amount, 'release', 'completed');

  INSERT INTO platform_revenue (contract_id, milestone_id, gross_amount, commission_rate, commission_amount, net_to_freelancer)
  VALUES (_milestone.contract_id, _milestone.id, _held_amount, _commission_rate, _platform_fee, _expert_amount);

  UPDATE milestones SET status = 'approved', approved_at = now() WHERE id = _milestone_id;

  SELECT NOT EXISTS (SELECT 1 FROM milestones WHERE contract_id = _milestone.contract_id AND status != 'approved')
  INTO _all_approved;

  IF _all_approved THEN
    UPDATE contracts SET status = 'completed', completed_at = now() WHERE id = _milestone.contract_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'milestone_title', _milestone.title, 'amount', _held_amount,
    'platform_fee', _platform_fee, 'expert_amount', _expert_amount, 'commission_rate', _commission_rate,
    'contract_id', _milestone.contract_id, 'freelancer_id', _milestone.freelancer_id,
    'client_id', _milestone.client_id, 'all_approved', _all_approved, 'milestone_id', _milestone_id);
END;
$fn$;

-- Function to clear pending funds that have passed 48h
CREATE OR REPLACE FUNCTION public.clear_pending_funds()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  _tx record;
  _wallet record;
  _new_balance integer;
  _cleared_count integer := 0;
BEGIN
  FOR _tx IN
    SELECT wt.id, wt.user_id, wt.amount, wt.clearance_at
    FROM wallet_transactions wt
    WHERE wt.type = 'escrow_release'
      AND wt.clearance_at IS NOT NULL
      AND wt.clearance_at <= now()
      AND wt.status = 'completed'
      AND wt.user_id IN (SELECT user_id FROM wallets WHERE pending_clearance > 0)
  LOOP
    SELECT * INTO _wallet FROM wallets WHERE user_id = _tx.user_id FOR UPDATE;
    IF _wallet IS NOT NULL AND _wallet.pending_clearance >= _tx.amount THEN
      _new_balance := _wallet.balance + _tx.amount;
      UPDATE wallets
      SET balance = _new_balance,
          pending_clearance = pending_clearance - _tx.amount,
          updated_at = now()
      WHERE user_id = _tx.user_id;

      -- Mark this transaction as cleared by removing clearance_at
      UPDATE wallet_transactions SET clearance_at = NULL, balance_after = _new_balance WHERE id = _tx.id;

      _cleared_count := _cleared_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'cleared_count', _cleared_count);
END;
$fn$;

-- Update withdraw_wallet_atomic to check only available balance (not pending) and enforce ₦5,000 minimum
CREATE OR REPLACE FUNCTION public.withdraw_wallet_atomic(
  _user_id uuid, _amount integer, _bank_detail_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  _wallet record; _bank record; _new_balance integer; _withdrawal_id uuid; _ref text;
  _frozen boolean;
BEGIN
  IF _amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid amount'); END IF;
  IF _amount < 5000 THEN RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal amount is ₦5,000.'); END IF;

  -- Check if withdrawals are frozen
  SELECT (value::text)::boolean INTO _frozen FROM platform_settings WHERE key = 'withdrawals_frozen';
  IF _frozen IS TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawals are temporarily frozen by the platform.');
  END IF;

  SELECT * INTO _wallet FROM wallets WHERE user_id = _user_id FOR UPDATE;
  IF _wallet IS NULL OR _wallet.balance < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  SELECT * INTO _bank FROM bank_details WHERE id = _bank_detail_id AND user_id = _user_id;
  IF _bank IS NULL OR _bank.recipient_code IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bank details not found or invalid');
  END IF;

  _new_balance := _wallet.balance - _amount;
  _ref := 'withdraw_' || gen_random_uuid()::text;

  UPDATE wallets SET balance = _new_balance, updated_at = now() WHERE user_id = _user_id;

  INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description, reference, status)
  VALUES (_user_id, 'withdrawal', _amount, _new_balance,
    'Withdrawal to ' || _bank.bank_name || ' - ' || _bank.account_number, _ref, 'pending');

  INSERT INTO withdrawal_requests (user_id, amount, bank_detail_id, status)
  VALUES (_user_id, _amount, _bank_detail_id, 'pending')
  RETURNING id INTO _withdrawal_id;

  RETURN jsonb_build_object('success', true, 'new_balance', _new_balance, 'withdrawal_id', _withdrawal_id,
    'recipient_code', _bank.recipient_code, 'reference', _ref);
END;
$fn$;
