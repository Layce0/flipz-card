import { memo, useCallback } from 'react';
import { Rarity, RARITY_CONFIG } from '@/types/card';
import { cn } from '@/lib/utils';
import { Sparkles, Star, Crown, Gem, Layers } from 'lucide-react';

interface RarityTabsProps {
  activeRarity: Rarity | 'all';
  onRarityChange: (rarity: Rarity | 'all') => void;
  counts: Record<Rarity | 'all', number>;
  collectedCounts?: Record<Rarity | 'all', number>;
}

const rarityIcons: Record<Rarity | 'all', React.ElementType> = {
  all: Layers,
  common: Star,
  rare: Gem,
  epic: Sparkles,
  legendary: Crown,
};

const rarities: (Rarity | 'all')[] = ['all', 'common', 'rare', 'epic', 'legendary'];

export const RarityTabs = memo(({ activeRarity, onRarityChange, counts, collectedCounts }: RarityTabsProps) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {rarities.map((rarity) => {
        const isActive = activeRarity === rarity;
        const config = rarity === 'all' ? null : RARITY_CONFIG[rarity];
        const count = counts[rarity];
        const collected = collectedCounts?.[rarity];
        const Icon = rarityIcons[rarity];
        const activeColor = config?.color ?? 'hsl(45, 90%, 55%)';

        return (
          <button
            key={rarity}
            data-tour={`rarity-tab-${rarity}`}
            onClick={() => onRarityChange(rarity)}
            className={cn(
              "flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-display font-semibold transition-all duration-300 border",
              isActive
                ? "shadow-lg scale-[1.02]"
                : "border-border/50 bg-card/30 text-muted-foreground hover:bg-card/60 hover:border-border"
            )}
            style={
              isActive
                ? {
                    borderColor: activeColor,
                    backgroundColor: `${activeColor}20`,
                    color: activeColor,
                    // Force la couleur sur iOS WebKit qui peut ignorer `color` sur les boutons
                    WebkitTextFillColor: activeColor,
                    boxShadow: `0 0 20px ${activeColor}30`,
                  }
                : undefined
            }
          >
            <Icon
              className="w-4 h-4"
              style={isActive ? { color: activeColor } : undefined}
            />
            <span style={isActive ? { color: activeColor, WebkitTextFillColor: activeColor } : undefined}>
              {rarity === 'all' ? 'Toutes' : config?.label}
            </span>
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                isActive ? "bg-white/20" : "bg-muted/50"
              )}
              style={isActive ? { color: activeColor, WebkitTextFillColor: activeColor } : undefined}
            >
              {collectedCounts ? `${collected}/${count}` : count}
            </span>
          </button>
        );
      })}
    </div>
  );
});

RarityTabs.displayName = 'RarityTabs';
