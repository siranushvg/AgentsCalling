
-- Create a SECURITY DEFINER function to get agent_id without triggering RLS on agents
CREATE OR REPLACE FUNCTION public.get_agent_id_for_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.agents WHERE user_id = _user_id LIMIT 1
$$;

-- Drop the problematic leads policy that causes recursion
DROP POLICY IF EXISTS "Agents can view assigned leads" ON public.leads;

-- Recreate using the security definer function
CREATE POLICY "Agents can view assigned leads"
ON public.leads
FOR SELECT
TO public
USING (
  assigned_agent_id = public.get_agent_id_for_user(auth.uid())
);

-- Also fix the "new unassigned leads" policy to be safe
DROP POLICY IF EXISTS "Agents can view new unassigned leads" ON public.leads;
CREATE POLICY "Agents can view new unassigned leads"
ON public.leads
FOR SELECT
TO public
USING (
  status = 'new'
  AND assigned_agent_id IS NULL
  AND has_role(auth.uid(), 'agent'::app_role)
);
