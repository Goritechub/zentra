-- Atomic Stripe Connect payout debit: row-locks the wallet so the balance
-- check, balance debit, withdrawal_requests insert, and wallet_transactions
-- ledger insert happen in one transaction (previously three separate,
-- non-transactional calls in stripe.service.ts#payoutToConnectedAccount,
-- vulnerable to two concurrent payouts both passing the balance check).
-- Failure rollback reuses the existing reverse_withdrawal_atomic RPC, which
-- is already generic over withdrawal_requests/wallet_transactions/wallets.

CREATE OR REPLACE FUNCTION public.debit_wallet_for_stripe_payout_atomic(
  _user_id uuid, _amount_ngn integer, _amount_usd numeric,
  _stripe_connected_account_id uuid, _description text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _wallet record; _new_balance integer; _withdrawal_id uuid; _ref text;
BEGIN
  IF _amount_ngn <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid amount'); END IF;

  SELECT * INTO _wallet FROM wallets WHERE user_id = _user_id FOR UPDATE;
  IF _wallet IS NULL OR _wallet.balance < _amount_ngn THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  _new_balance := _wallet.balance - _amount_ngn;

  INSERT INTO withdrawal_requests (user_id, amount, stripe_connected_account_id, payout_provider, status)
  VALUES (_user_id, _amount_ngn, _stripe_connected_account_id, 'stripe', 'pending')
  RETURNING id INTO _withdrawal_id;

  _ref := 'stripe_payout_' || _withdrawal_id::text;

  UPDATE wallets SET balance = _new_balance, updated_at = now() WHERE user_id = _user_id;

  INSERT INTO wallet_transactions (
    user_id, type, amount, balance_after, description, reference, status,
    payment_provider, original_amount, original_currency
  )
  VALUES (
    _user_id, 'withdrawal', _amount_ngn, _new_balance, _description, _ref, 'pending',
    'stripe', _amount_usd, 'USD'
  );

  RETURN jsonb_build_object(
    'success', true, 'new_balance', _new_balance, 'withdrawal_id', _withdrawal_id, 'reference', _ref
  );
END;
$$;

-- Granted here, not deferred to the later lockdown migration: each migration
-- file commits as its own transaction, so leaving this until
-- 20261002120000 would leave a real window -- between this file's commit and
-- that one's -- where the function sits at Postgres's default PUBLIC/anon/
-- authenticated execute grant while the API is live.
REVOKE ALL ON FUNCTION public.debit_wallet_for_stripe_payout_atomic(uuid, integer, numeric, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.debit_wallet_for_stripe_payout_atomic(uuid, integer, numeric, uuid, text) TO service_role;
