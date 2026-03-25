import { useEffect, useState, useCallback } from 'react';
import { useUserCards } from '@/hooks/useCards';
import { useAuth } from '@/contexts/AuthContext';

const LAST_SEEN_KEY = 'collection_last_seen';
const EMPTY_CARDS: { id: string; obtained_at: string }[] = [];

const areSetsEqual = (a: Set<string>, b: Set<string>) => {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
};

export const useNewCardIndicator = () => {
  const { user } = useAuth();
  const { data: userCards } = useUserCards(user?.id);
  const safeUserCards = userCards ?? EMPTY_CARDS;
  const [hasNewCards, setHasNewCards] = useState(false);
  const [newCardIds, setNewCardIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id || safeUserCards.length === 0) {
      setHasNewCards(false);
      setNewCardIds(prev => (prev.size === 0 ? prev : new Set()));
      return;
    }

    const lastSeen = localStorage.getItem(`${LAST_SEEN_KEY}_${user.id}`);
    if (!lastSeen) {
      const allIds = new Set(safeUserCards.map(c => c.id));
      setHasNewCards(allIds.size > 0);
      setNewCardIds(prev => (areSetsEqual(prev, allIds) ? prev : allIds));
      return;
    }

    const newIds = new Set(
      safeUserCards.filter(card => card.obtained_at > lastSeen).map(c => c.id)
    );
    setHasNewCards(newIds.size > 0);
    setNewCardIds(prev => (areSetsEqual(prev, newIds) ? prev : newIds));
  }, [user?.id, safeUserCards]);

  const markAsSeen = useCallback(() => {
    if (user?.id) {
      localStorage.setItem(`${LAST_SEEN_KEY}_${user.id}`, new Date().toISOString());
      setHasNewCards(false);
      setNewCardIds(prev => (prev.size === 0 ? prev : new Set()));
    }
  }, [user?.id]);

  return { hasNewCards, newCardIds, markAsSeen };
};
