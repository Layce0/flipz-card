import { useState, useEffect } from 'react';
import { MysteryCard } from '@/components/MysteryCard';
import { PackOpeningAnimation } from '@/components/PackOpeningAnimation';
import { Button } from '@/components/ui/button';
import { X, ChevronRight, Sparkles } from 'lucide-react';
import { GameCard } from '@/types/card';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface PackRevealFlowProps {
  cards: GameCard[];
  isOpen: boolean;
  onClose: () => void;
}

export const PackRevealFlow = ({ cards, isOpen, onClose }: PackRevealFlowProps) => {
  const { t } = useTranslation();
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [cardRevealed, setCardRevealed] = useState(false);
  const [showPackAnimation, setShowPackAnimation] = useState(true);

  // Reset pack animation whenever the flow opens
  useEffect(() => {
    if (isOpen) {
      setShowPackAnimation(true);
      setCurrentCardIndex(0);
      setCardRevealed(false);
    }
  }, [isOpen]);

  if (!isOpen || cards.length === 0) return null;

  const handlePackAnimationComplete = () => {
    setShowPackAnimation(false);
  };

  const handleRevealCard = () => {
    if (!cardRevealed) {
      setCardRevealed(true);
    }
  };

  const handleNextCard = () => {
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setCardRevealed(false);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setCurrentCardIndex(0);
    setCardRevealed(false);
    setShowPackAnimation(true);
    onClose();
  };

  // Show pack opening animation first
  if (showPackAnimation) {
    return (
      <PackOpeningAnimation
        isOpen={true}
        onComplete={handlePackAnimationComplete}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center p-4"
      style={{ touchAction: 'none' }}
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

      {/* Card */}
      <div className="relative mb-6">
        <div className="absolute -inset-8 bg-gradient-radial from-primary/20 via-transparent to-transparent blur-2xl" />
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

      {/* Next button */}
      {cardRevealed && (
        <Button
          variant="gold"
          size="lg"
          onClick={handleNextCard}
          className="mt-4 gap-2"
        >
          {currentCardIndex < cards.length - 1 ? (
            <>
              {t('packs.nextCard', 'Suivant')}
              <ChevronRight className="w-5 h-5" />
            </>
          ) : (
            t('common.finish', 'Terminer')
          )}
        </Button>
      )}
    </div>
  );
};
