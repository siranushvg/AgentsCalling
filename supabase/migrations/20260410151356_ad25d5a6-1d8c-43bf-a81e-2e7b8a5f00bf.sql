
-- Fix: when WITH CHECK is missing, Postgres uses USING for both old and new row checks.
-- The old row check should allow draft/rejected, but the new row check must also allow 'submitted'.
DROP POLICY "Agents can update own onboarding" ON public.agent_onboarding;

CREATE POLICY "Agents can update own onboarding"
ON public.agent_onboarding
FOR UPDATE
TO authenticated
USING (
  agent_id = get_agent_id_for_user(auth.uid())
  AND onboarding_status IN ('draft', 'rejected')
)
WITH CHECK (
  agent_id = get_agent_id_for_user(auth.uid())
  AND onboarding_status IN ('draft', 'rejected', 'submitted')
);
