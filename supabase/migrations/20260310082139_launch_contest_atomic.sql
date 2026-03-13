-- 4. ATOMIC CONTEST LAUNCH
CREATE OR REPLACE FUNCTION public.launch_contest_atomic(
  _user_id uuid, _title text, _description text, _category text,
  _prize_first integer, _prize_second integer DEFAULT 0, _prize_third integer DEFAULT 0,
  _prize_fourth integer DEFAULT 0, _prize_fifth integer DEFAULT 0,
  _deadline timestamptz DEFAULT NULL, _required_skills text[] DEFAULT '{}',
  _visibility text DEFAULT 'open', _rules text DEFAULT NULL,
  _banner_image text DEFAULT NULL, _winner_selection_method text DEFAULT 'client_selects'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _total_pool integer; _wallet record; _contest_id uuid; _new_balance integer;
BEGIN
  _total_pool := COALESCE(_prize_first,0)+COALESCE(_prize_second,0)+COALESCE(_prize_third,0)+COALESCE(_prize_fourth,0)+COALESCE(_prize_fifth,0);
  IF _total_pool <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Prize pool must be greater than zero'); END IF;

  SELECT * INTO _wallet FROM wallets WHERE user_id = _user_id FOR UPDATE;
  IF _wallet IS NULL OR _wallet.balance < _total_pool THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_funds',
      'wallet_balance', COALESCE(_wallet.balance, 0), 'total_prize_pool', _total_pool,
      'shortfall', _total_pool - COALESCE(_wallet.balance, 0));
  END IF;

  _new_balance := _wallet.balance - _total_pool;

  INSERT INTO contests (client_id, title, description, category, prize_first, prize_second, prize_third,
    prize_fourth, prize_fifth, deadline, required_skills, visibility, rules, banner_image,
    winner_selection_method, status)
  VALUES (_user_id, _title, _description, _category, _prize_first, COALESCE(_prize_second,0),
    COALESCE(_prize_third,0), COALESCE(_prize_fourth,0), COALESCE(_prize_fifth,0),
    _deadline, _required_skills, _visibility, _rules, _banner_image, _winner_selection_method, 'active')
  RETURNING id INTO _contest_id;

  UPDATE wallets SET balance = _new_balance, escrow_balance = escrow_balance + _total_pool,
    total_spent = total_spent + _total_pool, updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO wallet_transactions (user_id, amount, balance_after, type, description, reference)
  VALUES (_user_id, _total_pool, _new_balance, 'debit',
    'Contest prize pool escrow - "' || _title || '"', 'contest_escrow_' || _contest_id);

  RETURN jsonb_build_object('success', true, 'contest_id', _contest_id);
END;
$$;
