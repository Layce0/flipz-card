import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { GameCard, RARITY_CONFIG } from '@/types/card';
import { cn } from '@/lib/utils';
import { useLocalizedCard } from '@/hooks/useLocalizedCard';

interface CollectionCardProps {
  card: GameCard;
  onClick?: () => void;
}

export const CollectionCard = memo(({ card, onClick }: CollectionCardProps) => {
  const { t } = useTranslation();
  const { getTitle } = useLocalizedCard();
  const rarityConfig = RARITY_CONFIG[card.rarity];

  return (
    <div 
      className="relative group cursor-pointer transition-transform duration-300 hover:scale-105"
      onClick={onClick}
    >
      <div 
        className={cn(
          "absolute -inset-1 rounded-xl opacity-50 group-hover:opacity-100 transition-opacity blur-sm",
          card.rarity === 'legendary' && "animate-glow-pulse"
        )}
        style={{ background: rarityConfig.color }}
      />
      
      <div className="relative rounded-xl overflow-hidden bg-card border-2 card-shadow"
        style={{ borderColor: rarityConfig.color }}
      >
        <div className="aspect-[3/4] overflow-hidden">
          <img 
            src={card.image_url} 
            alt={getTitle(card)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-card to-transparent">
          <span 
            className={cn(
              "inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider mb-1",
              rarityConfig.bgClass
            )}
            style={{ color: card.rarity === 'legendary' ? 'hsl(240, 20%, 6%)' : 'white' }}
          >
            {t(`rarity.${card.rarity}`)}
          </span>
          <h4 className="font-display text-sm text-foreground truncate">{getTitle(card)}</h4>
        </div>

        {card.rarity === 'legendary' && (
          <div className="shimmer absolute inset-0 pointer-events-none" />
        )}
      </div>
    </div>
  );
});

CollectionCard.displayName = 'CollectionCard';
