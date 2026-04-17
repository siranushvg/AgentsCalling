
-- Fix the recursive "Team leads can view team agents" policy on agents table
DROP POLICY IF EXISTS "Team leads can view team agents" ON public.agents;

CREATE POLICY "Team leads can view team agents"
ON public.agents
FOR SELECT
TO public
USING (
  has_role(auth.uid(), 'team_lead'::app_role)
  AND team_lead_id = public.get_agent_id_for_user(auth.uid())
);
