import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, ArrowRightLeft, Loader2, Package } from 'lucide-react';
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

const RARITY_COLORS: Record<Rarity, { gradient: string; shadow: string; border: string }> = {
  common: {
    gradient: 'from-[#636AA2] to-[#2F1A4C]',
    shadow: 'shadow-[0_0_20px_rgba(99,106,162,0.3)]',
    border: 'border-[#636AA2]/50',
  },
  rare: {
    gradient: 'from-[#2597A6] to-[#636AA2]',
    shadow: 'shadow-[0_0_20px_rgba(37,151,166,0.3)]',
    border: 'border-[#2597A6]/50',
  },
  epic: {
    gradient: 'from-[#744E90] to-[#662D5E]',
    shadow: 'shadow-[0_0_20px_rgba(116,78,144,0.3)]',
    border: 'border-[#744E90]/50',
  },
  legendary: {
    gradient: 'from-[#EC9884] to-[#662D5E]',
    shadow: 'shadow-[0_0_20px_rgba(236,152,132,0.4)]',
    border: 'border-[#EC9884]/50',
  },
};

const Exchange = () => {
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
    <div className="min-h-screen pb-24 bg-gradient-to-b from-[#2F1A4C] via-[#662D5E]/30 to-[#2F1A4C]">
      {/* Header */}
      <header className="relative pt-8 pb-6 px-4">
        <div className="flex items-center gap-3">
          <Link to="/shop">
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10 rounded-xl bg-[#744E90]/20 hover:bg-[#744E90]/30 text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-display text-2xl text-white">Centre d'Échange</h1>
            <p className="text-[#636AA2] text-sm">Échangez vos doublons contre de nouvelles cartes</p>
          </div>
        </div>
      </header>

      <main className="px-4 space-y-5">
        {cardsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#EC9884]" />
          </div>
        ) : (
          <>
            {/* Trade offers by rarity */}
            {rarities.map((rarity) => {
              const config = TRADE_CONFIG[rarity];
              const rarityConfig = RARITY_CONFIG[rarity];
              const rarityColors = RARITY_COLORS[rarity];
              const eligibleCards = getEligibleCardsByRarity(rarity);

              return (
                <div
                  key={rarity}
                  className={`relative rounded-2xl p-[1px] bg-gradient-to-r ${rarityColors.gradient} ${rarityColors.shadow}`}
                >
                  <div className="rounded-2xl bg-[#2F1A4C]/95 backdrop-blur-sm overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b border-white/5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "px-3 py-1 rounded-full text-xs font-bold uppercase bg-gradient-to-r text-white",
                              rarityColors.gradient
                            )}
                          >
                            {rarityConfig.label}
                          </span>
                          <span className="text-[#636AA2] text-xs">
                            {eligibleCards.length} carte{eligibleCards.length !== 1 ? 's' : ''} éligible{eligibleCards.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Package className="w-4 h-4 text-[#EC9884]" />
                          <span className="text-white font-medium">
                            {config.required} → {config.reward}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Cards */}
                    <div className="p-4">
                      {eligibleCards.length === 0 ? (
                        <p className="text-sm text-[#636AA2] text-center py-6">
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
                                <div className={`relative w-20 aspect-[2/3] rounded-xl overflow-hidden border-2 ${rarityColors.border} group-hover:border-[#EC9884] transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(236,152,132,0.3)]`}>
                                  <img
                                    src={card.image_url}
                                    alt={card.title}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#2F1A4C] via-[#2F1A4C]/80 to-transparent p-2">
                                    <span className="text-[10px] text-white font-medium truncate block">
                                      {card.title}
                                    </span>
                                    <span className="text-[10px] text-[#EC9884] font-bold">
                                      ×{card.count}
                                    </span>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </main>

      {/* Confirmation Dialog */}
      <Dialog open={!!selectedCard} onOpenChange={() => setSelectedCard(null)}>
        <DialogContent className="max-w-sm bg-gradient-to-b from-[#2F1A4C] to-[#662D5E]/80 border-[#744E90]/50">
          <DialogHeader>
            <DialogTitle className="text-white font-display">Confirmer l'échange</DialogTitle>
            <DialogDescription className="text-[#636AA2]">
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
              <div className="relative w-24 aspect-[2/3] rounded-xl overflow-hidden border-2 border-[#744E90]/50">
                <img
                  src={selectedCard.image_url}
                  alt={selectedCard.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-1 right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                  -{TRADE_CONFIG[selectedCard.rarity as Rarity].required}
                </div>
              </div>
              <div className="flex items-center px-4">
                <ArrowRightLeft className="w-6 h-6 text-[#EC9884]" />
              </div>
              <div className="flex items-center justify-center w-24 aspect-[2/3] rounded-xl border-2 border-dashed border-[#2597A6]/50 bg-[#2597A6]/10">
                <div className="text-center">
                  <Package className="w-6 h-6 text-[#2597A6] mx-auto mb-1" />
                  <span className="text-xs text-[#2597A6] font-bold">
                    +{TRADE_CONFIG[selectedCard.rarity as Rarity].reward}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setSelectedCard(null)}
              className="border-[#636AA2]/50 text-[#636AA2] hover:bg-[#636AA2]/10 hover:text-white"
            >
              Annuler
            </Button>
            <Button
              onClick={() => selectedCard && handleTrade(selectedCard)}
              disabled={isTrading}
              className="bg-gradient-to-r from-[#EC9884] to-[#662D5E] text-white border-0 hover:opacity-90"
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
        <DialogContent className="max-w-lg bg-gradient-to-b from-[#2F1A4C] to-[#662D5E]/80 border-[#744E90]/50">
          <DialogHeader>
            <DialogTitle className="text-center text-white font-display">🎉 Nouvelles cartes !</DialogTitle>
            <DialogDescription className="text-center text-[#636AA2]">
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
              onClick={() => setShowReward(false)}
              className="w-full bg-gradient-to-r from-[#EC9884] to-[#662D5E] text-white border-0 hover:opacity-90"
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

export default Exchange;
