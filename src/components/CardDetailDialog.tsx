import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, Package, Loader2, X } from 'lucide-react';
import { GameCard, RARITY_CONFIG, Rarity } from '@/types/card';
import { cn } from '@/lib/utils';

interface CardDetailDialogProps {
  card: GameCard | null;
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTrade: (cardId: string) => Promise<void>;
  isTrading: boolean;
}

export const CardDetailDialog = ({ 
  card, 
  count, 
  open, 
  onOpenChange, 
  onTrade, 
  isTrading 
}: CardDetailDialogProps) => {
  if (!card) return null;

  const config = RARITY_CONFIG[card.rarity as Rarity];
  const canTrade = count >= 4;

  const handleTrade = async () => {
    await onTrade(card.id);
    onOpenChange(false);
  };

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
            {config.label}
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

          {/* Trade button */}
          <div className="pt-2 border-t border-border">
            {canTrade ? (
              <Button 
                variant="gold"
                className="w-full gap-2"
                onClick={handleTrade}
                disabled={isTrading}
              >
                {isTrading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Échanger 3 cartes → Pack de 3
                  </>
                )}
              </Button>
            ) : (
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground">
                  <Package className="w-4 h-4 inline mr-1" />
                  {4 - count} carte{4 - count > 1 ? 's' : ''} de plus pour échanger
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
