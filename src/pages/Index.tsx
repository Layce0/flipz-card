import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MysteryCard } from '@/components/MysteryCard';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Clock, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTodayCard, useHasCollectedToday, useCollectCard } from '@/hooks/useCards';
import { toast } from 'sonner';
import flipzLogo from '@/assets/flipz-logo.png';

const Index = () => {
  const [timeLeft, setTimeLeft] = useState('');
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const { data: todayCard, isLoading: cardLoading } = useTodayCard(user?.id);
  const { data: hasCollected, isLoading: collectedLoading } = useHasCollectedToday(user?.id, todayCard?.id);
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
      toast.success('Carte ajoutée à votre collection !');
    } catch (error: any) {
      // Ignore duplicate collection errors (already collected)
      if (error?.code !== '23505') {
        toast.error('Une erreur est survenue');
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
        <p className="text-muted-foreground text-sm">Découvrez une nouvelle carte chaque jour</p>
      </header>

      {/* Daily card section */}
      <main className="px-4 flex flex-col items-center">
        {/* Timer */}
        <div className="flex items-center gap-2 bg-card/50 px-4 py-2 rounded-full border border-border mb-8">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-sm text-muted-foreground">Prochaine carte dans</span>
          <span className="font-mono text-primary font-semibold">{timeLeft}</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : !todayCard ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">Aucune carte disponible aujourd'hui</p>
            <p className="text-sm text-muted-foreground/70">Revenez demain !</p>
          </div>
        ) : (
          <>
            {/* Card */}
            <div className="relative mb-8">
              <div className="absolute -inset-8 bg-gradient-radial from-primary/20 via-transparent to-transparent blur-2xl" />
              <MysteryCard 
                card={todayCard} 
                isRevealed={isRevealed}
                onReveal={handleReveal}
                size="lg"
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
