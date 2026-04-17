CREATE POLICY "Agents can update assigned leads"
ON public.leads
FOR UPDATE
TO public
USING (assigned_agent_id = get_agent_id_for_user(auth.uid()))
WITH CHECK (assigned_agent_id = get_agent_id_for_user(auth.uid()));