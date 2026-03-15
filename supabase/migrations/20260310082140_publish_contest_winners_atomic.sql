-- 5. ATOMIC CONTEST WINNER PAYOUT
CREATE OR REPLACE FUNCTION public.publish_contest_winners_atomic(
  _user_id uuid, _contest_id uuid, _is_auto_award boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _contest record; _nom record; _prizes integer[]; _pos_labels text[] := ARRAY['1st','2nd','3rd','4th','5th'];
  _expected_count integer; _nom_count integer; _winner_wallet record; _new_balance integer;
  _i integer := 0; _prize integer; _total_paid integer := 0;
BEGIN
  SELECT * INTO _contest FROM contests WHERE id = _contest_id FOR UPDATE;
  IF _contest IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Contest not found'); END IF;
  IF NOT _is_auto_award AND _contest.client_id != _user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the contest owner can publish winners');
  END IF;
  IF _contest.status IN ('completed', 'ended') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contest already completed');
  END IF;

  _prizes := ARRAY[_contest.prize_first, COALESCE(_contest.prize_second,0), COALESCE(_contest.prize_third,0),
    COALESCE(_contest.prize_fourth,0), COALESCE(_contest.prize_fifth,0)];
  _expected_count := 1;
  IF _prizes[2] > 0 THEN _expected_count := 2; END IF;
  IF _prizes[3] > 0 THEN _expected_count := 3; END IF;
  IF _prizes[4] > 0 THEN _expected_count := 4; END IF;
  IF _prizes[5] > 0 THEN _expected_count := 5; END IF;

  SELECT count(*) INTO _nom_count FROM contest_entries WHERE contest_id = _contest_id AND is_nominee = true;

  IF _is_auto_award THEN
    _expected_count := LEAST(_nom_count, _expected_count);
    IF _expected_count = 0 THEN RETURN jsonb_build_object('success', false, 'error', 'No nominees to auto-award'); END IF;
  ELSE
    IF _nom_count != _expected_count THEN
      RETURN jsonb_build_object('success', false, 'error', 'Expected ' || _expected_count || ' nominees, got ' || _nom_count);
    END IF;
  END IF;

  PERFORM 1 FROM wallets WHERE user_id = _contest.client_id FOR UPDATE;

  FOR _nom IN SELECT * FROM contest_entries WHERE contest_id = _contest_id AND is_nominee = true ORDER BY created_at LIMIT _expected_count
  LOOP
    _i := _i + 1;
    _prize := _prizes[_i];
    IF _prize <= 0 THEN CONTINUE; END IF;

    UPDATE contest_entries SET is_winner = true, prize_position = _i, is_nominee = false WHERE id = _nom.id;

    SELECT * INTO _winner_wallet FROM wallets WHERE user_id = _nom.freelancer_id FOR UPDATE;
    IF _winner_wallet IS NOT NULL THEN
      _new_balance := _winner_wallet.balance + _prize;
      UPDATE wallets SET balance = _new_balance, total_earned = total_earned + _prize, updated_at = now()
      WHERE user_id = _nom.freelancer_id;
    ELSE
      _new_balance := _prize;
      INSERT INTO wallets (user_id, balance, total_earned) VALUES (_nom.freelancer_id, _prize, _prize);
    END IF;

    INSERT INTO wallet_transactions (user_id, amount, balance_after, type, description, reference)
    VALUES (_nom.freelancer_id, _prize, _new_balance, 'credit',
      'Contest prize (' || _pos_labels[_i] || ' place) - "' || _contest.title || '"',
      'contest_prize_' || _contest_id || '_' || _i);

    UPDATE wallets SET escrow_balance = GREATEST(0, escrow_balance - _prize), updated_at = now()
    WHERE user_id = _contest.client_id;

    _total_paid := _total_paid + _prize;

    INSERT INTO notifications (user_id, type, title, message)
    VALUES (_nom.freelancer_id, 'contest_winner', 'You won ' || _pos_labels[_i] || ' place!',
      'Congratulations! You won ' || _prize::text || ' in "' || _contest.title || '". The prize has been credited to your wallet.');
  END LOOP;

  UPDATE contests SET status = 'completed', updated_at = now() WHERE id = _contest_id;

  RETURN jsonb_build_object('success', true, 'winners', _i, 'total_paid', _total_paid);
END;
$$;
