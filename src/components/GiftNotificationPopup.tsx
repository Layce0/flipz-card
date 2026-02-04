import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { GameCard } from '@/types/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Gift, Sparkles, Star, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GiftNotification {
  id: string;
  type: 'card' | 'pack';
  card?: GameCard;
  packType?: string;
}

export const GiftNotificationPopup = () => {
  const { user } = useAuth();
  const [notification, setNotification] = useState<GiftNotification | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; delay: number }[]>([]);

  useEffect(() => {
    if (!user) return;

    // Generate particles for effect
    const newParticles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 2,
    }));
    setParticles(newParticles);

    // Subscribe to new cards added to user's collection
    const channel = supabase
      .channel('user-gifts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_cards',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('New card received:', payload);
          
          // Fetch card details
          const { data: cardData } = await supabase
            .from('cards')
            .select('*')
            .eq('id', payload.new.card_id)
            .single();

          if (cardData) {
            setNotification({
              id: payload.new.id,
              type: 'card',
              card: cardData as GameCard,
            });
            setIsRevealed(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleReveal = () => {
    setIsRevealed(true);
  };

  const handleClose = () => {
    setNotification(null);
    setIsRevealed(false);
  };

  const getRarityGradient = (rarity: string) => {
    switch (rarity) {
      case 'legendary':
        return 'from-yellow-400 via-amber-500 to-yellow-600';
      case 'epic':
        return 'from-purple-400 via-violet-500 to-purple-600';
      case 'rare':
        return 'from-blue-400 via-sky-500 to-blue-600';
      default:
        return 'from-gray-400 via-slate-500 to-gray-600';
    }
  };

  const getRarityGlow = (rarity: string) => {
    switch (rarity) {
      case 'legendary':
        return 'shadow-[0_0_60px_rgba(234,179,8,0.6)]';
      case 'epic':
        return 'shadow-[0_0_50px_rgba(168,85,247,0.5)]';
      case 'rare':
        return 'shadow-[0_0_40px_rgba(59,130,246,0.5)]';
      default:
        return 'shadow-[0_0_30px_rgba(148,163,184,0.4)]';
    }
  };

  if (!notification) return null;

  return (
    <Dialog open={!!notification} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px] p-0 bg-transparent border-none overflow-visible">
        <div className="relative">
          {/* Background particles */}
          {particles.map(particle => (
            <div
              key={particle.id}
              className="absolute pointer-events-none animate-[float_3s_ease-in-out_infinite]"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                animationDelay: `${particle.delay}s`,
              }}
            >
              {particle.id % 3 === 0 && <Sparkles className="w-4 h-4 text-primary animate-spin" style={{ animationDuration: '4s' }} />}
              {particle.id % 3 === 1 && <Star className="w-3 h-3 text-accent animate-pulse" />}
              {particle.id % 3 === 2 && <div className="w-2 h-2 rounded-full bg-primary/60 animate-ping" />}
            </div>
          ))}

          {/* Main content */}
          <div className="bg-card/95 backdrop-blur-xl rounded-2xl border border-primary/30 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 px-6 py-4 text-center border-b border-primary/20">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Gift className="w-6 h-6 text-primary animate-bounce" />
                <h2 className="font-display text-xl text-foreground">Cadeau reçu !</h2>
                <Gift className="w-6 h-6 text-primary animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
              <p className="text-sm text-muted-foreground">
                Vous avez reçu {notification.type === 'card' ? 'une nouvelle carte' : 'un pack'} !
              </p>
            </div>

            {/* Card display */}
            <div className="p-8 flex flex-col items-center">
              {notification.type === 'card' && notification.card && (
                <>
                  {/* Card wrapper with flip animation */}
                  <div 
                    className="relative cursor-pointer perspective-1000"
                    onClick={handleReveal}
                  >
                    <div 
                      className={cn(
                        "relative w-48 h-72 transition-transform duration-700 transform-style-preserve-3d",
                        isRevealed && "rotate-y-180"
                      )}
                      style={{ 
                        transformStyle: 'preserve-3d',
                        transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
                        transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      {/* Card back (mystery) */}
                      <div 
                        className={cn(
                          "absolute inset-0 rounded-xl overflow-hidden",
                          "bg-gradient-to-br from-primary/30 via-accent/30 to-primary/30",
                          "border-2 border-primary/50",
                          "flex items-center justify-center",
                          getRarityGlow(notification.card.rarity),
                          "animate-pulse"
                        )}
                        style={{ backfaceVisibility: 'hidden' }}
                      >
                        <div className="text-center">
                          <Gift className="w-16 h-16 text-primary mb-2 mx-auto animate-bounce" />
                          <p className="text-sm text-muted-foreground">Cliquez pour révéler</p>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/10 pointer-events-none" />
                      </div>

                      {/* Card front (revealed) */}
                      <div 
                        className={cn(
                          "absolute inset-0 rounded-xl overflow-hidden",
                          "bg-card border-2",
                          `border-${notification.card.rarity === 'legendary' ? 'primary' : notification.card.rarity === 'epic' ? 'accent' : 'border'}`,
                          getRarityGlow(notification.card.rarity)
                        )}
                        style={{ 
                          backfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg)'
                        }}
                      >
                        <div className="relative h-full flex flex-col">
                          {/* Card image */}
                          <div className="relative h-40 overflow-hidden">
                            <img 
                              src={notification.card.image_url} 
                              alt={notification.card.title}
                              className="w-full h-full object-cover"
                            />
                            <div className={cn(
                              "absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold uppercase",
                              `bg-gradient-to-r ${getRarityGradient(notification.card.rarity)} text-white`
                            )}>
                              {notification.card.rarity}
                            </div>
                          </div>
                          
                          {/* Card info */}
                          <div className="flex-1 p-3 flex flex-col">
                            <h3 className="font-display text-sm text-foreground mb-1 line-clamp-2">
                              {notification.card.title}
                            </h3>
                            <p className="text-xs text-muted-foreground line-clamp-3 flex-1">
                              {notification.card.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Glow effect */}
                    {isRevealed && (
                      <div className={cn(
                        "absolute -inset-4 rounded-2xl blur-2xl opacity-50 animate-pulse -z-10",
                        `bg-gradient-to-r ${getRarityGradient(notification.card.rarity)}`
                      )} />
                    )}
                  </div>

                  {/* Rarity badge */}
                  {isRevealed && (
                    <div className={cn(
                      "mt-4 px-4 py-2 rounded-full font-display text-sm",
                      `bg-gradient-to-r ${getRarityGradient(notification.card.rarity)} text-white`,
                      "animate-[scale-in_0.3s_ease-out]"
                    )}>
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        {notification.card.rarity.toUpperCase()}
                        <Sparkles className="w-4 h-4" />
                      </div>
                    </div>
                  )}
                </>
              )}

              {notification.type === 'pack' && (
                <div className="text-center">
                  <div className={cn(
                    "w-32 h-40 rounded-xl mx-auto mb-4",
                    "bg-gradient-to-br from-primary via-accent to-primary",
                    "flex items-center justify-center",
                    "shadow-[0_0_40px_rgba(234,179,8,0.4)]",
                    "animate-bounce"
                  )}>
                    <Package className="w-16 h-16 text-white" />
                  </div>
                  <p className="font-display text-lg text-foreground">
                    Pack {notification.packType}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex justify-center">
              <Button 
                onClick={handleClose}
                className="gap-2 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                disabled={notification.type === 'card' && !isRevealed}
              >
                <Sparkles className="w-4 h-4" />
                {notification.type === 'card' && !isRevealed ? 'Cliquez sur la carte' : 'Super, merci !'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
