import { Rarity, RARITY_CONFIG } from '@/types/card';
import { cn } from '@/lib/utils';

interface RarityTabsProps {
  activeRarity: Rarity | 'all';
  onRarityChange: (rarity: Rarity | 'all') => void;
  counts: Record<Rarity | 'all', number>;
}

const rarities: (Rarity | 'all')[] = ['all', 'common', 'rare', 'epic', 'legendary'];

export const RarityTabs = ({ activeRarity, onRarityChange, counts }: RarityTabsProps) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {rarities.map((rarity) => {
        const isActive = activeRarity === rarity;
        const config = rarity === 'all' ? null : RARITY_CONFIG[rarity];
        
        return (
          <button
            key={rarity}
            onClick={() => onRarityChange(rarity)}
            className={cn(
              "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 border",
              isActive
                ? "border-primary bg-primary/20 text-primary"
                : "border-border bg-card/50 text-muted-foreground hover:border-primary/50"
            )}
            style={
              isActive && config
                ? { 
                    borderColor: config.color, 
                    backgroundColor: `${config.color}20`,
                    color: config.color 
                  }
                : undefined
            }
          >
            {rarity === 'all' ? 'Toutes' : config?.label}
            <span className="ml-2 text-xs opacity-70">({counts[rarity]})</span>
          </button>
        );
      })}
    </div>
  );
};
