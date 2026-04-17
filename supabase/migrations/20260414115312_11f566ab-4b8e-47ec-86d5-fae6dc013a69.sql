
-- Allow calls without a matched lead (unknown callers)
ALTER TABLE public.calls ALTER COLUMN lead_id DROP NOT NULL;

-- Add caller_number to store raw inbound caller number
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS caller_number text;
