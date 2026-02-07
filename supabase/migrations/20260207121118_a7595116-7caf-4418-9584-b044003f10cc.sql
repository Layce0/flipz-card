-- Remove the admin policy that allows broad access to profile emails
-- This prevents potential email harvesting by authenticated users with admin role
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;