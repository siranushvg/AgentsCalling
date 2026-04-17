
-- Add provider_call_id for stronger recording mapping
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS provider_call_id text;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_calls_provider_call_id ON public.calls (provider_call_id) WHERE provider_call_id IS NOT NULL;

-- Index for agent + time-based fallback matching
CREATE INDEX IF NOT EXISTS idx_calls_agent_started ON public.calls (agent_id, started_at DESC);
