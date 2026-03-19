import { useEffect, useState, useCallback } from 'react';
import { useUserCards } from '@/hooks/useCards';
import { useAuth } from '@/contexts/AuthContext';

const LAST_SEEN_KEY = 'collection_last_seen';

export const useNewCardIndicator = () => {
  const { user } = useAuth();
  const { data: userCards = [] } = useUserCards(user?.id);
  const [hasNewCards, setHasNewCards] = useState(false);
  const [newCardIds, setNewCardIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user || userCards.length === 0) {
      setHasNewCards(false);
      setNewCardIds(new Set());
      return;
    }

    const lastSeen = localStorage.getItem(`${LAST_SEEN_KEY}_${user.id}`);
    if (!lastSeen) {
      setHasNewCards(true);
      setNewCardIds(new Set(userCards.map(c => c.id)));
      return;
    }

    const newIds = new Set(
      userCards.filter(card => card.obtained_at > lastSeen).map(c => c.id)
    );
    setHasNewCards(newIds.size > 0);
    setNewCardIds(newIds);
  }, [user, userCards]);

  const markAsSeen = useCallback(() => {
    if (user) {
      localStorage.setItem(`${LAST_SEEN_KEY}_${user.id}`, new Date().toISOString());
      setHasNewCards(false);
      setNewCardIds(new Set());
    }
  }, [user]);

  return { hasNewCards, newCardIds, markAsSeen };
};
