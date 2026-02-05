import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { MysteryCard } from '@/components/MysteryCard';
import { Package, Play, Loader2, X, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRandomCards, useCollectCard } from '@/hooks/useCards';
import { toast } from 'sonner';
import { GameCard } from '@/types/card';
import { cn } from '@/lib/utils';

const Packs = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [revealedCards, setRevealedCards] = useState<GameCard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isRevealing, setIsRevealing] = useState(false);
  const [cardRevealed, setCardRevealed] = useState(false);
  
  const getRandomCards = useRandomCards();
  const collectCard = useCollectCard();

  const handleWatchAd = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    setIsWatchingAd(true);
    
    // Simulate watching an ad (3 seconds)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    setIsWatchingAd(false);
    
    // Get 3 random cards
    try {
      const cards = await getRandomCards.mutateAsync({ count: 3 });
      setRevealedCards(cards);
      setCurrentCardIndex(0);
      setIsRevealing(true);
    } catch (error) {
      toast.error(t('packs.openError'));
    }
  };

  const handleRevealCard = async () => {
    if (!user || currentCardIndex >= revealedCards.length) return;
    
    // If card not yet revealed, reveal it and collect it
    if (!cardRevealed) {
      setCardRevealed(true);
      
      // Collect the card immediately when revealed
      const card = revealedCards[currentCardIndex];
      try {
        await collectCard.mutateAsync({ userId: user.id, cardId: card.id });
      } catch (error: any) {
        // Silently ignore duplicate collection errors
      }
      return;
    }
  };

  const handleNextCard = () => {
    if (currentCardIndex < revealedCards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setCardRevealed(false);
    } else {
      // All cards revealed
      toast.success(t('packs.cardsAdded', { count: revealedCards.length }));
      handleClose();
    }
  };

  const handleClose = () => {
    setRevealedCards([]);
    setCurrentCardIndex(0);
    setIsRevealing(false);
    setCardRevealed(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="pt-12 pb-6 px-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-xl text-foreground">{t('packs.title')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('packs.subtitle')}
            </p>
          </div>
        </div>
      </header>

      <main className="px-4 flex flex-col items-center">
        {!isRevealing ? (
          <>
            {/* Pack display */}
            <div className="relative mb-8">
              <div className="absolute -inset-8 bg-gradient-radial from-primary/20 via-transparent to-transparent blur-2xl" />
              <div className="relative w-64 h-80 rounded-2xl bg-gradient-to-br from-primary/30 via-card to-accent border-2 border-primary/40 card-shadow overflow-hidden flex flex-col items-center justify-center p-6">
                <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mb-4 pulse-glow">
                  <Package className="w-12 h-12 text-primary" />
                </div>
                <p className="font-display text-xl text-center text-primary mb-2">{t('packs.mystery')}</p>
                <p className="text-sm text-muted-foreground text-center">3 {t('packs.randomCards')}</p>
                <div className="shimmer absolute inset-0 pointer-events-none" />
              </div>
            </div>

            {/* Watch ad button */}
            <Button 
              variant="gold" 
              size="xl" 
              onClick={handleWatchAd}
              disabled={isWatchingAd}
              className="gap-2"
            >
              {isWatchingAd ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('packs.adInProgress')}
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  {user ? t('packs.watchAd') : t('nav.login')}
                </>
              )}
            </Button>

            {isWatchingAd && (
              <div className="mt-4 text-center">
                <div className="w-full max-w-xs bg-muted rounded-full h-2 mb-2">
                  <div className="bg-primary h-2 rounded-full animate-pulse" style={{ width: '100%' }} />
                </div>
                <p className="text-sm text-muted-foreground">{t('packs.pleaseWait')}</p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Card reveal */}
            <div className="relative mb-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="absolute -top-4 -right-4 z-20 bg-card/80"
              >
                <X className="w-5 h-5" />
              </Button>
              
              <div className="absolute -inset-8 bg-gradient-radial from-primary/20 via-transparent to-transparent blur-2xl" />
              
              {revealedCards[currentCardIndex] && (
                <MysteryCard
                  key={currentCardIndex}
                  card={revealedCards[currentCardIndex]}
                  isRevealed={cardRevealed}
                  onReveal={handleRevealCard}
                  size="lg"
                />
              )}
            </div>

            {/* Progress indicator */}
            <div className="flex gap-2 mb-4">
              {revealedCards.map((_, index) => (
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
              {t('packs.cardProgress', { current: currentCardIndex + 1, total: revealedCards.length })}
            </p>

            {/* Next button - appears after card is revealed */}
            {cardRevealed && (
              <Button 
                variant="gold" 
                size="lg"
                onClick={handleNextCard}
                className="mt-4 gap-2"
              >
                {currentCardIndex < revealedCards.length - 1 ? (
                  <>
                    {t('packs.nextCard')}
                    <ChevronRight className="w-5 h-5" />
                  </>
                ) : (
                  t('common.finish')
                )}
              </Button>
            )}
          </>
        )}
      </main>

      <Navigation />
    </div>
  );
};

export default Packs;
