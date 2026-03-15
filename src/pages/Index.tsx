import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { lazy, Suspense } from 'react';
const Lottie = lazy(() => import('lottie-react'));
import { MysteryCard } from '@/components/MysteryCard';
import { Navigation } from '@/components/Navigation';

import { WinstreakBadge } from '@/components/WinstreakBadge';
import { Clock, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTodayCard, useHasCollectedToday, useCollectCard, useUserCards, isCardNew } from '@/hooks/useCards';
import { useUserStreak, useUpdateStreak } from '@/hooks/useWinstreak';
import { toast } from 'sonner';
const flipzLogo = '/flipz-logo-new.jpeg';

const Index = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [catData, setCatData] = useState<any>(null);
  const [catRunData, setCatRunData] = useState<any>(null);
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Lazy load lottie JSON data
  useEffect(() => {
    import('@/assets/lottie-cat.json').then(m => setCatData(m.default));
  }, []);

  // Redirect unauthenticated users to auth page
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);
  
  const { data: todayCard, isLoading: cardLoading } = useTodayCard(user?.id);
  const { data: hasCollected, isLoading: collectedLoading } = useHasCollectedToday(user?.id, todayCard?.id);
  const { data: userCards = [] } = useUserCards(user?.id);
  const collectCard = useCollectCard();
  const { data: streakData } = useUserStreak(user?.id);
  const updateStreak = useUpdateStreak();
  const streakUpdatedRef = useRef(false);

  // Auto-update streak on app launch — fire only once
  useEffect(() => {
    if (user && !authLoading && !streakUpdatedRef.current) {
      streakUpdatedRef.current = true;
      updateStreak.mutate(user.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const diff = tomorrow.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleReveal = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!todayCard) return;
    
    try {
      await collectCard.mutateAsync({ userId: user.id, cardId: todayCard.id });
      // Update winstreak on card reveal
      await updateStreak.mutateAsync(user.id);
      toast.success(t('home.cardAdded'));
    } catch (error: any) {
      // Ignore duplicate collection errors (already collected)
      if (error?.code !== '23505') {
        toast.error(t('common.error'));
      }
    }
  };

  const isLoading = cardLoading || collectedLoading;
  // Card is revealed if user has collected it
  const isRevealed = hasCollected === true;

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="pt-12 pb-6 px-4 text-center relative">
        {/* Winstreak badge - top right */}
        {streakData && streakData.current_streak > 0 && (
          <div className="absolute top-12 right-4">
            <WinstreakBadge streak={streakData.current_streak} />
          </div>
        )}
        <div className="mb-2" data-tour="logo">
          <img src={flipzLogo} alt="FLIPZ" className="h-28 sm:h-36 mx-auto" width={1257} height={510} fetchPriority="high" />
        </div>
        <p className="text-muted-foreground text-sm">{t('home.subtitle')}</p>
      </header>

      {/* Daily card section */}
      <main className="px-4 flex flex-col items-center">
        {/* Timer */}
        <div data-tour="timer" className="relative flex items-center gap-2 bg-card/80 px-5 py-2.5 rounded-full mb-8 timer-glow-border">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-sm text-muted-foreground">{t('home.nextCard')}</span>
          <span className="font-mono text-primary font-semibold">{timeLeft}</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : !todayCard ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">{t('home.noCard')}</p>
            <p className="text-sm text-muted-foreground/70">{t('home.comeBackTomorrow')}</p>
          </div>
        ) : (
          <>
            {/* Card */}
            <div className="relative mb-8" data-tour="card">
              <div className="absolute -inset-8 bg-gradient-radial from-primary/20 via-transparent to-transparent blur-2xl" />
              <MysteryCard 
                card={todayCard} 
                isRevealed={isRevealed}
                onReveal={handleReveal}
                size="lg"
                isNew={isCardNew(todayCard.id, userCards)}
              />
            </div>

          </>
        )}
      </main>

      {/* Lottie cat - bottom left */}
      {catData && (
        <Suspense fallback={null}>
          <div 
            className="fixed bottom-24 left-4 z-10 cursor-pointer"
            onClick={() => { 
              if (!isRunning) {
                setIsRunning(true);
                if (!catRunData) import('@/assets/lottie-cat-run.json').then(m => setCatRunData(m.default));
              }
            }}
          >
            <Lottie animationData={catData} loop className="w-28 h-28 sm:w-32 sm:h-32" />
          </div>

          {isRunning && catRunData && (
            <div 
              className="fixed z-50 top-1/2 -translate-y-1/2 animate-[catRun_2s_ease-in-out_forwards] pointer-events-none"
              onAnimationEnd={() => setIsRunning(false)}
            >
              <Lottie animationData={catRunData} loop className="w-32 h-32 sm:w-40 sm:h-40" />
            </div>
          )}
        </Suspense>
      )}

      
      <Navigation />
    </div>
  );
};

export default Index;
