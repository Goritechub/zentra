
-- Update withdraw_wallet_atomic to check per-user withdrawal freeze
CREATE OR REPLACE FUNCTION public.withdraw_wallet_atomic(
  _user_id uuid,
  _amount integer,
  _bank_detail_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wallet record; _bank record; _new_balance integer; _withdrawal_id uuid; _ref text;
  _frozen boolean;
  _user_frozen boolean;
BEGIN
  IF _amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid amount'); END IF;
  IF _amount < 5000 THEN RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal amount is ₦5,000.'); END IF;

  -- Check if withdrawals are frozen platform-wide
  SELECT (value::text)::boolean INTO _frozen FROM platform_settings WHERE key = 'withdrawals_frozen';
  IF _frozen IS TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawals are temporarily frozen by the platform.');
  END IF;

  -- Check if this specific user withdrawal is frozen
  SELECT EXISTS(
    SELECT 1 FROM platform_settings 
    WHERE key = 'withdrawal_frozen_users' 
    AND value ? _user_id::text
  ) INTO _user_frozen;
  IF _user_frozen IS TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Your withdrawals have been temporarily restricted. Please contact support.');
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
$$;
