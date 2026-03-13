-- 7. ATOMIC WITHDRAWAL REVERSAL
CREATE OR REPLACE FUNCTION public.reverse_withdrawal_atomic(
  _user_id uuid, _withdrawal_id uuid, _reference text, _reason text DEFAULT 'Transfer failed'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
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
$$;
