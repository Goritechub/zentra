-- Startup launch promo: halves the effective commission rate for everyone (current and new
-- users), for 3 years from launch. Stored as a platform_settings row so admins can toggle/edit
-- it later without a migration (see admin settings/commission-promo endpoint).
INSERT INTO public.platform_settings (key, value) VALUES (
  'commission_promo',
  jsonb_build_object(
    'active', true,
    'label', 'Startup Launch Promo — 50% off platform fees',
    'discount_percent', 50,
    'starts_at', to_jsonb(now()),
    'ends_at', to_jsonb(now() + interval '3 years')
  )
) ON CONFLICT (key) DO NOTHING;

-- Recreate release_milestone_atomic to also apply the active commission promo, and the
-- (previously display-only) referral discount, on top of the tiered rate.
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
  _fl_pending integer;
  _client_escrow integer;
  _all_approved boolean;
  _tiers jsonb;
  _promo jsonb;
  _referred_by uuid;
  _referral_expires timestamptz;
  _fl_wallet record;
  _clearance_at timestamptz;
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

  SELECT value INTO _promo FROM platform_settings WHERE key = 'commission_promo';
  IF _promo IS NOT NULL AND (_promo->>'active')::boolean IS TRUE
     AND now() >= (_promo->>'starts_at')::timestamptz AND now() <= (_promo->>'ends_at')::timestamptz THEN
    _commission_rate := _commission_rate * (1 - (_promo->>'discount_percent')::numeric / 100.0);
  END IF;

  SELECT referred_by, referral_expires_at INTO _referred_by, _referral_expires
  FROM profiles WHERE id = _milestone.client_id;
  IF _referred_by = _milestone.freelancer_id AND (_referral_expires IS NULL OR _referral_expires > now()) THEN
    _commission_rate := _commission_rate * 0.5;
  END IF;

  _platform_fee := round(_held_amount * _commission_rate)::integer;
  _expert_amount := _held_amount - _platform_fee;

  UPDATE wallets SET escrow_balance = GREATEST(0, escrow_balance - _held_amount), updated_at = now()
  WHERE user_id = _milestone.client_id;
  SELECT escrow_balance INTO _client_escrow FROM wallets WHERE user_id = _milestone.client_id;

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
$$;

-- Recreate resolve_dispute_atomic to also apply the active commission promo, and the
-- (previously display-only) referral discount, on top of the tiered rate.
CREATE OR REPLACE FUNCTION public.resolve_dispute_atomic(
  _admin_id uuid, _dispute_id uuid, _contract_id uuid, _resolution_type text,
  _resolution_explanation text, _split_client integer DEFAULT 0, _split_freelancer integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _contract record; _total_held integer; _commission_rate numeric; _platform_fee integer;
  _expert_amount integer; _tiers jsonb; _promo jsonb; _dispute_status_out text;
  _referred_by uuid; _referral_expires timestamptz;
  i integer;
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

  SELECT value INTO _promo FROM platform_settings WHERE key = 'commission_promo';
  IF _promo IS NOT NULL AND (_promo->>'active')::boolean IS TRUE
     AND now() >= (_promo->>'starts_at')::timestamptz AND now() <= (_promo->>'ends_at')::timestamptz THEN
    _commission_rate := _commission_rate * (1 - (_promo->>'discount_percent')::numeric / 100.0);
  END IF;

  SELECT referred_by, referral_expires_at INTO _referred_by, _referral_expires
  FROM profiles WHERE id = _contract.client_id;
  IF _referred_by = _contract.freelancer_id AND (_referral_expires IS NULL OR _referral_expires > now()) THEN
    _commission_rate := _commission_rate * 0.5;
  END IF;

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
$$;
