
CREATE OR REPLACE FUNCTION public.get_funding_status(
  _client_id uuid,
  _budget_min integer DEFAULT NULL,
  _budget_max integer DEFAULT NULL,
  _contract_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wallet_balance integer;
  _escrow_held integer;
BEGIN
  SELECT COALESCE(balance, 0) INTO _wallet_balance
  FROM public.wallets WHERE user_id = _client_id;

  IF _contract_id IS NOT NULL THEN
    SELECT COALESCE(SUM(held_amount), 0) INTO _escrow_held
    FROM public.escrow_ledger
    WHERE contract_id = _contract_id AND status = 'held';
  ELSE
    _escrow_held := 0;
  END IF;

  RETURN jsonb_build_object(
    'wallet_balance', COALESCE(_wallet_balance, 0),
    'escrow_held', COALESCE(_escrow_held, 0)
  );
END;
$$;
