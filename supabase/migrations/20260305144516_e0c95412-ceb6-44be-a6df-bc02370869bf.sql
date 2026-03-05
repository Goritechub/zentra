
-- Create a security definer function for account deletion
-- This function checks for blocking conditions and deletes user data
CREATE OR REPLACE FUNCTION public.delete_user_account(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _wallet_balance integer;
  _active_contracts integer;
  _active_jobs integer;
  _active_milestones integer;
BEGIN
  -- Authorization: only the user themselves
  IF auth.uid() IS NULL OR auth.uid() != _user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Check wallet balance
  SELECT COALESCE(balance, 0) + COALESCE(escrow_balance, 0) INTO _wallet_balance
  FROM public.wallets WHERE user_id = _user_id;
  
  IF COALESCE(_wallet_balance, 0) > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have a remaining wallet balance. Please withdraw or disburse all funds before deleting your account.');
  END IF;

  -- Check active contracts
  SELECT COUNT(*) INTO _active_contracts
  FROM public.contracts
  WHERE (client_id = _user_id OR freelancer_id = _user_id)
    AND status IN ('active', 'pending_funding', 'in_review', 'draft', 'interviewing');
  
  IF _active_contracts > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have active contracts. Please complete or cancel them before deleting your account.');
  END IF;

  -- Check active jobs (open or in_progress)
  SELECT COUNT(*) INTO _active_jobs
  FROM public.jobs
  WHERE client_id = _user_id AND status IN ('open', 'in_progress');
  
  IF _active_jobs > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have active job postings. Please close or cancel them before deleting your account.');
  END IF;

  -- Check unfunded/pending milestones
  SELECT COUNT(*) INTO _active_milestones
  FROM public.milestones m
  JOIN public.contracts c ON c.id = m.contract_id
  WHERE (c.client_id = _user_id OR c.freelancer_id = _user_id)
    AND m.status IN ('pending', 'funded', 'submitted');
  
  IF _active_milestones > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have pending milestones. Please resolve them before deleting your account.');
  END IF;

  -- All checks passed - delete user data
  -- Delete in order respecting foreign keys
  DELETE FROM public.wallet_transactions WHERE user_id = _user_id;
  DELETE FROM public.wallets WHERE user_id = _user_id;
  DELETE FROM public.notifications WHERE user_id = _user_id;
  DELETE FROM public.hidden_conversations WHERE user_id = _user_id;
  DELETE FROM public.saved_experts WHERE client_id = _user_id OR freelancer_id = _user_id;
  DELETE FROM public.contest_comment_likes WHERE user_id = _user_id;
  DELETE FROM public.comment_mentions WHERE mentioned_user_id = _user_id;
  DELETE FROM public.contest_follows WHERE user_id = _user_id;
  DELETE FROM public.contest_comments WHERE user_id = _user_id;
  DELETE FROM public.bank_details WHERE user_id = _user_id;
  DELETE FROM public.withdrawal_requests WHERE user_id = _user_id;
  DELETE FROM public.moderation_logs WHERE user_id = _user_id;
  DELETE FROM public.user_violation_counts WHERE user_id = _user_id;
  DELETE FROM public.certifications WHERE user_id = _user_id;
  DELETE FROM public.work_experience WHERE user_id = _user_id;
  DELETE FROM public.job_views WHERE viewer_id = _user_id;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  
  -- Delete portfolio items (via freelancer_profiles)
  DELETE FROM public.portfolio_items WHERE freelancer_profile_id IN (
    SELECT id FROM public.freelancer_profiles WHERE user_id = _user_id
  );
  DELETE FROM public.freelancer_profiles WHERE user_id = _user_id;
  DELETE FROM public.service_offers WHERE freelancer_id = _user_id;
  
  -- Delete profile (this cascades some FKs)
  DELETE FROM public.profiles WHERE id = _user_id;

  -- Delete auth user
  DELETE FROM auth.users WHERE id = _user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
