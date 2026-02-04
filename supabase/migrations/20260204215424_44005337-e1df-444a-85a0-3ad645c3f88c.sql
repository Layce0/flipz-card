-- Enable realtime for user_cards table to detect gift cards
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_cards;