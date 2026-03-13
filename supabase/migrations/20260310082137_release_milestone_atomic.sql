-- 2. ATOMIC ESCROW RELEASE
CREATE OR REPLACE FUNCTION public.release_milestone_atomic(
  _user_id uuid,
  _milestone_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  i integer;
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

  UPDATE wallets SET escrow_balance = GREATEST(0, escrow_balance - _held_amount), updated_at = now()
  WHERE user_id = _milestone.client_id;
  SELECT escrow_balance INTO _client_escrow FROM wallets WHERE user_id = _milestone.client_id;

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
$$;
