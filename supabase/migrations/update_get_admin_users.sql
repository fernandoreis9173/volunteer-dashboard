
CREATE OR REPLACE FUNCTION get_admin_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ,
  name TEXT,
  role TEXT,
  avatar_url TEXT,
  status TEXT,
  confirmed_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  raw_user_meta_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id,
    au.email,
    au.phone,
    au.created_at,
    (au.raw_user_meta_data->>'name')::TEXT as name,
    (au.raw_user_meta_data->>'role')::TEXT as role,
    (au.raw_user_meta_data->>'avatar_url')::TEXT as avatar_url,
    (au.raw_user_meta_data->>'status')::TEXT as status,
    au.confirmed_at,
    au.last_sign_in_at,
    au.raw_user_meta_data
  FROM auth.users au
  WHERE (au.raw_user_meta_data->>'role') IN ('admin', 'leader', 'lider');
END;
$$;
