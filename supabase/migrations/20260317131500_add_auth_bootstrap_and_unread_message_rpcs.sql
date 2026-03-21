CREATE OR REPLACE FUNCTION public.get_auth_bootstrap_state(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller_id uuid := auth.uid();
  _is_admin boolean := false;
  _profile record;
BEGIN
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _caller_id
      AND role = 'admin'
  ) INTO _is_admin;

  IF _caller_id <> _user_id AND NOT _is_admin THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT
    p.id,
    p.full_name,
    p.username,
    p.avatar_url,
    p.role,
    COALESCE(p.is_verified, false) AS is_verified,
    p.created_at,
    p.updated_at,
    p.auth_code_dismissed_at
  INTO _profile
  FROM public.profiles p
  WHERE p.id = _user_id;

  RETURN jsonb_build_object(
    'user_id', _user_id,
    'profile_exists', _profile.id IS NOT NULL,
    'full_name', _profile.full_name,
    'username', _profile.username,
    'avatar_url', _profile.avatar_url,
    'role', _profile.role,
    'is_verified', COALESCE(_profile.is_verified, false),
    'created_at', _profile.created_at,
    'updated_at', _profile.updated_at,
    'auth_code_dismissed_at', _profile.auth_code_dismissed_at,
    'is_admin', _is_admin,
    'onboarding_complete', _is_admin OR (_profile.role IS NOT NULL AND _profile.username IS NOT NULL)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.count_unread_contract_messages(_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::integer
  FROM public.contract_messages cm
  JOIN public.contracts c ON c.id = cm.contract_id
  WHERE (_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    AND (c.client_id = _user_id OR c.freelancer_id = _user_id)
    AND cm.sender_id <> _user_id
    AND cm.is_read = false;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_bootstrap_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_unread_contract_messages(uuid) TO authenticated;
