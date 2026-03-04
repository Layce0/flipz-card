import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { GameCard, RARITY_CONFIG } from '@/types/card';
import { cn } from '@/lib/utils';
import cardBackImage from '@/assets/card-back.png';

interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
  opacity: number;
}

interface MysteryCardProps {
  card: GameCard;
  isRevealed?: boolean;
  onReveal?: () => void;
  size?: 'sm' | 'md' | 'lg';
  isNew?: boolean;
}

export const MysteryCard = memo(({ card, isRevealed = false, onReveal, size = 'md', isNew = false }: MysteryCardProps) => {
  const [flipped, setFlipped] = useState(isRevealed);
  const [showParticles, setShowParticles] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showLegendaryReveal, setShowLegendaryReveal] = useState(false);
  const [showRing, setShowRing] = useState(false);

  useEffect(() => {
    if (isRevealed) setFlipped(true);
  }, [isRevealed]);

  const rarityConfig = RARITY_CONFIG[card.rarity];

  const spawnParticles = useCallback(() => {
    const count = size === 'sm' ? 20 : size === 'md' ? 30 : 40; // reduced counts
    const newParticles: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 50 + (Math.random() - 0.5) * 16,
      y: 50 + (Math.random() - 0.5) * 16,
      angle: (360 / count) * i + (Math.random() - 0.5) * 40,
      speed: 80 + Math.random() * 120,
      size: 5 + Math.random() * 9,
      opacity: 0.8 + Math.random() * 0.2,
    }));
    setParticles(newParticles);
    setShowParticles(true);
    setTimeout(() => setShowParticles(false), 900);
  }, [size]);

  const sizeClasses = {
    sm: 'w-40 h-56',
    md: 'w-56 h-80',
    lg: 'w-72 h-[420px]',
  };

  const handleClick = () => {
    if (!flipped && onReveal) {
      setFlipped(true);
      spawnParticles();
      if (card.rarity === 'legendary') {
        setShowLegendaryReveal(true);
        setShowRing(true);
        setTimeout(() => setShowRing(false), 900);
        setTimeout(() => setShowLegendaryReveal(false), 1200);
      }
      onReveal();
    }
  };

  return (
    <div 
      className={cn("flip-card cursor-pointer relative", sizeClasses[size])}
      onClick={handleClick}
    >
      {showParticles && (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-visible">
          {particles.map((p) => {
            const rad = (p.angle * Math.PI) / 180;
            const tx = Math.cos(rad) * p.speed;
            const ty = Math.sin(rad) * p.speed;
            return (
              <span
                key={p.id}
                className="absolute rounded-full"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: p.size,
                  height: p.size,
                  backgroundColor: rarityConfig.color,
                  opacity: 0,
                  boxShadow: `0 0 ${p.size * 2}px ${rarityConfig.color}`,
                  animation: `particle-burst 0.8s ease-out forwards`,
                  '--tx': `${tx}px`,
                  '--ty': `${ty}px`,
                  '--start-opacity': p.opacity,
                } as React.CSSProperties}
              />
            );
          })}
        </div>
      )}

      <div className={cn(
        "flip-card-inner relative w-full h-full",
        flipped && "flipped"
      )}>
        {/* Card Back */}
        <div className={cn(
          "flip-card-front absolute inset-0 rounded-2xl overflow-hidden card-shadow",
          !flipped && card.rarity === 'legendary' && "legendary-sweep"
        )}>
          <img src={cardBackImage} alt="Card back" className="w-full h-full object-cover rounded-2xl" />
          {!flipped && card.rarity === 'legendary' && (
            <div className="absolute inset-0 rounded-2xl animate-pulse" style={{
              boxShadow: 'inset 0 0 30px hsl(45 95% 60% / 0.3), 0 0 20px hsl(45 95% 60% / 0.2)',
            }} />
          )}
        </div>

        {/* Card Front */}
        <div className={cn(
          "flip-card-back absolute inset-0 rounded-2xl overflow-hidden card-shadow",
          showLegendaryReveal && "legendary-reveal-anim"
        )}>
          {showRing && <div className="legendary-ring" />}
          <div
            className={cn(
              "absolute inset-0 rounded-2xl",
              card.rarity === 'legendary' && "animate-glow-pulse"
            )}
            style={{ 
              boxShadow: `0 0 30px ${rarityConfig.color}40, inset 0 0 20px ${rarityConfig.color}20`
            }}
          />
          
          <div className="relative h-full bg-card rounded-2xl border-2 overflow-hidden"
            style={{ borderColor: rarityConfig.color }}
          >
            <div className="relative h-[55%] overflow-hidden">
              <img 
                src={card.image_url} 
                alt={card.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
            </div>

            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span 
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider",
                    rarityConfig.bgClass
                  )}
                  style={{ color: card.rarity === 'legendary' ? 'hsl(240, 20%, 6%)' : 'white' }}
                >
                  {rarityConfig.label}
                </span>
              </div>

              <h3 className="font-display text-lg leading-tight text-foreground">
                {card.title}
              </h3>

              <p className="text-sm text-muted-foreground line-clamp-3">
                {card.description}
              </p>
            </div>

            {card.rarity === 'legendary' && (
              <div className="shimmer absolute inset-0 pointer-events-none" />
            )}

            {isNew && flipped && (
              <div className="absolute top-3 right-3 z-10 animate-scale-in">
                <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider">
                  Nouveau
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

MysteryCard.displayName = 'MysteryCard';
