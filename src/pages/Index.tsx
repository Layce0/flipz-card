import { useState, useEffect } from 'react';
import { MysteryCard } from '@/components/MysteryCard';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Sparkles, Clock, Gift } from 'lucide-react';
import { GameCard } from '@/types/card';

// Exemple de carte du jour (sera remplacé par la DB)
const DAILY_CARD: GameCard = {
  id: '1',
  title: 'Dragon Ancestral',
  description: 'Une créature légendaire gardienne des secrets anciens. On dit que ses écailles brillent comme mille soleils.',
  image_url: 'https://images.unsplash.com/photo-1577493340887-b7bfff550145?w=600&h=800&fit=crop',
  rarity: 'legendary',
  release_date: new Date().toISOString(),
  created_at: new Date().toISOString(),
};

const Index = () => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

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

  const handleReveal = () => {
    setIsRevealed(true);
    // TODO: Save to collection
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="pt-12 pb-6 px-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-6 h-6 text-primary" />
          <h1 className="font-display text-2xl text-gradient-gold">Cartes Mystères</h1>
          <Sparkles className="w-6 h-6 text-primary" />
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

        {/* Card */}
        <div className="relative mb-8">
          <div className="absolute -inset-8 bg-gradient-radial from-primary/20 via-transparent to-transparent blur-2xl" />
          <MysteryCard 
            card={DAILY_CARD} 
            isRevealed={isRevealed}
            onReveal={handleReveal}
            size="lg"
          />
        </div>

        {/* CTA */}
        {!isRevealed ? (
          <div className="text-center animate-fade-in">
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <Gift className="w-5 h-5" />
              <span>Votre carte du jour vous attend !</span>
            </div>
            <Button variant="gold" size="xl" onClick={handleReveal}>
              <Sparkles className="w-5 h-5" />
              Révéler la carte
            </Button>
          </div>
        ) : (
          <div className="text-center animate-fade-in">
            <p className="text-primary font-display text-lg mb-2">Félicitations !</p>
            <p className="text-muted-foreground text-sm">Cette carte a été ajoutée à votre collection</p>
          </div>
        )}
      </main>

      <Navigation />
    </div>
  );
};

export default Index;
