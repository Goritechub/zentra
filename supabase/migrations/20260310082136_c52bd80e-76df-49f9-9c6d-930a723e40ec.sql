
-- 1. ATOMIC MILESTONE FUNDING
CREATE OR REPLACE FUNCTION public.fund_milestone_atomic(
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
  _wallet record;
  _new_balance integer;
BEGIN
  SELECT m.id, m.title, m.amount, m.status, m.contract_id,
         c.client_id, c.freelancer_id, c.status AS contract_status
  INTO _milestone
  FROM milestones m JOIN contracts c ON c.id = m.contract_id
  WHERE m.id = _milestone_id;

  IF _milestone IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Milestone not found');
  END IF;
  IF _milestone.client_id != _user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  IF _milestone.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Milestone already funded');
  END IF;

  SELECT * INTO _wallet FROM wallets WHERE user_id = _user_id FOR UPDATE;
  IF _wallet IS NULL OR _wallet.balance < _milestone.amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance. Please fund your wallet first.');
  END IF;

  _new_balance := _wallet.balance - _milestone.amount;

  UPDATE wallets SET balance = _new_balance, escrow_balance = escrow_balance + _milestone.amount,
    total_spent = total_spent + _milestone.amount, updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description, contract_id, milestone_id, reference)
  VALUES (_user_id, 'escrow_lock', _milestone.amount, _new_balance,
    'Funded milestone: ' || _milestone.title, _milestone.contract_id, _milestone.id, 'fund_ms_' || _milestone.id);

  INSERT INTO escrow_ledger (contract_id, milestone_id, held_amount, status)
  VALUES (_milestone.contract_id, _milestone.id, _milestone.amount, 'held');

  INSERT INTO escrow_transactions (contract_id, milestone_id, payer_id, amount, type, status)
  VALUES (_milestone.contract_id, _milestone.id, _user_id, _milestone.amount, 'deposit', 'completed');

  UPDATE milestones SET status = 'funded', funded_at = now() WHERE id = _milestone_id;

  IF _milestone.contract_status IN ('pending_funding', 'interviewing') THEN
    UPDATE contracts SET status = 'active' WHERE id = _milestone.contract_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'milestone_title', _milestone.title,
    'amount', _milestone.amount, 'contract_id', _milestone.contract_id,
    'freelancer_id', _milestone.freelancer_id);
END;
$fn$;

-- 2. ATOMIC ESCROW RELEASE
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
  _client_escrow integer;
  _all_approved boolean;
  _tiers jsonb;
  _fl_wallet record;
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

  -- Credit freelancer
  SELECT * INTO _fl_wallet FROM wallets WHERE user_id = _milestone.freelancer_id FOR UPDATE;
  IF _fl_wallet IS NOT NULL THEN
    _fl_new_balance := _fl_wallet.balance + _expert_amount;
    UPDATE wallets SET balance = _fl_new_balance, total_earned = total_earned + _expert_amount, updated_at = now()
    WHERE user_id = _milestone.freelancer_id;
  ELSE
    _fl_new_balance := _expert_amount;
    INSERT INTO wallets (user_id, balance, total_earned) VALUES (_milestone.freelancer_id, _expert_amount, _expert_amount);
  END IF;

  UPDATE escrow_ledger SET released_amount = _held_amount, platform_fee = _platform_fee,
    expert_amount = _expert_amount, status = 'released', updated_at = now() WHERE id = _ledger_id;

  INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description, contract_id, milestone_id, reference) VALUES
    (_milestone.client_id, 'escrow_release', _held_amount, COALESCE(_client_escrow, 0),
     'Released milestone: ' || _milestone.title, _milestone.contract_id, _milestone.id, 'release_client_' || _milestone_id),
    (_milestone.freelancer_id, 'escrow_release', _expert_amount, _fl_new_balance,
     'Payment received: ' || _milestone.title, _milestone.contract_id, _milestone.id, 'release_expert_' || _milestone_id);

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
    'client_id', _milestone.client_id, 'all_approved', _all_approved);
END;
$fn$;

-- 3. ATOMIC DISPUTE RESOLUTION
CREATE OR REPLACE FUNCTION public.resolve_dispute_atomic(
  _admin_id uuid, _dispute_id uuid, _contract_id uuid, _resolution_type text,
  _resolution_explanation text, _split_client integer DEFAULT 0, _split_freelancer integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  _contract record; _total_held integer; _commission_rate numeric; _platform_fee integer;
  _expert_amount integer; _tiers jsonb; _dispute_status_out text;
BEGIN
  IF NOT has_role(_admin_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can resolve disputes');
  END IF;

  SELECT * INTO _contract FROM contracts WHERE id = _contract_id;
  IF _contract IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Contract not found'); END IF;

  SELECT COALESCE(SUM(held_amount), 0) INTO _total_held FROM escrow_ledger WHERE contract_id = _contract_id AND status = 'held';

  IF _total_held <= 0 OR _resolution_type = 'no_funds' THEN
    UPDATE disputes SET dispute_status = 'resolved', status = 'closed', resolution_type = 'no_funds',
      resolution_explanation = _resolution_explanation, resolved_at = now(), resolved_by = _admin_id, updated_at = now()
    WHERE id = _dispute_id;
    IF _contract.status = 'disputed' THEN
      UPDATE contracts SET status = 'completed', completed_at = now() WHERE id = _contract_id;
    END IF;
    UPDATE milestones SET status = 'approved' WHERE contract_id = _contract_id AND status = 'disputed';
    RETURN jsonb_build_object('success', true, 'resolution', 'no_funds',
      'client_id', _contract.client_id, 'freelancer_id', _contract.freelancer_id);
  END IF;

  SELECT value INTO _tiers FROM platform_settings WHERE key = 'commission_tiers';
  _commission_rate := 0.20;
  IF _tiers IS NOT NULL AND jsonb_typeof(_tiers) = 'array' THEN
    FOR i IN 0..jsonb_array_length(_tiers) - 1 LOOP
      IF (_tiers->i->>'max_amount') IS NULL OR _total_held <= (_tiers->i->>'max_amount')::integer THEN
        _commission_rate := (_tiers->i->>'rate')::numeric / 100.0; EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Lock wallets in consistent order to prevent deadlocks
  IF _contract.client_id < _contract.freelancer_id THEN
    PERFORM 1 FROM wallets WHERE user_id = _contract.client_id FOR UPDATE;
    PERFORM 1 FROM wallets WHERE user_id = _contract.freelancer_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM wallets WHERE user_id = _contract.freelancer_id FOR UPDATE;
    PERFORM 1 FROM wallets WHERE user_id = _contract.client_id FOR UPDATE;
  END IF;

  IF _resolution_type = 'release_to_freelancer' THEN
    _platform_fee := round(_total_held * _commission_rate)::integer;
    _expert_amount := _total_held - _platform_fee;
    UPDATE wallets SET escrow_balance = GREATEST(0, escrow_balance - _total_held), updated_at = now() WHERE user_id = _contract.client_id;
    UPDATE wallets SET balance = balance + _expert_amount, total_earned = total_earned + _expert_amount, updated_at = now()
    WHERE user_id = _contract.freelancer_id;
    IF NOT FOUND THEN
      INSERT INTO wallets (user_id, balance, total_earned) VALUES (_contract.freelancer_id, _expert_amount, _expert_amount);
    END IF;
    INSERT INTO platform_revenue (contract_id, gross_amount, commission_rate, commission_amount, net_to_freelancer)
    VALUES (_contract_id, _total_held, _commission_rate, _platform_fee, _expert_amount);

  ELSIF _resolution_type = 'refund_client' THEN
    UPDATE wallets SET balance = balance + _total_held, escrow_balance = GREATEST(0, escrow_balance - _total_held), updated_at = now()
    WHERE user_id = _contract.client_id;

  ELSIF _resolution_type = 'partial_split' THEN
    _platform_fee := round(COALESCE(_split_freelancer, 0) * _commission_rate)::integer;
    _expert_amount := COALESCE(_split_freelancer, 0) - _platform_fee;
    UPDATE wallets SET balance = balance + COALESCE(_split_client, 0), escrow_balance = GREATEST(0, escrow_balance - _total_held), updated_at = now()
    WHERE user_id = _contract.client_id;
    UPDATE wallets SET balance = balance + _expert_amount, total_earned = total_earned + _expert_amount, updated_at = now()
    WHERE user_id = _contract.freelancer_id;
    IF NOT FOUND THEN
      INSERT INTO wallets (user_id, balance, total_earned) VALUES (_contract.freelancer_id, _expert_amount, _expert_amount);
    END IF;
    IF COALESCE(_split_freelancer, 0) > 0 THEN
      INSERT INTO platform_revenue (contract_id, gross_amount, commission_rate, commission_amount, net_to_freelancer)
      VALUES (_contract_id, _split_freelancer, _commission_rate, _platform_fee, _expert_amount);
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid resolution type');
  END IF;

  UPDATE escrow_ledger SET status = CASE WHEN _resolution_type = 'refund_client' THEN 'refunded' ELSE 'released' END,
    released_amount = held_amount, updated_at = now()
  WHERE contract_id = _contract_id AND status = 'held';

  _dispute_status_out := CASE WHEN _resolution_type = 'release_to_freelancer' THEN 'resolved_freelancer'
    WHEN _resolution_type = 'refund_client' THEN 'resolved_client' ELSE 'closed' END;

  UPDATE disputes SET dispute_status = 'resolved', status = _dispute_status_out, resolution_type = _resolution_type,
    resolution_explanation = _resolution_explanation, resolution_split_client = COALESCE(_split_client, 0),
    resolution_split_freelancer = COALESCE(_split_freelancer, 0), adjudicator_id = _admin_id,
    resolved_by = _admin_id, resolved_at = now(), updated_at = now()
  WHERE id = _dispute_id;

  UPDATE contracts SET status = 'completed', completed_at = now() WHERE id = _contract_id;
  UPDATE milestones SET status = 'approved' WHERE contract_id = _contract_id AND status = 'disputed';

  RETURN jsonb_build_object('success', true, 'resolution', _resolution_type,
    'client_id', _contract.client_id, 'freelancer_id', _contract.freelancer_id);
END;
$fn$;

-- 4. ATOMIC CONTEST LAUNCH
CREATE OR REPLACE FUNCTION public.launch_contest_atomic(
  _user_id uuid, _title text, _description text, _category text,
  _prize_first integer, _prize_second integer DEFAULT 0, _prize_third integer DEFAULT 0,
  _prize_fourth integer DEFAULT 0, _prize_fifth integer DEFAULT 0,
  _deadline timestamptz DEFAULT NULL, _required_skills text[] DEFAULT '{}',
  _visibility text DEFAULT 'open', _rules text DEFAULT NULL,
  _banner_image text DEFAULT NULL, _winner_selection_method text DEFAULT 'client_selects'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  _total_pool integer; _wallet record; _contest_id uuid; _new_balance integer;
BEGIN
  _total_pool := COALESCE(_prize_first,0)+COALESCE(_prize_second,0)+COALESCE(_prize_third,0)+COALESCE(_prize_fourth,0)+COALESCE(_prize_fifth,0);
  IF _total_pool <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Prize pool must be greater than zero'); END IF;

  SELECT * INTO _wallet FROM wallets WHERE user_id = _user_id FOR UPDATE;
  IF _wallet IS NULL OR _wallet.balance < _total_pool THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_funds',
      'wallet_balance', COALESCE(_wallet.balance, 0), 'total_prize_pool', _total_pool,
      'shortfall', _total_pool - COALESCE(_wallet.balance, 0));
  END IF;

  _new_balance := _wallet.balance - _total_pool;

  INSERT INTO contests (client_id, title, description, category, prize_first, prize_second, prize_third,
    prize_fourth, prize_fifth, deadline, required_skills, visibility, rules, banner_image,
    winner_selection_method, status)
  VALUES (_user_id, _title, _description, _category, _prize_first, COALESCE(_prize_second,0),
    COALESCE(_prize_third,0), COALESCE(_prize_fourth,0), COALESCE(_prize_fifth,0),
    _deadline, _required_skills, _visibility, _rules, _banner_image, _winner_selection_method, 'active')
  RETURNING id INTO _contest_id;

  UPDATE wallets SET balance = _new_balance, escrow_balance = escrow_balance + _total_pool,
    total_spent = total_spent + _total_pool, updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO wallet_transactions (user_id, amount, balance_after, type, description, reference)
  VALUES (_user_id, _total_pool, _new_balance, 'debit',
    'Contest prize pool escrow — "' || _title || '"', 'contest_escrow_' || _contest_id);

  RETURN jsonb_build_object('success', true, 'contest_id', _contest_id);
END;
$fn$;

-- 5. ATOMIC CONTEST WINNER PAYOUT
CREATE OR REPLACE FUNCTION public.publish_contest_winners_atomic(
  _user_id uuid, _contest_id uuid, _is_auto_award boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  _contest record; _nom record; _prizes integer[]; _pos_labels text[] := ARRAY['1st','2nd','3rd','4th','5th'];
  _expected_count integer; _nom_count integer; _winner_wallet record; _new_balance integer;
  _i integer := 0; _prize integer; _total_paid integer := 0;
BEGIN
  SELECT * INTO _contest FROM contests WHERE id = _contest_id FOR UPDATE;
  IF _contest IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Contest not found'); END IF;
  IF NOT _is_auto_award AND _contest.client_id != _user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the contest owner can publish winners');
  END IF;
  IF _contest.status IN ('completed', 'ended') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contest already completed');
  END IF;

  _prizes := ARRAY[_contest.prize_first, COALESCE(_contest.prize_second,0), COALESCE(_contest.prize_third,0),
    COALESCE(_contest.prize_fourth,0), COALESCE(_contest.prize_fifth,0)];
  _expected_count := 1;
  IF _prizes[2] > 0 THEN _expected_count := 2; END IF;
  IF _prizes[3] > 0 THEN _expected_count := 3; END IF;
  IF _prizes[4] > 0 THEN _expected_count := 4; END IF;
  IF _prizes[5] > 0 THEN _expected_count := 5; END IF;

  SELECT count(*) INTO _nom_count FROM contest_entries WHERE contest_id = _contest_id AND is_nominee = true;

  IF _is_auto_award THEN
    _expected_count := LEAST(_nom_count, _expected_count);
    IF _expected_count = 0 THEN RETURN jsonb_build_object('success', false, 'error', 'No nominees to auto-award'); END IF;
  ELSE
    IF _nom_count != _expected_count THEN
      RETURN jsonb_build_object('success', false, 'error', 'Expected ' || _expected_count || ' nominees, got ' || _nom_count);
    END IF;
  END IF;

  -- Lock client wallet
  PERFORM 1 FROM wallets WHERE user_id = _contest.client_id FOR UPDATE;

  FOR _nom IN SELECT * FROM contest_entries WHERE contest_id = _contest_id AND is_nominee = true ORDER BY created_at LIMIT _expected_count
  LOOP
    _i := _i + 1;
    _prize := _prizes[_i];
    IF _prize <= 0 THEN CONTINUE; END IF;

    UPDATE contest_entries SET is_winner = true, prize_position = _i, is_nominee = false WHERE id = _nom.id;

    SELECT * INTO _winner_wallet FROM wallets WHERE user_id = _nom.freelancer_id FOR UPDATE;
    IF _winner_wallet IS NOT NULL THEN
      _new_balance := _winner_wallet.balance + _prize;
      UPDATE wallets SET balance = _new_balance, total_earned = total_earned + _prize, updated_at = now()
      WHERE user_id = _nom.freelancer_id;
    ELSE
      _new_balance := _prize;
      INSERT INTO wallets (user_id, balance, total_earned) VALUES (_nom.freelancer_id, _prize, _prize);
    END IF;

    INSERT INTO wallet_transactions (user_id, amount, balance_after, type, description, reference)
    VALUES (_nom.freelancer_id, _prize, _new_balance, 'credit',
      'Contest prize (' || _pos_labels[_i] || ' place) — "' || _contest.title || '"',
      'contest_prize_' || _contest_id || '_' || _i);

    UPDATE wallets SET escrow_balance = GREATEST(0, escrow_balance - _prize), updated_at = now()
    WHERE user_id = _contest.client_id;

    _total_paid := _total_paid + _prize;

    INSERT INTO notifications (user_id, type, title, message)
    VALUES (_nom.freelancer_id, 'contest_winner', '🏆 You won ' || _pos_labels[_i] || ' place!',
      'Congratulations! You won ₦' || _prize::text || ' in "' || _contest.title || '". The prize has been credited to your wallet.');
  END LOOP;

  UPDATE contests SET status = 'completed', updated_at = now() WHERE id = _contest_id;

  RETURN jsonb_build_object('success', true, 'winners', _i, 'total_paid', _total_paid);
END;
$fn$;

-- 6. ATOMIC WALLET WITHDRAWAL
CREATE OR REPLACE FUNCTION public.withdraw_wallet_atomic(
  _user_id uuid, _amount integer, _bank_detail_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  _wallet record; _bank record; _new_balance integer; _withdrawal_id uuid; _ref text;
BEGIN
  IF _amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid amount'); END IF;

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

-- 7. ATOMIC WITHDRAWAL REVERSAL
CREATE OR REPLACE FUNCTION public.reverse_withdrawal_atomic(
  _user_id uuid, _withdrawal_id uuid, _reference text, _reason text DEFAULT 'Transfer failed'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE _wr record; _wallet record;
BEGIN
  SELECT * INTO _wr FROM withdrawal_requests WHERE id = _withdrawal_id AND user_id = _user_id FOR UPDATE;
  IF _wr IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found'); END IF;
  IF _wr.status NOT IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal already finalized');
  END IF;

  SELECT * INTO _wallet FROM wallets WHERE user_id = _user_id FOR UPDATE;

  UPDATE wallets SET balance = balance + _wr.amount, updated_at = now() WHERE user_id = _user_id;
  UPDATE withdrawal_requests SET status = 'failed', reason = _reason, updated_at = now() WHERE id = _withdrawal_id;
  UPDATE wallet_transactions SET status = 'reversed', description = description || ' (REVERSED: ' || _reason || ')'
  WHERE reference = _reference AND user_id = _user_id AND status = 'pending';

  INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description, reference, status)
  VALUES (_user_id, 'reversal', _wr.amount, COALESCE(_wallet.balance, 0) + _wr.amount,
    'Withdrawal reversed: ' || _reason, 'rev_' || _reference, 'completed');

  RETURN jsonb_build_object('success', true);
END;
$fn$;

-- 8. ATOMIC WALLET CREDIT
CREATE OR REPLACE FUNCTION public.credit_wallet_atomic(
  _user_id uuid, _amount integer, _description text, _reference text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE _wallet record; _new_balance integer;
BEGIN
  IF _amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid amount'); END IF;

  PERFORM 1 FROM wallet_transactions WHERE reference = _reference;
  IF FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Already credited', 'duplicate', true); END IF;

  SELECT * INTO _wallet FROM wallets WHERE user_id = _user_id FOR UPDATE;
  IF _wallet IS NOT NULL THEN
    _new_balance := _wallet.balance + _amount;
    UPDATE wallets SET balance = _new_balance, updated_at = now() WHERE user_id = _user_id;
  ELSE
    _new_balance := _amount;
    INSERT INTO wallets (user_id, balance) VALUES (_user_id, _amount);
  END IF;

  INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description, reference)
  VALUES (_user_id, 'credit', _amount, _new_balance, _description, _reference);

  RETURN jsonb_build_object('success', true, 'new_balance', _new_balance);
END;
$fn$;
