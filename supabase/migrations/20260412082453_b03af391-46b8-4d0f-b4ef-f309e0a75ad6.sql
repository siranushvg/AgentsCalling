-- Fix leads with 10-digit phone numbers: prefix with '91'
UPDATE public.leads
SET phone_number = '91' || phone_number
WHERE LENGTH(phone_number) = 10
  AND phone_number NOT LIKE '91%';

-- Fix leads with +91 prefix: remove the '+'
UPDATE public.leads
SET phone_number = SUBSTRING(phone_number FROM 2)
WHERE phone_number LIKE '+91%';

-- Fix leads with short phone numbers (< 10 digits): prefix with '91' if reasonable
UPDATE public.leads
SET phone_number = '91' || phone_number
WHERE LENGTH(phone_number) BETWEEN 8 AND 9;