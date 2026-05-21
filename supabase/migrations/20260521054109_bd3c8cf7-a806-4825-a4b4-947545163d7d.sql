CREATE OR REPLACE FUNCTION public.claim_daily_card_cooldown(
  _user_id uuid,
  _claimed_at timestamp with time zone,
  _cooldown_cutoff timestamp with time zone
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated integer;
BEGIN
  UPDATE public.profiles
  SET last_daily_card_at = _claimed_at
  WHERE id = _user_id
    AND (
      last_daily_card_at IS NULL
      OR last_daily_card_at < _cooldown_cutoff
    );

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_daily_card_cooldown(uuid, timestamp with time zone, timestamp with time zone) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_daily_card_cooldown(uuid, timestamp with time zone, timestamp with time zone) FROM anon;
REVOKE ALL ON FUNCTION public.claim_daily_card_cooldown(uuid, timestamp with time zone, timestamp with time zone) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_card_cooldown(uuid, timestamp with time zone, timestamp with time zone) TO service_role;

NOTIFY pgrst, 'reload schema';
SELECT pg_notification_queue_usage();