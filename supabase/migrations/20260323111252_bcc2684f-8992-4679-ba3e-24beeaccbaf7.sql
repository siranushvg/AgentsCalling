
-- Allow agents to also see unassigned new leads (from CSV imports)
CREATE POLICY "Agents can view new unassigned leads"
ON public.leads
FOR SELECT
TO public
USING (
  status = 'new'
  AND assigned_agent_id IS NULL
  AND has_role(auth.uid(), 'agent'::app_role)
);

-- Backfill existing leads: set import_date from created_at where missing
UPDATE public.leads
SET import_date = (created_at AT TIME ZONE 'UTC')::date,
    import_timestamp = created_at
WHERE import_date IS NULL;
