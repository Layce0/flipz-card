import { useState } from 'react';
import { GameCard, RARITY_CONFIG } from '@/types/card';
import { cn } from '@/lib/utils';
import { HelpCircle } from 'lucide-react';

interface MysteryCardProps {
  card: GameCard;
  isRevealed?: boolean;
  onReveal?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export const MysteryCard = ({ card, isRevealed = false, onReveal, size = 'md' }: MysteryCardProps) => {
  const [flipped, setFlipped] = useState(isRevealed);
  const rarityConfig = RARITY_CONFIG[card.rarity];

  const sizeClasses = {
    sm: 'w-40 h-56',
    md: 'w-56 h-80',
    lg: 'w-72 h-[420px]',
  };

  const handleClick = () => {
    if (!flipped && onReveal) {
      setFlipped(true);
      onReveal();
    }
  };

  return (
    <div 
      className={cn(
        "flip-card cursor-pointer",
        sizeClasses[size]
      )}
      onClick={handleClick}
    >
      <div className={cn(
        "flip-card-inner relative w-full h-full",
        flipped && "flipped"
      )}>
        {/* Card Back */}
        <div className="flip-card-front absolute inset-0 rounded-2xl bg-gradient-to-br from-secondary via-card to-accent border-2 border-primary/40 card-shadow overflow-hidden">
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
            <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mb-4 pulse-glow">
              <HelpCircle className="w-14 h-14 text-primary" />
            </div>
            <p className="font-display text-lg text-center text-primary">Carte Mystère</p>
            <p className="text-sm text-muted-foreground mt-2">Touchez pour révéler</p>
          </div>
          <div className="shimmer absolute inset-0 pointer-events-none" />
        </div>

        {/* Card Front */}
        <div className="flip-card-back absolute inset-0 rounded-2xl overflow-hidden card-shadow">
          {/* Rarity border glow */}
          <div 
            className={cn(
              "absolute inset-0 rounded-2xl",
              card.rarity === 'legendary' && "animate-glow-pulse"
            )}
            style={{ 
              boxShadow: `0 0 30px ${rarityConfig.color}40, inset 0 0 20px ${rarityConfig.color}20`
            }}
          />
          
          {/* Card content */}
          <div className="relative h-full bg-card rounded-2xl border-2 overflow-hidden"
            style={{ borderColor: rarityConfig.color }}
          >
            {/* Image */}
            <div className="relative h-[55%] overflow-hidden">
              <img 
                src={card.image_url} 
                alt={card.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
            </div>

            {/* Info */}
            <div className="p-4 space-y-2">
              {/* Rarity badge */}
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

              {/* Title */}
              <h3 className="font-display text-lg leading-tight text-foreground">
                {card.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-muted-foreground line-clamp-3">
                {card.description}
              </p>
            </div>

            {/* Shimmer effect for legendary */}
            {card.rarity === 'legendary' && (
              <div className="shimmer absolute inset-0 pointer-events-none" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
