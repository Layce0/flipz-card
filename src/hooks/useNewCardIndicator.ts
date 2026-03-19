import { useEffect, useState, useCallback } from 'react';
import { useUserCards } from '@/hooks/useCards';
import { useAuth } from '@/contexts/AuthContext';

const LAST_SEEN_KEY = 'collection_last_seen';

export const useNewCardIndicator = () => {
  const { user } = useAuth();
  const { data: userCards = [] } = useUserCards(user?.id);
  const [hasNewCards, setHasNewCards] = useState(false);

  useEffect(() => {
    if (!user || userCards.length === 0) {
      setHasNewCards(false);
      return;
    }

    const lastSeen = localStorage.getItem(`${LAST_SEEN_KEY}_${user.id}`);
    if (!lastSeen) {
      // Never visited collection — show indicator if they have cards
      setHasNewCards(true);
      return;
    }

    const lastSeenDate = new Date(lastSeen);
    const hasNewer = userCards.some(card => new Date(card.obtained_at) > lastSeenDate);
    setHasNewCards(hasNewer);
  }, [user, userCards]);

  const markAsSeen = useCallback(() => {
    if (user) {
      localStorage.setItem(`${LAST_SEEN_KEY}_${user.id}`, new Date().toISOString());
      setHasNewCards(false);
    }
  }, [user]);

  return { hasNewCards, markAsSeen };
};
