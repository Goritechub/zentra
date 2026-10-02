-- Per-attempt ledger for platform-revenue withdrawals, replacing the bare
-- platform_settings.total_revenue_withdrawn aggregate counter. Mirrors the
-- withdrawal_requests pattern: a row per attempt with a guarded status
-- transition, so reservation/completion/reversal are each idempotent and a
-- concurrent or retried call can't double-reserve or double-reverse.

CREATE TABLE IF NOT EXISTS public.platform_revenue_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  amount integer NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  provider text NOT NULL DEFAULT 'paystack',
  provider_reference text,
  transfer_code text,
  last_error text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_revenue_withdrawals_status
  ON public.platform_revenue_withdrawals (status);

ALTER TABLE public.platform_revenue_withdrawals ENABLE ROW LEVEL SECURITY;
-- No policies: same convention as the other financial tables (see the
-- "LOCK DOWN FINANCIAL TABLES" migration) — all writes go through the
-- service-role client or the SECURITY DEFINER RPCs below, never direct
-- anon/authenticated access.

-- Reserve an attempt: serializes concurrent reservations with an advisory
-- lock (there's no natural row to lock for an aggregate availability check),
-- and recomputes availability as (total revenue) - (legacy
-- platform_settings.total_revenue_withdrawn, read live) - (this ledger's own
-- pending/completed sum).
--
-- The legacy counter is read live on every call rather than carried over as
-- a one-time snapshot at migration time deliberately: a DB migration and the
-- backend/Edge Function deploy that stops writing to platform_settings can't
-- land atomically. If old code is still processing a withdrawal through the
-- pre-ledger path in that window, reading the counter fresh here picks up
-- that write immediately instead of silently under-counting it (and thus
-- overstating availability) the way a frozen snapshot would. Once the old
-- code path is fully retired, the counter simply stops changing and this
-- still computes the right total.
CREATE OR REPLACE FUNCTION public.reserve_platform_revenue_withdrawal_atomic(
  _admin_id uuid, _amount integer, _provider text DEFAULT 'paystack'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _total_revenue integer;
  _legacy_withdrawn integer;
  _total_reserved integer;
  _available integer;
  _id uuid;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  -- Released automatically at transaction end; serializes against concurrent
  -- reservations without needing a settings row to lock.
  PERFORM pg_advisory_xact_lock(hashtext('platform_revenue_withdrawal'));

  SELECT COALESCE(SUM(commission_amount), 0) INTO _total_revenue FROM public.platform_revenue;
  SELECT COALESCE((value::text)::integer, 0) INTO _legacy_withdrawn
    FROM public.platform_settings WHERE key = 'total_revenue_withdrawn';
  SELECT COALESCE(SUM(amount), 0) INTO _total_reserved
    FROM public.platform_revenue_withdrawals WHERE status IN ('pending', 'completed');
  _available := _total_revenue - COALESCE(_legacy_withdrawn, 0) - _total_reserved;

  IF _amount > _available THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient revenue. Available: ' || _available);
  END IF;

  INSERT INTO public.platform_revenue_withdrawals (admin_id, amount, status, provider)
  VALUES (_admin_id, _amount, 'pending', _provider)
  RETURNING id INTO _id;

  RETURN jsonb_build_object('success', true, 'withdrawal_id', _id, 'available_after', _available - _amount);
END;
$$;

-- Confirm a specific attempt succeeded. Idempotent: a retried call on an
-- already-finalized row is a safe no-op rather than double-completing.
CREATE OR REPLACE FUNCTION public.complete_platform_revenue_withdrawal_atomic(
  _admin_id uuid, _withdrawal_id uuid, _transfer_code text, _provider_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _row record;
BEGIN
  SELECT * INTO _row FROM public.platform_revenue_withdrawals
    WHERE id = _withdrawal_id AND admin_id = _admin_id FOR UPDATE;
  IF _row IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found');
  END IF;
  IF _row.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal already finalized');
  END IF;

  UPDATE public.platform_revenue_withdrawals
    SET status = 'completed', transfer_code = _transfer_code,
        provider_reference = COALESCE(_provider_reference, provider_reference), updated_at = now()
    WHERE id = _withdrawal_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Reverse a specific attempt on a confirmed provider failure. Guarded on
-- status = 'pending' so a duplicate/retried reversal call (or one racing a
-- completion) is a safe no-op instead of double-reversing.
CREATE OR REPLACE FUNCTION public.reverse_platform_revenue_withdrawal_atomic(
  _admin_id uuid, _withdrawal_id uuid, _reason text DEFAULT 'Transfer failed'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _row record;
BEGIN
  SELECT * INTO _row FROM public.platform_revenue_withdrawals
    WHERE id = _withdrawal_id AND admin_id = _admin_id FOR UPDATE;
  IF _row IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found');
  END IF;
  IF _row.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal already finalized');
  END IF;

  UPDATE public.platform_revenue_withdrawals
    SET status = 'failed', reason = _reason, updated_at = now()
    WHERE id = _withdrawal_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Record an ambiguous provider outcome (timeout/network error) without
-- changing status: the row stays 'pending' so the reserved amount keeps
-- counting against availability until reconciled, instead of being
-- auto-reversed on a failure that may not have actually happened.
CREATE OR REPLACE FUNCTION public.flag_platform_revenue_withdrawal_ambiguous_atomic(
  _admin_id uuid, _withdrawal_id uuid, _note text, _provider_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _row record;
BEGIN
  SELECT * INTO _row FROM public.platform_revenue_withdrawals
    WHERE id = _withdrawal_id AND admin_id = _admin_id FOR UPDATE;
  IF _row IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found');
  END IF;
  IF _row.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal already finalized');
  END IF;

  UPDATE public.platform_revenue_withdrawals
    SET last_error = _note,
        provider_reference = COALESCE(_provider_reference, provider_reference), updated_at = now()
    WHERE id = _withdrawal_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_platform_revenue_withdrawal_atomic(uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_platform_revenue_withdrawal_atomic(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reverse_platform_revenue_withdrawal_atomic(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.flag_platform_revenue_withdrawal_ambiguous_atomic(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_platform_revenue_withdrawal_atomic(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_platform_revenue_withdrawal_atomic(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reverse_platform_revenue_withdrawal_atomic(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.flag_platform_revenue_withdrawal_ambiguous_atomic(uuid, uuid, text, text) TO service_role;
