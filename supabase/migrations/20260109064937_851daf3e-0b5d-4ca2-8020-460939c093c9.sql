-- Update the trigger function to add the second admin email
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Assign admin role if email matches
  IF NEW.email = 'layce.industry.v2@gmail.com' OR NEW.email = 'albanvigneau64@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- Also add admin role for the existing user if they exist
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'albanvigneau64@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;