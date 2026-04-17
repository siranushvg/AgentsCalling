-- Add import_batch_id to csv_imports to link file names to lead batches
ALTER TABLE public.csv_imports ADD COLUMN IF NOT EXISTS import_batch_id uuid;

-- Backfill: match csv_imports to leads by looking at the leads created around the same time
-- For each csv_import, find the import_batch_id used in leads imported by the same admin around that time
UPDATE public.csv_imports ci
SET import_batch_id = sub.batch_id
FROM (
  SELECT DISTINCT ON (l.import_batch_id) 
    l.import_batch_id as batch_id,
    l.imported_by_admin,
    l.import_timestamp
  FROM public.leads l
  WHERE l.import_batch_id IS NOT NULL
  ORDER BY l.import_batch_id, l.import_timestamp
) sub
WHERE ci.admin_user_id = sub.imported_by_admin
  AND ci.import_batch_id IS NULL
  AND ci.created_at BETWEEN (sub.import_timestamp - interval '5 minutes') AND (sub.import_timestamp + interval '5 minutes');