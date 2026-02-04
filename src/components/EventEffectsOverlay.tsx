import { useEventContext } from '@/contexts/EventContext';
import { useEffect, useState } from 'react';
import { Sparkles, Gift, Zap, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export const EventEffectsOverlay = () => {
  const { isEventActive, boosts, currentEvent } = useEventContext();
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; delay: number }[]>([]);
  const [showBanner, setShowBanner] = useState(false);

  // Generate floating particles
  useEffect(() => {
    if (isEventActive && boosts.effects.confetti) {
      const newParticles = Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 5,
      }));
      setParticles(newParticles);
    } else {
      setParticles([]);
    }
  }, [isEventActive, boosts.effects.confetti]);

  // Show banner when event becomes active
  useEffect(() => {
    if (isEventActive) {
      setShowBanner(true);
      const timer = setTimeout(() => setShowBanner(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isEventActive, currentEvent?.id]);

  if (!isEventActive) return null;

  return (
    <>
      {/* Global glow effect */}
      {boosts.effects.glow && (
        <div className="fixed inset-0 pointer-events-none z-40">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-primary/5 animate-pulse" />
          <div className="absolute inset-0 border-4 border-primary/30 rounded-none animate-[pulse_2s_ease-in-out_infinite]" />
        </div>
      )}

      {/* Flash effect */}
      {boosts.effects.flash && (
        <div className="fixed inset-0 pointer-events-none z-40">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-[shimmer_2s_infinite]" />
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-[shimmer_2s_infinite_reverse]" />
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-transparent via-accent to-transparent animate-[shimmer_3s_infinite]" />
          <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-transparent via-accent to-transparent animate-[shimmer_3s_infinite_reverse]" />
        </div>
      )}

      {/* Confetti particles */}
      {boosts.effects.confetti && particles.map(particle => (
        <div
          key={particle.id}
          className="fixed pointer-events-none z-40 animate-[float_4s_ease-in-out_infinite]"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            animationDelay: `${particle.delay}s`,
          }}
        >
          {particle.id % 4 === 0 && <Sparkles className="w-4 h-4 text-primary animate-spin" style={{ animationDuration: '3s' }} />}
          {particle.id % 4 === 1 && <Star className="w-3 h-3 text-accent animate-pulse" />}
          {particle.id % 4 === 2 && <div className="w-2 h-2 rounded-full bg-primary/60 animate-ping" />}
          {particle.id % 4 === 3 && <Zap className="w-3 h-3 text-yellow-400 animate-bounce" />}
        </div>
      ))}

      {/* Event banner */}
      <div 
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500 transform",
          showBanner ? "translate-y-0" : "-translate-y-full"
        )}
      >
        <div className="bg-gradient-to-r from-primary/90 via-accent/90 to-primary/90 text-primary-foreground py-3 px-4 shadow-lg">
          <div className="container mx-auto flex items-center justify-center gap-3">
            <Sparkles className="w-5 h-5 animate-spin" style={{ animationDuration: '2s' }} />
            <span className="font-display text-lg font-bold">
              {currentEvent?.name || 'Événement spécial en cours!'}
            </span>
            <Sparkles className="w-5 h-5 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
          </div>
          {currentEvent?.description && (
            <p className="text-center text-sm opacity-90 mt-1">{currentEvent.description}</p>
          )}
        </div>
      </div>

      {/* Floating event indicator */}
      <div className="fixed bottom-20 right-4 z-50">
        <div className="relative group">
          <div className="absolute inset-0 bg-primary/50 rounded-full blur-xl animate-pulse" />
          <div className="relative flex items-center gap-2 bg-card/95 border border-primary/50 rounded-full px-4 py-2 shadow-lg backdrop-blur-sm">
            <div className="relative">
              <Gift className="w-5 h-5 text-primary" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-ping" />
            </div>
            <span className="font-display text-sm text-foreground">
              Événement actif
            </span>
          </div>
          
          {/* Tooltip on hover */}
          <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            <div className="bg-popover border border-border rounded-lg p-3 shadow-xl min-w-[200px]">
              <p className="font-display text-sm text-foreground mb-1">{currentEvent?.name}</p>
              {boosts.globalMultiplier > 1 && (
                <p className="text-xs text-primary flex items-center gap-1">
                  <Zap className="w-3 h-3" /> x{boosts.globalMultiplier} multiplicateur global
                </p>
              )}
              {boosts.bonusCards > 0 && (
                <p className="text-xs text-primary flex items-center gap-1">
                  <Gift className="w-3 h-3" /> +{boosts.bonusCards} cartes bonus
                </p>
              )}
              {Object.entries(boosts.rarityBoosts).filter(([_, v]) => v > 1).map(([rarity, multiplier]) => (
                <p key={rarity} className="text-xs text-accent flex items-center gap-1">
                  <Star className="w-3 h-3" /> {rarity}: x{multiplier}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Animated corner decorations */}
      {boosts.effects.glow && (
        <>
          <div className="fixed top-0 left-0 w-32 h-32 pointer-events-none z-40">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-transparent animate-pulse" />
          </div>
          <div className="fixed top-0 right-0 w-32 h-32 pointer-events-none z-40">
            <div className="absolute inset-0 bg-gradient-to-bl from-accent/30 to-transparent animate-pulse" />
          </div>
          <div className="fixed bottom-0 left-0 w-32 h-32 pointer-events-none z-40">
            <div className="absolute inset-0 bg-gradient-to-tr from-accent/30 to-transparent animate-pulse" />
          </div>
          <div className="fixed bottom-0 right-0 w-32 h-32 pointer-events-none z-40">
            <div className="absolute inset-0 bg-gradient-to-tl from-primary/30 to-transparent animate-pulse" />
          </div>
        </>
      )}
    </>
  );
};
