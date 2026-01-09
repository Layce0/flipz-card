import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, Package, Loader2 } from 'lucide-react';
import { GameCard, RARITY_CONFIG, Rarity } from '@/types/card';
import { cn } from '@/lib/utils';

interface CardTradeDialogProps {
  eligibleCards: { card: GameCard; count: number }[];
  onTrade: (cardId: string) => Promise<void>;
  isTrading: boolean;
}

export const CardTradeDialog = ({ eligibleCards, onTrade, isTrading }: CardTradeDialogProps) => {
  const [open, setOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const handleTrade = async () => {
    if (!selectedCardId) return;
    await onTrade(selectedCardId);
    setSelectedCardId(null);
    setOpen(false);
  };

  if (eligibleCards.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Échanger ({eligibleCards.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            Échanger des cartes
          </DialogTitle>
        </DialogHeader>
        
        <p className="text-sm text-muted-foreground mb-4">
          Échangez 3 cartes identiques contre un pack de 3 nouvelles cartes !
        </p>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {eligibleCards.map(({ card, count }) => {
            const config = RARITY_CONFIG[card.rarity as Rarity];
            return (
              <button
                key={card.id}
                onClick={() => setSelectedCardId(card.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl border transition-all",
                  selectedCardId === card.id 
                    ? "border-primary bg-primary/10" 
                    : "border-border bg-card hover:bg-card/80"
                )}
              >
                <img 
                  src={card.image_url} 
                  alt={card.title}
                  className="w-12 h-16 object-cover rounded-lg"
                />
                <div className="flex-1 text-left">
                  <h4 className="font-display text-sm">{card.title}</h4>
                  <span 
                    className={cn(
                      "inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase",
                      config.bgClass
                    )}
                    style={{ color: card.rarity === 'legendary' ? 'hsl(240, 20%, 6%)' : 'white' }}
                  >
                    {config.label}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-foreground">×{count}</span>
                  <p className="text-xs text-muted-foreground">-3</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2 mt-4">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => setOpen(false)}
          >
            Annuler
          </Button>
          <Button 
            variant="gold"
            className="flex-1 gap-2"
            disabled={!selectedCardId || isTrading}
            onClick={handleTrade}
          >
            {isTrading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Package className="w-4 h-4" />
                Échanger
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
