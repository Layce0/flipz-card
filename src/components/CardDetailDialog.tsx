import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X } from 'lucide-react';
import { GameCard, RARITY_CONFIG, Rarity } from '@/types/card';
import { cn } from '@/lib/utils';

interface CardDetailDialogProps {
  card: GameCard | null;
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CardDetailDialog = ({ 
  card, 
  count, 
  open, 
  onOpenChange
}: CardDetailDialogProps) => {
  const { t } = useTranslation();
  
  if (!card) return null;

  const config = RARITY_CONFIG[card.rarity as Rarity];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden bg-card border-2" style={{ borderColor: config.color }}>
        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Card image */}
        <div className="relative aspect-[3/4] w-full">
          <img 
            src={card.image_url} 
            alt={card.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
          
          {/* Count badge */}
          <div className="absolute top-3 left-3 bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-sm font-bold shadow-lg">
            ×{count}
          </div>

          {/* Rarity badge */}
          <div 
            className={cn(
              "absolute top-3 right-12 px-3 py-1 rounded-full text-xs font-semibold uppercase",
              config.bgClass
            )}
            style={{ color: card.rarity === 'legendary' ? 'hsl(240, 20%, 6%)' : 'white' }}
          >
            {t(`rarity.${card.rarity}`)}
          </div>

          {/* Shimmer for legendary */}
          {card.rarity === 'legendary' && (
            <div className="shimmer absolute inset-0 pointer-events-none" />
          )}
        </div>

        {/* Card info */}
        <div className="p-4 space-y-4">
          <div>
            <h2 className="font-display text-xl text-foreground">{card.title}</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {card.description}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
