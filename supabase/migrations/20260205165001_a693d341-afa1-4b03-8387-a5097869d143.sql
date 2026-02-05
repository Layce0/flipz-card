-- Drop the overly permissive policy that allows all authenticated users to view all profiles
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

-- The restrictive policies already exist:
-- "Users can view their own profile" - allows users to see only their own profile
-- "Admins can view all profiles" - allows admins to see all profiles for admin panel