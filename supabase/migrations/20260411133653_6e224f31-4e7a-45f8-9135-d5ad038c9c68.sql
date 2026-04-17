
CREATE OR REPLACE FUNCTION public.get_referral_network(_agent_id uuid)
RETURNS TABLE(
  id uuid,
  full_name text,
  status text,
  tier text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Get the referral code of the target agent
  RETURN QUERY
  WITH target AS (
    SELECT a.referral_code FROM public.agents a WHERE a.id = _agent_id
  ),
  tier2 AS (
    SELECT a.id, a.full_name, a.status::text, 'tier2'::text AS tier, a.referral_code
    FROM public.agents a, target t
    WHERE a.referred_by = t.referral_code
  ),
  tier3 AS (
    SELECT a.id, a.full_name, a.status::text, 'tier3'::text AS tier, a.referral_code
    FROM public.agents a
    WHERE a.referred_by IN (SELECT t2.referral_code FROM tier2 t2)
  )
  SELECT t2.id, t2.full_name, t2.status, t2.tier FROM tier2 t2
  UNION ALL
  SELECT t3.id, t3.full_name, t3.status, t3.tier FROM tier3 t3;
END;
$$;
