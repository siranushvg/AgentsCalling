
-- Add normalized_phone column
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS normalized_phone text;

-- Backfill
UPDATE public.leads
SET normalized_phone = RIGHT(regexp_replace(phone_number, '[^0-9]', '', 'g'), 10);

ALTER TABLE public.leads ALTER COLUMN normalized_phone SET NOT NULL;
ALTER TABLE public.leads ALTER COLUMN normalized_phone SET DEFAULT '';

-- Normalize phone trigger function
CREATE OR REPLACE FUNCTION public.normalize_lead_phone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  digits text;
BEGIN
  NEW.normalized_phone := RIGHT(regexp_replace(NEW.phone_number, '[^0-9]', '', 'g'), 10);
  digits := regexp_replace(NEW.phone_number, '[^0-9]', '', 'g');
  IF length(digits) = 10 THEN
    NEW.phone_number := '91' || digits;
  ELSIF length(digits) = 12 AND digits LIKE '91%' THEN
    NEW.phone_number := digits;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_lead_phone
BEFORE INSERT OR UPDATE OF phone_number ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.normalize_lead_phone();

-- Unique index on active leads only
CREATE UNIQUE INDEX idx_leads_unique_active_phone
ON public.leads (normalized_phone)
WHERE suppressed = false AND status NOT IN ('expired', 'converted', 'not_interested');
