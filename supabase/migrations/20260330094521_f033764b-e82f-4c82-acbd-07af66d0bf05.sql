
-- Add last_activity_at and last_logout_reason to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS last_activity_at timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_logout_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS session_status text DEFAULT 'active';

-- Create a security definer function to update last activity (avoids RLS issues)
CREATE OR REPLACE FUNCTION public.update_last_activity(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET last_activity_at = now(), session_status = 'active', updated_at = now()
  WHERE id = _user_id;
END;
$$;

-- Create a function to mark session as timed out
CREATE OR REPLACE FUNCTION public.mark_session_timeout(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET last_logout_reason = 'inactivity_timeout', session_status = 'inactive', updated_at = now()
  WHERE id = _user_id;
  
  -- Log the inactivity timeout event
  INSERT INTO public.activity_log (actor_id, actor_role, action, target_type, target_id, details)
  SELECT _user_id, ur.role, 'inactivity_logout', 'user', _user_id::text, 'Auto-logged out after 15 minutes of inactivity'
  FROM public.user_roles ur WHERE ur.user_id = _user_id LIMIT 1;
END;
$$;

-- Function to check if a session is still valid (not timed out server-side)
CREATE OR REPLACE FUNCTION public.check_session_valid(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT last_activity_at > now() - interval '15 minutes' 
     FROM public.profiles WHERE id = _user_id),
    false
  )
$$;
