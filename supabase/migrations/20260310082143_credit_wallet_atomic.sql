-- 8. ATOMIC WALLET CREDIT
CREATE OR REPLACE FUNCTION public.credit_wallet_atomic(
  _user_id uuid, _amount integer, _description text, _reference text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
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
$$;
