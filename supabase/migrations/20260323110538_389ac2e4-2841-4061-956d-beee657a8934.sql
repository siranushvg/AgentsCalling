
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS import_date date,
  ADD COLUMN IF NOT EXISTS import_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS import_batch_id uuid,
  ADD COLUMN IF NOT EXISTS imported_by_admin uuid;
