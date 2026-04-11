import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePendingGifts, useMarkGiftSeen } from '@/hooks/usePendingGifts';
import { PackRevealFlow } from '@/components/shop/PackRevealFlow';
import { GameCard } from '@/types/card';

export const GiftRevealPopup = () => {
  const { user } = useAuth();
  const { data: pendingGifts = [] } = usePendingGifts(user?.id);
  const markSeen = useMarkGiftSeen();
  const [isRevealing, setIsRevealing] = useState(false);
  const [revealCards, setRevealCards] = useState<GameCard[]>([]);
  const [currentGiftIds, setCurrentGiftIds] = useState<string[]>([]);

  useEffect(() => {
    if (pendingGifts.length > 0 && !isRevealing && currentGiftIds.length === 0) {
      const cards = pendingGifts.map(g => g.card);
      const ids = pendingGifts.map(g => g.id);
      setRevealCards(cards);
      setCurrentGiftIds(ids);
      setIsRevealing(true);
    }
  }, [pendingGifts, isRevealing, currentGiftIds.length]);

  const handleClose = () => {
    if (currentGiftIds.length > 0) {
      markSeen.mutate(currentGiftIds);
    }
    setIsRevealing(false);
    setRevealCards([]);
    setCurrentGiftIds([]);
  };

  return (
    <PackRevealFlow
      cards={revealCards}
      isOpen={isRevealing}
      onClose={handleClose}
      packType="free"
    />
  );
};
