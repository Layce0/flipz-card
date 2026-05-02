CREATE OR REPLACE FUNCTION public.get_global_stats()
RETURNS TABLE (
  total_players bigint,
  total_cards_in_circulation bigint,
  total_unique_owned_cards bigint,
  total_cards_in_game bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
       OR public.has_role(auth.uid(), 'moderator'::app_role)) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.profiles)::bigint                AS total_players,
    (SELECT COUNT(*) FROM public.user_cards)::bigint              AS total_cards_in_circulation,
    (SELECT COUNT(DISTINCT card_id) FROM public.user_cards)::bigint AS total_unique_owned_cards,
    (SELECT COUNT(*) FROM public.cards)::bigint                   AS total_cards_in_game;
END;
$$;

REVOKE ALL ON FUNCTION public.get_global_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_global_stats() TO authenticated;