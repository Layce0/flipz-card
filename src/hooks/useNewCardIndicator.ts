import { useEffect, useState, useCallback, useMemo } from 'react';
import { useUserCards } from '@/hooks/useCards';
import { useAuth } from '@/contexts/AuthContext';

const KNOWN_IDS_KEY = 'collection_known_ids';
const EMPTY_CARDS: { id: string }[] = [];

const areSetsEqual = (a: Set<string>, b: Set<string>) => {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
};

const loadKnown = (userId: string): Set<string> => {
  try {
    const raw = localStorage.getItem(`${KNOWN_IDS_KEY}_${userId}`);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
};

const saveKnown = (userId: string, ids: Set<string>) => {
  try {
    localStorage.setItem(`${KNOWN_IDS_KEY}_${userId}`, JSON.stringify([...ids]));
  } catch {
    /* noop */
  }
};

export const useNewCardIndicator = () => {
  const { user } = useAuth();
  const { data: userCards } = useUserCards(user?.id);
  const safeUserCards = userCards ?? EMPTY_CARDS;

  const currentIds = useMemo(
    () => new Set(safeUserCards.map((c) => c.id)),
    [safeUserCards]
  );

  const [newCardIds, setNewCardIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) {
      setNewCardIds((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }

    const known = loadKnown(user.id);

    // First visit ever: seed known set with current cards, no badge
    if (known.size === 0 && currentIds.size > 0 && !localStorage.getItem(`${KNOWN_IDS_KEY}_${user.id}`)) {
      saveKnown(user.id, currentIds);
      setNewCardIds((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }

    const fresh = new Set<string>();
    currentIds.forEach((id) => {
      if (!known.has(id)) fresh.add(id);
    });
    setNewCardIds((prev) => (areSetsEqual(prev, fresh) ? prev : fresh));
  }, [user?.id, currentIds]);

  const hasNewCards = newCardIds.size > 0;

  const markAsSeen = useCallback(() => {
    if (!user?.id) return;
    saveKnown(user.id, currentIds);
    setNewCardIds((prev) => (prev.size === 0 ? prev : new Set()));
  }, [user?.id, currentIds]);

  return { hasNewCards, newCardIds, markAsSeen };
};
