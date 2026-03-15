import { useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { MysteryCard } from '@/components/MysteryCard';
import { PackOpeningAnimation } from '@/components/PackOpeningAnimation';
import { Play, Loader2, X, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCards } from '@/hooks/useCards';
import { useAdMob } from '@/hooks/useAdMob';
import { toast } from 'sonner';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { GameCard } from '@/types/card';
import { cn } from '@/lib/utils';
import packBoosterImg from '@/assets/pack-booster.png';

const Packs = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { showInterstitial, isLoading: isAdLoading, showFakeAd, fakeAdCountdown, dismissFakeAd } = useAdMob();
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [revealedCards, setRevealedCards] = useState<GameCard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isRevealing, setIsRevealing] = useState(false);
  const [cardRevealed, setCardRevealed] = useState(false);
  const [showPackAnimation, setShowPackAnimation] = useState(false);
  const { data: userCards = [] } = useUserCards(user?.id);
  const [ownedSnapshot, setOwnedSnapshot] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const currentCardIsNew = useMemo(() => {
    const cardId = revealedCards[currentCardIndex]?.id;
    if (!cardId || ownedSnapshot.has(cardId)) return false;
    return !revealedCards.slice(0, currentCardIndex).some(c => c.id === cardId);
  }, [revealedCards, currentCardIndex, ownedSnapshot]);

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
      const { data, error } = await invokeEdgeFunction('open-free-pack');
      if (error) {
        console.error('Edge function invoke error:', error);
        toast.error(`Edge error: ${error.message || JSON.stringify(error)}`);
        return;
      }
      if (data?.error) {
        console.error('Edge function returned error:', data);
        toast.error(`Server: ${data.error}${data.detail ? ' — ' + data.detail : ''}${data.retryAfter ? ' (retry ' + data.retryAfter + 's)' : ''}`);
        return;
      }
      
      const cards = (data?.cards || []) as GameCard[];
      const ownedIds = userCards
        .filter(c => c.count > 0)
        .map(c => c.id);
      setOwnedSnapshot(new Set(ownedIds));
      setRevealedCards(cards);
      setCurrentCardIndex(0);
      setShowPackAnimation(true);

      queryClient.invalidateQueries({ queryKey: ['user-cards'] });
      queryClient.invalidateQueries({ queryKey: ['user-card-stats'] });
    } catch (error: any) {
      console.error('Pack opening catch:', error);
      toast.error(`Catch: ${error?.message || JSON.stringify(error)}`);
    }
  };

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isSwipingRef = useRef(false);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [slideDir, setSlideDir] = useState<{ x: number; y: number } | null>(null);

  const handleRevealCard = async () => {
    if (!user || currentCardIndex >= revealedCards.length) return;
    if (!cardRevealed) {
      setCardRevealed(true);
    }
  };

  const goNext = useCallback(() => {
    const dirX = dragX !== 0 ? dragX : 0;
    const dirY = dragY !== 0 ? dragY : 0;
    const mag = Math.sqrt(dirX * dirX + dirY * dirY);
    const normX = mag > 0 ? (dirX / mag) * 400 : -300;
    const normY = mag > 0 ? (dirY / mag) * 400 : 0;
    setSlideDir({ x: normX, y: normY });
    setTimeout(() => {
      if (currentCardIndex < revealedCards.length - 1) {
        setCurrentCardIndex(prev => prev + 1);
        setCardRevealed(false);
      } else {
        toast.success(t('packs.cardsAdded', { count: revealedCards.length }));
        handleClose();
      }
      setSlideDir(null);
      setDragX(0);
      setDragY(0);
    }, 250);
  }, [currentCardIndex, revealedCards.length, dragX, dragY, t, queryClient]);

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

  const handleClose = () => {
    setRevealedCards([]);
    setCurrentCardIndex(0);
    setIsRevealing(false);
    setCardRevealed(false);
    setShowPackAnimation(false);
    setSlideDir(null);
    setDragX(0);
    setDragY(0);
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
      {/* Fake Ad Overlay for Web Testing */}
      {showFakeAd && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {fakeAdCountdown <= 0 ? (
              <Button variant="ghost" size="icon" onClick={dismissFakeAd} className="text-white border border-white/30">
                <X className="w-5 h-5" />
              </Button>
            ) : (
              <span className="text-white/60 text-sm font-mono bg-white/10 rounded-full w-8 h-8 flex items-center justify-center">
                {fakeAdCountdown}
              </span>
            )}
          </div>
          <div className="border-2 border-dashed border-white/20 rounded-2xl p-12 flex flex-col items-center gap-4 max-w-sm mx-4">
            <Play className="w-16 h-16 text-primary" />
            <p className="text-white text-xl font-display text-center">Publicité simulée</p>
            <p className="text-white/50 text-sm text-center">Cette pub n'apparaît que sur le web.<br/>Sur mobile natif, une vraie pub AdMob s'affichera.</p>
            <div className="w-full bg-white/10 rounded-full h-2 mt-4">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-1000 ease-linear" 
                style={{ width: `${((5 - fakeAdCountdown) / 5) * 100}%` }} 
              />
            </div>
          </div>
        </div>
      )}

      {/* Pack Opening Animation */}
      <PackOpeningAnimation
        isOpen={showPackAnimation}
        onComplete={handlePackAnimationComplete}
      />

      {!isRevealing ? (
        <div className="flex-1 flex flex-col items-center justify-center relative px-4">
          {/* Pack booster centered */}
          <img
            src={packBoosterImg}
            alt="Pack Flipz"
            className="relative z-[1] w-72 max-w-[80vw] h-auto drop-shadow-[0_0_40px_hsl(var(--primary)/0.6)] mb-8"
            draggable={false}
          />

          {/* Button directly below booster */}
          <div className="flex flex-col items-center z-10">
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
          <div className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center p-4 select-none"
            style={{ touchAction: 'pan-y' }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="absolute top-4 right-4 z-20 bg-card/80"
            >
              <X className="w-5 h-5" />
            </Button>

            <div
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
                {revealedCards[currentCardIndex] && (
                  <MysteryCard
                    key={currentCardIndex}
                    card={revealedCards[currentCardIndex]}
                    isRevealed={cardRevealed}
                    onReveal={handleRevealCard}
                    size="lg"
                    isNew={currentCardIsNew}
                  />
                )}
              </div>
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
              <div className="mt-4 flex items-center gap-1 text-muted-foreground text-sm animate-fade-in">
                <ChevronLeft className="w-4 h-4 animate-[pulse_1.5s_ease-in-out_infinite]" />
                <span>{currentCardIndex >= revealedCards.length - 1 ? t('common.finish') : t('packs.swipeHint', 'Swipez pour continuer')}</span>
              </div>
            )}
          </div>
        )}

      <Navigation />
    </div>
  );
};

export default Packs;
