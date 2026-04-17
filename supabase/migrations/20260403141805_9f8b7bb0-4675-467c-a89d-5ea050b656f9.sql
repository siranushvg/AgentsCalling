
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS connected_duration_seconds integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ringing_duration_seconds integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_payload jsonb;
