
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS voicelay_agent_id text,
  ADD COLUMN IF NOT EXISTS voicelay_sso_token text,
  ADD COLUMN IF NOT EXISTS voicelay_contact_number text,
  ADD COLUMN IF NOT EXISTS voicelay_extension integer,
  ADD COLUMN IF NOT EXISTS voicelay_virtual_number text,
  ADD COLUMN IF NOT EXISTS voicelay_username text;
