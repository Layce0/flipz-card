import { useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Store, ArrowRightLeft, Loader2, Package } from 'lucide-react';
import { Rarity, RARITY_CONFIG } from '@/types/card';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCards, useDeleteUserCards, useRandomCards, useCollectCard, UserCardWithCount } from '@/hooks/useCards';
import { cn } from '@/lib/utils';
import { MysteryCard } from '@/components/MysteryCard';

// Trade configuration: 5 cards of same rarity -> X random cards
const TRADE_CONFIG: Record<Rarity, { required: number; reward: number }> = {
  common: { required: 5, reward: 3 },
  rare: { required: 5, reward: 7 },
  epic: { required: 5, reward: 10 },
  legendary: { required: 5, reward: 15 },
};

const Shop = () => {
  const { user } = useAuth();
  const { data: userCards = [], isLoading: cardsLoading } = useUserCards(user?.id);
  const deleteCards = useDeleteUserCards();
  const getRandomCards = useRandomCards();
  const collectCard = useCollectCard();

  const [selectedCard, setSelectedCard] = useState<UserCardWithCount | null>(null);
  const [isTrading, setIsTrading] = useState(false);
  const [rewardCards, setRewardCards] = useState<any[]>([]);
  const [showReward, setShowReward] = useState(false);
  const [revealedCards, setRevealedCards] = useState<Set<number>>(new Set());

  // Group eligible cards by rarity
  const getEligibleCardsByRarity = (rarity: Rarity) => {
    const config = TRADE_CONFIG[rarity];
    return userCards.filter(
      (card) => card.rarity === rarity && card.count >= config.required
    );
  };

  const handleTrade = async (card: UserCardWithCount) => {
    if (!user) {
      toast.error('Vous devez être connecté');
      return;
    }

    const config = TRADE_CONFIG[card.rarity as Rarity];
    if (card.count < config.required) {
      toast.error(`Vous avez besoin de ${config.required} cartes identiques`);
      return;
    }

    setIsTrading(true);
    setSelectedCard(null);

    try {
      // Delete required cards
      await deleteCards.mutateAsync({
        userId: user.id,
        cardId: card.id,
        count: config.required,
      });

      // Get random reward cards
      const newCards = await getRandomCards.mutateAsync({ count: config.reward });

      // Collect all new cards
      for (const newCard of newCards) {
        await collectCard.mutateAsync({ userId: user.id, cardId: newCard.id });
      }

      setRewardCards(newCards);
      setRevealedCards(new Set());
      setShowReward(true);
      toast.success(`Échange réussi ! Vous avez reçu ${config.reward} cartes !`);
    } catch (error) {
      toast.error("Erreur lors de l'échange");
    } finally {
      setIsTrading(false);
    }
  };

  const handleRevealCard = (index: number) => {
    setRevealedCards(prev => new Set([...prev, index]));
  };

  const rarities: Rarity[] = ['legendary', 'epic', 'rare', 'common'];

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="pt-12 pb-6 px-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Store className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl text-foreground">Boutique</h1>
            <p className="text-sm text-muted-foreground">Échangez vos doublons</p>
          </div>
        </div>
      </header>

      <main className="px-4 space-y-6">
        {cardsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Trade offers */}
            {rarities.map((rarity) => {
              const config = TRADE_CONFIG[rarity];
              const rarityConfig = RARITY_CONFIG[rarity];
              const eligibleCards = getEligibleCardsByRarity(rarity);

              return (
                <Card key={rarity} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-semibold uppercase",
                            rarityConfig.bgClass
                          )}
                          style={{ color: rarity === 'legendary' ? 'hsl(240, 20%, 6%)' : 'white' }}
                        >
                          {rarityConfig.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Package className="w-4 h-4" />
                        <span>{config.required} → {config.reward} cartes</span>
                      </div>
                    </div>
                    <CardDescription className="mt-2">
                      Échangez {config.required} cartes {rarityConfig.label.toLowerCase()}s identiques contre {config.reward} cartes aléatoires
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {eligibleCards.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Aucune carte éligible (minimum {config.required} exemplaires identiques)
                      </p>
                    ) : (
                      <ScrollArea className="w-full">
                        <div className="flex gap-3 pb-2">
                          {eligibleCards.map((card) => (
                            <button
                              key={card.id}
                              onClick={() => setSelectedCard(card)}
                              className="flex-shrink-0 group"
                              disabled={isTrading}
                            >
                              <div className="relative w-20 aspect-[2/3] rounded-lg overflow-hidden border-2 border-border group-hover:border-primary transition-colors">
                                <img
                                  src={card.image_url}
                                  alt={card.title}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                                  <span className="text-[10px] text-white font-medium truncate block">
                                    {card.title}
                                  </span>
                                  <span className="text-[10px] text-primary font-bold">
                                    ×{card.count}
                                  </span>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </>
        )}
      </main>

      {/* Confirmation Dialog */}
      <Dialog open={!!selectedCard} onOpenChange={() => setSelectedCard(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmer l'échange</DialogTitle>
            <DialogDescription>
              {selectedCard && (
                <>
                  Échanger {TRADE_CONFIG[selectedCard.rarity as Rarity].required} exemplaires de "{selectedCard.title}" contre{' '}
                  {TRADE_CONFIG[selectedCard.rarity as Rarity].reward} cartes aléatoires ?
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedCard && (
            <div className="flex justify-center py-4">
              <div className="relative w-24 aspect-[2/3] rounded-xl overflow-hidden border-2 border-border">
                <img
                  src={selectedCard.image_url}
                  alt={selectedCard.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-1 right-1 bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 rounded-full font-bold">
                  -{TRADE_CONFIG[selectedCard.rarity as Rarity].required}
                </div>
              </div>
              <div className="flex items-center px-4">
                <ArrowRightLeft className="w-6 h-6 text-primary" />
              </div>
              <div className="flex items-center justify-center w-24 aspect-[2/3] rounded-xl border-2 border-dashed border-primary/50 bg-primary/5">
                <div className="text-center">
                  <Package className="w-6 h-6 text-primary mx-auto mb-1" />
                  <span className="text-xs text-primary font-bold">
                    +{TRADE_CONFIG[selectedCard.rarity as Rarity].reward}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedCard(null)}>
              Annuler
            </Button>
            <Button
              variant="gold"
              onClick={() => selectedCard && handleTrade(selectedCard)}
              disabled={isTrading}
            >
              {isTrading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Échanger'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reward Dialog */}
      <Dialog open={showReward} onOpenChange={setShowReward}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-center">🎉 Nouvelles cartes !</DialogTitle>
            <DialogDescription className="text-center">
              Cliquez sur les cartes pour les révéler
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3 py-4 max-h-[60vh] overflow-y-auto">
            {rewardCards.map((card, index) => (
              <div key={index} className="flex justify-center">
                <MysteryCard
                  card={card}
                  isRevealed={revealedCards.has(index)}
                  onReveal={() => handleRevealCard(index)}
                  size="sm"
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="gold"
              onClick={() => setShowReward(false)}
              className="w-full"
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Navigation />
    </div>
  );
};

export default Shop;