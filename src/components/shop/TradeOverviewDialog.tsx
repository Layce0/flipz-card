import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, Package, Loader2 } from 'lucide-react';
import { Rarity, RARITY_CONFIG, GameCard } from '@/types/card';
import { TRADE_CONFIG } from '@/types/pack';
import { UserCardWithCount, useTradeCards } from '@/hooks/useCards';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { PackRevealFlow } from '@/components/shop/PackRevealFlow';

interface TradeOverviewDialogProps {
  userCards: UserCardWithCount[];
}

export const TradeOverviewDialog = ({ userCards }: TradeOverviewDialogProps) => {
  const [open, setOpen] = useState(false);
  const [tradingCardId, setTradingCardId] = useState<string | null>(null);
  const [revealCards, setRevealCards] = useState<GameCard[]>([]);
  const [showReveal, setShowReveal] = useState(false);
  const [ownedIdsSnapshot, setOwnedIdsSnapshot] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  
  const tradeCards = useTradeCards();

  const getEligibleCardsByRarity = (rarity: Rarity) => {
    const config = TRADE_CONFIG[rarity];
    return userCards.filter(
      (card) => card.rarity === rarity && card.count >= config.required
    );
  };

  const handleTrade = async (cardId: string, rarity: Rarity) => {
    if (!user) return;
    
    setTradingCardId(cardId);
    setOwnedIdsSnapshot(new Set(userCards.map(c => c.id)));
    try {
      const result = await tradeCards.mutateAsync({ cardId, rarity });
      
      toast.success(`Échange réussi ! ${result.rewardCount} nouvelles cartes ajoutées.`);
      
      setOpen(false);
      setRevealCards(result.cards);
      setShowReveal(true);
    } catch (error) {
      console.error('Trade error:', error);
      toast.error("Erreur lors de l'échange");
    } finally {
      setTradingCardId(null);
    }
  };

  const handleRevealClose = () => {
    setShowReveal(false);
    setRevealCards([]);
    setOpen(true);
  };

  const rarities: Rarity[] = ['legendary', 'epic', 'rare', 'common'];
  
  const totalEligible = rarities.reduce((sum, rarity) => {
    return sum + getEligibleCardsByRarity(rarity).length;
  }, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <ArrowRightLeft className="w-4 h-4" />
          Échanges disponibles
          {totalEligible > 0 && (
            <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-bold">
              {totalEligible}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
            Aperçu des échanges
          </DialogTitle>
          <DialogDescription className="sr-only">
            Échangez vos cartes contre de nouvelles cartes
          </DialogDescription>
        </DialogHeader>
        
        <p className="text-sm text-muted-foreground">
          Faites défiler pour voir toutes vos cartes éligibles à l'échange.
        </p>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {rarities.map((rarity) => {
            const config = TRADE_CONFIG[rarity];
            const rarityConfig = RARITY_CONFIG[rarity];
            const eligibleCards = getEligibleCardsByRarity(rarity);

            return (
              <div key={rarity} className="rounded-xl border border-border bg-card/50 p-3">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-semibold uppercase",
                      rarityConfig.bgClass
                    )}
                    style={{ color: rarity === 'legendary' ? 'hsl(240, 20%, 6%)' : 'white' }}
                  >
                    {rarityConfig.label}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Package className="w-3 h-3" />
                    <span>{config.required} → {config.reward} cartes</span>
                  </div>
                </div>

                {/* Scrollable cards container */}
                {eligibleCards.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Aucune carte éligible
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <div 
                      className="flex gap-2 pb-2 min-w-min flex-row-reverse"
                      style={{ direction: 'rtl' }}
                    >
                      {eligibleCards.map((card) => (
                        <button
                          key={card.id}
                          onClick={() => handleTrade(card.id, rarity)}
                          disabled={tradingCardId !== null}
                          className="flex-shrink-0 relative w-16 aspect-[2/3] rounded-lg overflow-hidden border border-border/50 group hover:border-primary transition-colors disabled:opacity-50"
                          style={{ direction: 'ltr' }}
                        >
                          <img
                            src={card.image_url}
                            alt={card.title}
                            className="w-full h-full object-cover"
                          />
                          {/* Overlay with count */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-1 text-center">
                            <span className="text-[10px] text-white/80 font-medium truncate block">
                              {card.title}
                            </span>
                            <span className="text-xs text-primary font-bold">
                              ×{card.count}
                            </span>
                          </div>
                          {/* Hover overlay / Loading */}
                          {tradingCardId === card.id ? (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            </div>
                          ) : (
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-[10px] text-white text-center px-1">
                                Échanger
                              </span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Card count */}
                <div className="mt-2 text-right">
                  <span className="text-xs text-muted-foreground">
                    {eligibleCards.length} carte{eligibleCards.length > 1 ? 's' : ''} éligible{eligibleCards.length > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="w-full"
          >
            Fermer
          </Button>
        </div>
      </DialogContent>
      
      {/* Pack reveal with sachet animation */}
      <PackRevealFlow
        cards={revealCards}
        isOpen={showReveal}
        onClose={handleRevealClose}
      />
    </Dialog>
  );
};
