-- 3. ATOMIC DISPUTE RESOLUTION
CREATE OR REPLACE FUNCTION public.resolve_dispute_atomic(
  _admin_id uuid, _dispute_id uuid, _contract_id uuid, _resolution_type text,
  _resolution_explanation text, _split_client integer DEFAULT 0, _split_freelancer integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _contract record; _total_held integer; _commission_rate numeric; _platform_fee integer;
  _expert_amount integer; _tiers jsonb; _dispute_status_out text;
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
