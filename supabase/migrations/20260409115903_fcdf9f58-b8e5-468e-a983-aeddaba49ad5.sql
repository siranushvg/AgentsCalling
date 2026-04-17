CREATE POLICY "Authenticated users can find admins"
ON public.user_roles
FOR SELECT
TO authenticated
USING (role = 'admin'::app_role);