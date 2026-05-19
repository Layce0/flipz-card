
CREATE OR REPLACE FUNCTION public.get_global_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    is_admin BOOLEAN;
    result JSON;
BEGIN
    SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') INTO is_admin;
    IF NOT is_admin THEN RAISE EXCEPTION 'Acces refuse'; END IF;

    SELECT json_build_object(
          'total_players', (SELECT count(*) FROM public.profiles),
          'total_circulation', (SELECT count(*) FROM public.user_cards),
          'unique_cards_collected', (SELECT count(DISTINCT card_id) FROM public.user_cards),
          'total_available_cards', (SELECT count(*) FROM public.cards)
      ) INTO result;
      RETURN result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_global_stats() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_global_stats() TO authenticated;
