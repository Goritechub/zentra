-- Function to clear pending funds that have passed 48h
CREATE OR REPLACE FUNCTION public.clear_pending_funds()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

      UPDATE wallet_transactions SET clearance_at = NULL, balance_after = _new_balance WHERE id = _tx.id;

      _cleared_count := _cleared_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'cleared_count', _cleared_count);
END;
$$;
