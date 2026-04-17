
-- Tighten agent signup: users can only insert their own agent record
DROP POLICY "Anyone can insert agent on signup" ON public.agents;
CREATE POLICY "Users can insert own agent record" ON public.agents
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Activity log insert is intentionally open to all authenticated users
-- since every role needs to write audit entries. This is acceptable.
-- Tighten to require actor_id matches auth user
DROP POLICY "Authenticated can insert logs" ON public.activity_log;
CREATE POLICY "Users can insert own activity logs" ON public.activity_log
  FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());
