import { useState, useEffect, useRef, useCallback } from 'react';
import { MysteryCard } from '@/components/MysteryCard';
import { PackOpeningAnimation } from '@/components/PackOpeningAnimation';
import { Button } from '@/components/ui/button';
import { X, Sparkles, ChevronLeft } from 'lucide-react';
import { GameCard } from '@/types/card';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCards } from '@/hooks/useCards';

interface PackRevealFlowProps {
  cards: GameCard[];
  isOpen: boolean;
  onClose: () => void;
}

export const PackRevealFlow = ({ cards, isOpen, onClose }: PackRevealFlowProps) => {
  const { user } = useAuth();
  const { data: userCards = [] } = useUserCards(user?.id);
  const [ownedSnapshot, setOwnedSnapshot] = useState<Set<string>>(new Set());
  const { t } = useTranslation();
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [cardRevealed, setCardRevealed] = useState(false);
  const [showPackAnimation, setShowPackAnimation] = useState(true);
  const [slideDir, setSlideDir] = useState<{ x: number; y: number } | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isSwipingRef = useRef(false);
  const cardContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Snapshot owned cards before reveal starts
      setOwnedSnapshot(new Set(userCards.map(c => c.id)));
      setShowPackAnimation(true);
      setCurrentCardIndex(0);
      setCardRevealed(false);
      setSlideDir(null);
      setDragX(0);
      setDragY(0);
    }
  }, [isOpen]);

  const goNext = useCallback(() => {
    const dirX = dragX !== 0 ? dragX : 0;
    const dirY = dragY !== 0 ? dragY : 0;
    const mag = Math.sqrt(dirX * dirX + dirY * dirY);
    const normX = mag > 0 ? (dirX / mag) * 400 : -300;
    const normY = mag > 0 ? (dirY / mag) * 400 : 0;
    setSlideDir({ x: normX, y: normY });
    setTimeout(() => {
      if (currentCardIndex < cards.length - 1) {
        setCurrentCardIndex(prev => prev + 1);
        setCardRevealed(false);
      } else {
        handleClose();
      }
      setSlideDir(null);
      setDragX(0);
      setDragY(0);
    }, 250);
  }, [currentCardIndex, cards.length, dragX, dragY]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!cardRevealed) return;
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isSwipingRef.current = false;
    setIsDragging(true);
  }, [cardRevealed]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!cardRevealed || !isDragging) return;
    const dx = e.touches[0].clientX - startXRef.current;
    const dy = e.touches[0].clientY - startYRef.current;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (!isSwipingRef.current && dist > 10) {
      isSwipingRef.current = true;
    }
    if (isSwipingRef.current) {
      setDragX(dx);
      setDragY(dy);
    }
  }, [cardRevealed, isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    const dist = Math.sqrt(dragX * dragX + dragY * dragY);
    if (dist > 60) {
      goNext();
    } else {
      setDragX(0);
      setDragY(0);
    }
  }, [isDragging, dragX, dragY, goNext]);

  // Mouse fallback for desktop
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!cardRevealed) return;
    startXRef.current = e.clientX;
    isSwipingRef.current = false;
    setIsDragging(true);
  }, [cardRevealed]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!cardRevealed || !isDragging) return;
    const dx = e.clientX - startXRef.current;
    if (!isSwipingRef.current && Math.abs(dx) > 10) {
      isSwipingRef.current = true;
    }
    if (isSwipingRef.current) {
      setDragX(dx);
    }
  }, [cardRevealed, isDragging]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (Math.abs(dragX) > 60) {
      goNext();
    } else {
      setDragX(0);
      setDragY(0);
    }
  }, [isDragging, dragX, goNext]);

  if (!isOpen || cards.length === 0) return null;

  const handlePackAnimationComplete = () => {
    setShowPackAnimation(false);
  };

  const handleRevealCard = () => {
    if (!cardRevealed) {
      setCardRevealed(true);
    }
  };

  const handleClose = () => {
    setCurrentCardIndex(0);
    setCardRevealed(false);
    setShowPackAnimation(true);
    setSlideDir(null);
    setDragX(0);
    setDragY(0);
    onClose();
  };

  if (showPackAnimation) {
    return (
      <PackOpeningAnimation
        isOpen={true}
        onComplete={handlePackAnimationComplete}
      />
    );
  }

  const isLast = currentCardIndex >= cards.length - 1;

  return (
    <div
      className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center p-4 select-none"
      style={{ touchAction: 'pan-y' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleClose}
        className="absolute top-4 right-4 bg-card/80"
      >
        <X className="w-5 h-5" />
      </Button>

      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="w-5 h-5 text-primary" />
        <h2 className="font-display text-lg text-foreground">
          {t('packs.title', 'Pack')}
        </h2>
      </div>

      {/* Card with swipe */}
      <div
        ref={cardContainerRef}
        className="relative mb-6 cursor-grab active:cursor-grabbing"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        <div className="absolute -inset-8 bg-gradient-radial from-primary/20 via-transparent to-transparent blur-2xl" />
        <div
          style={{
            transform: slideDir
              ? `translate(${slideDir.x}px, ${slideDir.y}px) rotate(${slideDir.x * 0.05}deg)`
              : `translate(${dragX}px, ${dragY}px) rotate(${dragX * 0.05}deg)`,
            opacity: slideDir ? 0 : 1 - Math.min(Math.sqrt(dragX * dragX + dragY * dragY) / 300, 0.5),
            transition: isDragging ? 'none' : 'transform 0.25s ease-out, opacity 0.25s ease-out',
          }}
        >
          {cards[currentCardIndex] && (
            <MysteryCard
              key={currentCardIndex}
              card={cards[currentCardIndex]}
              isRevealed={cardRevealed}
              onReveal={handleRevealCard}
              size="lg"
            />
          )}
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex gap-2 mb-4">
        {cards.map((_, index) => (
          <div
            key={index}
            className={cn(
              "w-3 h-3 rounded-full transition-all",
              index < currentCardIndex
                ? "bg-primary"
                : index === currentCardIndex
                ? "bg-primary/50 animate-pulse"
                : "bg-muted"
            )}
          />
        ))}
      </div>

      <p className="text-muted-foreground text-sm">
        {t('packs.cardProgress', { current: currentCardIndex + 1, total: cards.length })}
      </p>

      {/* Swipe hint */}
      {cardRevealed && (
        <div className="mt-4 flex items-center gap-1 text-muted-foreground text-sm animate-fade-in">
          <ChevronLeft className="w-4 h-4 animate-[pulse_1.5s_ease-in-out_infinite]" />
          <span>{isLast ? t('common.finish', 'Terminer') : t('packs.swipeHint', 'Swipez pour continuer')}</span>
        </div>
      )}
    </div>
  );
};
