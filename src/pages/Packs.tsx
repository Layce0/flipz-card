import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { MysteryCard } from '@/components/MysteryCard';
import { PackOpeningAnimation } from '@/components/PackOpeningAnimation';
import { Play, Loader2, X, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCollectCard } from '@/hooks/useCards';
import { useAdMob } from '@/hooks/useAdMob';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { GameCard } from '@/types/card';
import { cn } from '@/lib/utils';
import packBoosterImg from '@/assets/pack-booster.png';

const Packs = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { showInterstitial, isLoading: isAdLoading } = useAdMob();
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [revealedCards, setRevealedCards] = useState<GameCard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isRevealing, setIsRevealing] = useState(false);
  const [cardRevealed, setCardRevealed] = useState(false);
  const [showPackAnimation, setShowPackAnimation] = useState(false);

  const handleWatchAd = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    setIsWatchingAd(true);
    
    const adWatched = await showInterstitial();
    
    setIsWatchingAd(false);
    
    if (!adWatched) {
      toast.error(t('packs.adError', 'Impossible de charger la publicité'));
      return;
    }
    
    // Open pack via server-side RNG
    try {
      const { data, error } = await supabase.functions.invoke('open-free-pack');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      const cards = (data?.cards || []) as GameCard[];
      setRevealedCards(cards);
      setCurrentCardIndex(0);
      setShowPackAnimation(true);
    } catch (error) {
      toast.error(t('packs.openError'));
    }
  };

  const handleRevealCard = async () => {
    if (!user || currentCardIndex >= revealedCards.length) return;
    
    if (!cardRevealed) {
      setCardRevealed(true);
      // Cards already collected server-side, no need to collect again
      return;
    }
  };

  const handleNextCard = () => {
    if (currentCardIndex < revealedCards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setCardRevealed(false);
    } else {
      toast.success(t('packs.cardsAdded', { count: revealedCards.length }));
      handleClose();
    }
  };

  const handleClose = () => {
    setRevealedCards([]);
    setCurrentCardIndex(0);
    setIsRevealing(false);
    setCardRevealed(false);
    setShowPackAnimation(false);
  };

  const handlePackAnimationComplete = () => {
    setShowPackAnimation(false);
    setIsRevealing(true);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Pack Opening Animation */}
      <PackOpeningAnimation
        isOpen={showPackAnimation}
        onComplete={handlePackAnimationComplete}
      />

      {!isRevealing ? (
        <div className="flex-1 flex flex-col items-center justify-center relative">
          {/* Pack booster centered */}
          <img
            src={packBoosterImg}
            alt="Pack Flipz"
            className="relative z-[1] w-56 h-auto mix-blend-lighten drop-shadow-[0_0_30px_hsl(var(--primary)/0.5)]"
            draggable={false}
          />

          {/* Button overlay at bottom */}
          <div className="absolute bottom-24 left-0 right-0 flex flex-col items-center z-10">
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
          </div>
        </div>
      ) : (
          <div className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center p-4"
            style={{ touchAction: 'none' }}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="absolute top-4 right-4 z-20 bg-card/80"
            >
              <X className="w-5 h-5" />
            </Button>

            <div className="relative mb-6">
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
          </div>
        )}

      <Navigation />
    </div>
  );
};

export default Packs;
