
CREATE VIEW public.inbound_call_recordings
WITH (security_invoker = on) AS
SELECT
  c.id,
  c.lead_id,
  c.agent_id,
  c.caller_number,
  c.status,
  c.disposition,
  c.duration_seconds,
  c.recording_url,
  c.started_at,
  c.ended_at,
  c.notes,
  c.call_mode,
  COALESCE(l.username, '') AS lead_username,
  COALESCE(l.phone_number, '') AS lead_phone,
  COALESCE(a.full_name, 'Unknown') AS agent_name
FROM public.calls c
LEFT JOIN public.leads l ON l.id = c.lead_id
LEFT JOIN public.agents a ON a.id = c.agent_id
WHERE c.call_mode = 'inbound';
