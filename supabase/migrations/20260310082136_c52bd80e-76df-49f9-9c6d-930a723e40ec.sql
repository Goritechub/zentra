-- 1. ATOMIC MILESTONE FUNDING
CREATE OR REPLACE FUNCTION public.fund_milestone_atomic(
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
$$;
