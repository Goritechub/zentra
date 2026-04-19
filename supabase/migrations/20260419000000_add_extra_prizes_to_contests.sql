-- Add extra_prizes JSONB column for prize positions beyond 5th
ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS extra_prizes jsonb DEFAULT '[]'::jsonb;

-- Update launch_contest_atomic to include extra_prizes
CREATE OR REPLACE FUNCTION public.launch_contest_atomic(
  _user_id uuid, _title text, _description text, _category text,
  _prize_first integer, _prize_second integer DEFAULT 0, _prize_third integer DEFAULT 0,
  _prize_fourth integer DEFAULT 0, _prize_fifth integer DEFAULT 0,
  _deadline timestamptz DEFAULT NULL, _required_skills text[] DEFAULT '{}',
  _visibility text DEFAULT 'open', _rules text DEFAULT NULL,
  _banner_image text DEFAULT NULL, _winner_selection_method text DEFAULT 'client_selects',
  _extra_prizes jsonb DEFAULT '[]'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _total_pool integer; _wallet record; _contest_id uuid; _new_balance integer;
  _extra_total integer := 0; _i integer; _extra_len integer;
BEGIN
  -- Sum extra prizes
  _extra_len := jsonb_array_length(COALESCE(_extra_prizes, '[]'::jsonb));
  FOR _i IN 0.._extra_len - 1 LOOP
    _extra_total := _extra_total + COALESCE((_extra_prizes->_i)::integer, 0);
  END LOOP;

  _total_pool := COALESCE(_prize_first,0)+COALESCE(_prize_second,0)+COALESCE(_prize_third,0)+COALESCE(_prize_fourth,0)+COALESCE(_prize_fifth,0)+_extra_total;
  IF _total_pool <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Prize pool must be greater than zero'); END IF;

  SELECT * INTO _wallet FROM wallets WHERE user_id = _user_id FOR UPDATE;
  IF _wallet IS NULL OR _wallet.balance < _total_pool THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_funds',
      'wallet_balance', COALESCE(_wallet.balance, 0), 'total_prize_pool', _total_pool,
      'shortfall', _total_pool - COALESCE(_wallet.balance, 0));
  END IF;

  _new_balance := _wallet.balance - _total_pool;

  INSERT INTO contests (client_id, title, description, category, prize_first, prize_second, prize_third,
    prize_fourth, prize_fifth, extra_prizes, deadline, required_skills, visibility, rules, banner_image,
    winner_selection_method, status)
  VALUES (_user_id, _title, _description, _category, _prize_first, COALESCE(_prize_second,0),
    COALESCE(_prize_third,0), COALESCE(_prize_fourth,0), COALESCE(_prize_fifth,0),
    COALESCE(_extra_prizes, '[]'::jsonb),
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

-- Update publish_contest_winners_atomic to handle extra_prizes beyond 5th
CREATE OR REPLACE FUNCTION public.publish_contest_winners_atomic(
  _user_id uuid,
  _contest_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _contest record;
  _nom record;
  _prizes integer[];
  _pos_labels text[];
  _expected_count integer;
  _nom_count integer;
  _winner_wallet record;
  _new_balance integer;
  _i integer := 0;
  _prize integer;
  _total_paid integer := 0;
  _extra_len integer;
  _j integer;
BEGIN
  SELECT * INTO _contest FROM contests WHERE id = _contest_id FOR UPDATE;

  IF _contest IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contest not found');
  END IF;

  IF _contest.client_id != _user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the contest owner can publish winners');
  END IF;

  IF _contest.deadline > now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot publish winners before the deadline');
  END IF;

  IF _contest.status IN ('completed', 'ended') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contest already completed');
  END IF;

  -- Build prizes array (positions 1–5 + extra positions 6+)
  _prizes := ARRAY[
    _contest.prize_first,
    COALESCE(_contest.prize_second, 0),
    COALESCE(_contest.prize_third, 0),
    COALESCE(_contest.prize_fourth, 0),
    COALESCE(_contest.prize_fifth, 0)
  ];
  _pos_labels := ARRAY['1st','2nd','3rd','4th','5th'];

  _extra_len := jsonb_array_length(COALESCE(_contest.extra_prizes, '[]'::jsonb));
  FOR _j IN 0.._extra_len - 1 LOOP
    _prizes := array_append(_prizes, COALESCE((_contest.extra_prizes->_j)::integer, 0));
    _pos_labels := array_append(_pos_labels, (_j + 6)::text || CASE
      WHEN (_j + 6) % 100 IN (11,12,13) THEN 'th'
      WHEN (_j + 6) % 10 = 1 THEN 'st'
      WHEN (_j + 6) % 10 = 2 THEN 'nd'
      WHEN (_j + 6) % 10 = 3 THEN 'rd'
      ELSE 'th' END);
  END LOOP;

  _expected_count := 1;
  FOR _j IN 2..array_length(_prizes, 1) LOOP
    IF _prizes[_j] > 0 THEN _expected_count := _j; END IF;
  END LOOP;

  SELECT count(*) INTO _nom_count
  FROM contest_entries
  WHERE contest_id = _contest_id AND is_nominee = true;

  IF _nom_count != _expected_count THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Expected ' || _expected_count || ' nominees, got ' || _nom_count
    );
  END IF;

  PERFORM 1 FROM wallets WHERE user_id = _contest.client_id FOR UPDATE;

  FOR _nom IN
    SELECT * FROM contest_entries
    WHERE contest_id = _contest_id AND is_nominee = true
    ORDER BY created_at
    LIMIT _expected_count
  LOOP
    _i := _i + 1;
    _prize := _prizes[_i];
    IF _prize <= 0 THEN CONTINUE; END IF;

    UPDATE contest_entries
    SET is_winner = true, prize_position = _i, is_nominee = false
    WHERE id = _nom.id;

    SELECT * INTO _winner_wallet FROM wallets WHERE user_id = _nom.freelancer_id FOR UPDATE;
    IF _winner_wallet IS NOT NULL THEN
      _new_balance := _winner_wallet.balance + _prize;
      UPDATE wallets
      SET balance = _new_balance, total_earned = total_earned + _prize, updated_at = now()
      WHERE user_id = _nom.freelancer_id;
    ELSE
      _new_balance := _prize;
      INSERT INTO wallets (user_id, balance, total_earned)
      VALUES (_nom.freelancer_id, _prize, _prize);
    END IF;

    INSERT INTO wallet_transactions (user_id, amount, balance_after, type, description, reference)
    VALUES (
      _nom.freelancer_id, _prize, _new_balance, 'credit',
      'Contest prize (' || _pos_labels[_i] || ' place) - "' || _contest.title || '"',
      'contest_prize_' || _contest_id || '_' || _i
    );

    UPDATE wallets
    SET escrow_balance = GREATEST(0, escrow_balance - _prize), updated_at = now()
    WHERE user_id = _contest.client_id;

    _total_paid := _total_paid + _prize;

    INSERT INTO notifications (user_id, type, title, message, link_url)
    VALUES (
      _nom.freelancer_id,
      'contest_winner',
      'You won ' || _pos_labels[_i] || ' place!',
      'Congratulations! You won ' || _prize::text || ' in "' || _contest.title || '". The prize has been credited to your wallet.',
      '/contest/' || _contest_id::text
    );
  END LOOP;

  UPDATE contests SET status = 'completed', updated_at = now() WHERE id = _contest_id;

  RETURN jsonb_build_object('success', true, 'winners', _i, 'total_paid', _total_paid);
END;
$$;
