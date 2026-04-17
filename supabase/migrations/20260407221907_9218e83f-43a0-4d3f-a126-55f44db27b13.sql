ALTER TABLE public.agent_onboarding 
ADD COLUMN offer_letter_confirmed boolean NOT NULL DEFAULT false,
ADD COLUMN offer_letter_confirmed_at timestamp with time zone;