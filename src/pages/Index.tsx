import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MysteryCard } from '@/components/MysteryCard';
import { RARITY_CONFIG } from '@/types/card';
import { Navigation } from '@/components/Navigation';
import { Clock, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTodayCard, useHasCollectedToday, useCollectCard, useUserCards } from '@/hooks/useCards';
import { toast } from 'sonner';
import flipzLogo from '@/assets/flipz-logo.png';

const Index = () => {
  const [timeLeft, setTimeLeft] = useState('');
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const { data: todayCard, isLoading: cardLoading } = useTodayCard(user?.id);
  const { data: hasCollected, isLoading: collectedLoading } = useHasCollectedToday(user?.id, todayCard?.id);
  const { data: userCards = [] } = useUserCards(user?.id);
  const collectCard = useCollectCard();

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
      <header className="pt-12 pb-6 px-4 text-center">
        <div className="mb-2">
          <img src={flipzLogo} alt="FLIPZ" className="h-28 sm:h-36 mx-auto" />
        </div>
        <p className="text-muted-foreground text-sm">{t('home.subtitle')}</p>
      </header>

      {/* Daily card section */}
      <main className="px-4 flex flex-col items-center">
        {/* Timer */}
        <div className="relative flex items-center gap-2 bg-card/80 px-5 py-2.5 rounded-full mb-8 timer-glow-border">
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
            <div className="relative mb-8">
              <div 
                className="absolute -inset-4 rounded-3xl animate-pulse"
                style={{
                  background: `radial-gradient(ellipse at center, ${RARITY_CONFIG[todayCard.rarity].color}30 0%, transparent 70%)`,
                  boxShadow: `0 0 40px 10px ${RARITY_CONFIG[todayCard.rarity].color}25, 0 0 80px 20px ${RARITY_CONFIG[todayCard.rarity].color}15`,
                }}
              />
              <MysteryCard 
                card={todayCard} 
                isRevealed={isRevealed}
                onReveal={handleReveal}
                size="lg"
                isNew={!userCards.some(uc => uc.id === todayCard.id && uc.count > 1)}
              />
            </div>

          </>
        )}
      </main>

      <Navigation />
    </div>
  );
};

export default Index;
