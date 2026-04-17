CREATE POLICY "Agents can update own sessions"
ON public.agent_sessions
FOR UPDATE
TO public
USING (agent_id = (SELECT agents.id FROM agents WHERE agents.user_id = auth.uid() LIMIT 1))
WITH CHECK (agent_id = (SELECT agents.id FROM agents WHERE agents.user_id = auth.uid() LIMIT 1));