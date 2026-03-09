
CREATE OR REPLACE FUNCTION public.admin_close_user_account(_admin_id uuid, _target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _wallet_balance integer;
  _escrow_balance integer;
  _active_contracts integer;
BEGIN
  -- Only super admins can close accounts
  IF NOT public.is_super_admin(_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Super Admins can close accounts');
  END IF;

  -- Prevent deleting own account
  IF _admin_id = _target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot close your own account');
  END IF;

  -- Prevent deleting other super admins
  IF public.is_super_admin(_target_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot close another Super Admin account');
  END IF;

  -- Check wallet balance
  SELECT COALESCE(balance, 0), COALESCE(escrow_balance, 0)
  INTO _wallet_balance, _escrow_balance
  FROM public.wallets WHERE user_id = _target_user_id;

  IF COALESCE(_wallet_balance, 0) > 0 OR COALESCE(_escrow_balance, 0) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User has funds in wallet',
      'code', 'has_funds',
      'wallet_balance', COALESCE(_wallet_balance, 0),
      'escrow_balance', COALESCE(_escrow_balance, 0)
    );
  END IF;

  -- Check active contracts
  SELECT COUNT(*) INTO _active_contracts
  FROM public.contracts
  WHERE (client_id = _target_user_id OR freelancer_id = _target_user_id)
    AND status IN ('active', 'pending_funding', 'in_review', 'draft', 'interviewing');

  IF _active_contracts > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User has active contracts',
      'code', 'has_active_contracts',
      'active_contracts', _active_contracts
    );
  END IF;

  -- All checks passed - delete user data (same order as delete_user_account)
  DELETE FROM public.wallet_transactions WHERE user_id = _target_user_id;
  DELETE FROM public.wallets WHERE user_id = _target_user_id;
  DELETE FROM public.notifications WHERE user_id = _target_user_id;
  DELETE FROM public.hidden_conversations WHERE user_id = _target_user_id;
  DELETE FROM public.saved_experts WHERE client_id = _target_user_id OR freelancer_id = _target_user_id;
  DELETE FROM public.contest_comment_likes WHERE user_id = _target_user_id;
  DELETE FROM public.comment_mentions WHERE mentioned_user_id = _target_user_id;
  DELETE FROM public.contest_follows WHERE user_id = _target_user_id;
  DELETE FROM public.contest_comments WHERE user_id = _target_user_id;
  DELETE FROM public.bank_details WHERE user_id = _target_user_id;
  DELETE FROM public.withdrawal_requests WHERE user_id = _target_user_id;
  DELETE FROM public.moderation_logs WHERE user_id = _target_user_id;
  DELETE FROM public.user_violation_counts WHERE user_id = _target_user_id;
  DELETE FROM public.certifications WHERE user_id = _target_user_id;
  DELETE FROM public.work_experience WHERE user_id = _target_user_id;
  DELETE FROM public.job_views WHERE viewer_id = _target_user_id;
  DELETE FROM public.admin_permissions WHERE user_id = _target_user_id;
  DELETE FROM public.admin_status WHERE user_id = _target_user_id;
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  DELETE FROM public.support_chat_messages WHERE sender_id = _target_user_id;
  DELETE FROM public.support_chats WHERE user_id = _target_user_id;
  DELETE FROM public.complaints WHERE user_id = _target_user_id;
  DELETE FROM public.kyc_verifications WHERE user_id = _target_user_id;
  DELETE FROM public.platform_reviews WHERE user_id = _target_user_id;

  -- Delete portfolio items (via freelancer_profiles)
  DELETE FROM public.portfolio_items WHERE freelancer_profile_id IN (
    SELECT id FROM public.freelancer_profiles WHERE user_id = _target_user_id
  );
  DELETE FROM public.service_offers WHERE freelancer_id = _target_user_id;
  DELETE FROM public.freelancer_profiles WHERE user_id = _target_user_id;

  -- Delete profile
  DELETE FROM public.profiles WHERE id = _target_user_id;

  -- Delete auth user
  DELETE FROM auth.users WHERE id = _target_user_id;

  -- Log the action
  INSERT INTO public.admin_activity_log (admin_id, action, target_type, target_id, details)
  VALUES (_admin_id, 'close_account', 'user', _target_user_id::text, jsonb_build_object('action', 'permanent_deletion'));

  RETURN jsonb_build_object('success', true);
END;
$$;
