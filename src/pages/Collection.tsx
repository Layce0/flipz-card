import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';
import { CollectionBook } from '@/components/CollectionBook';
import { RarityTabs } from '@/components/RarityTabs';
import { CardTradeDialog } from '@/components/CardTradeDialog';
import { CardDetailDialog } from '@/components/CardDetailDialog';
import { GameCard, Rarity } from '@/types/card';
import { BookOpen, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAllCards, useUserCards, UserCardWithCount, useDeleteUserCards, useRandomCards, useCollectCard } from '@/hooks/useCards';
import { toast } from 'sonner';

const Collection = () => {
  const [activeRarity, setActiveRarity] = useState<Rarity | 'all'>('all');
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const { data: allCards = [], isLoading: cardsLoading } = useAllCards();
  const { data: userCards = [], isLoading: userCardsLoading } = useUserCards(user?.id);
  
  const deleteUserCards = useDeleteUserCards();
  const getRandomCards = useRandomCards();
  const collectCard = useCollectCard();
  const [isTrading, setIsTrading] = useState(false);
  
  // Card detail dialog state
  const [selectedCard, setSelectedCard] = useState<GameCard | null>(null);
  const [selectedCardCount, setSelectedCardCount] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const collectedCardIds = new Set(userCards.map(card => card.id));
  
  // Create a map of card counts for display
  const cardCountMap = new Map(userCards.map(card => [card.id, card.count]));
  
  // Count total unique cards vs total including duplicates
  const totalCardsCollected = userCards.reduce((sum, card) => sum + card.count, 0);
  
  // Cards eligible for trading (4+ copies)
  const eligibleForTrade = userCards
    .filter(card => card.count >= 4)
    .map(card => ({ card, count: card.count }));

  const handleTrade = async (cardId: string) => {
    if (!user) return;
    
    setIsTrading(true);
    try {
      // Delete 3 copies of the card
      await deleteUserCards.mutateAsync({ userId: user.id, cardId, count: 3 });
      
      // Get 3 new random cards
      const newCards = await getRandomCards.mutateAsync({ count: 3 });
      
      // Collect the new cards
      for (const card of newCards) {
        await collectCard.mutateAsync({ userId: user.id, cardId: card.id });
      }
      
      toast.success('Échange réussi ! 3 nouvelles cartes ajoutées à votre collection.');
    } catch (error) {
      console.error('Trade error:', error);
      toast.error("Erreur lors de l'échange");
    } finally {
      setIsTrading(false);
    }
  };

  const handleCardClick = (card: GameCard, count: number) => {
    setSelectedCard(card);
    setSelectedCardCount(count);
    setDetailOpen(true);
  };

  const handleTradeFromDetail = async (cardId: string) => {
    await handleTrade(cardId);
    // Update the selected card count after trade
    setSelectedCardCount(prev => prev - 3);
  };

  const counts = {
    all: allCards.length,
    common: allCards.filter(c => c.rarity === 'common').length,
    rare: allCards.filter(c => c.rarity === 'rare').length,
    epic: allCards.filter(c => c.rarity === 'epic').length,
    legendary: allCards.filter(c => c.rarity === 'legendary').length,
  };

  const collectedCounts = {
    all: userCards.length,
    common: userCards.filter(c => c.rarity === 'common').length,
    rare: userCards.filter(c => c.rarity === 'rare').length,
    epic: userCards.filter(c => c.rarity === 'epic').length,
    legendary: userCards.filter(c => c.rarity === 'legendary').length,
  };

  const isLoading = authLoading || cardsLoading || userCardsLoading;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="pt-12 pb-6 px-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-xl text-foreground">Ma Collection</h1>
            <p className="text-sm text-muted-foreground">
              {userCards.length} / {allCards.length} cartes uniques ({totalCardsCollected} total)
            </p>
          </div>
        </div>

        {/* Rarity filter */}
        <div className="flex items-center justify-between gap-2">
          <RarityTabs 
            activeRarity={activeRarity} 
            onRarityChange={setActiveRarity}
            counts={counts}
            collectedCounts={collectedCounts}
          />
          
          <CardTradeDialog 
            eligibleCards={eligibleForTrade}
            onTrade={handleTrade}
            isTrading={isTrading}
          />
        </div>
      </header>

      {/* Collection book */}
      <main className="px-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : allCards.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Aucune carte disponible</p>
          </div>
        ) : (
          <CollectionBook 
            allCards={allCards}
            collectedCardIds={collectedCardIds}
            cardCountMap={cardCountMap}
            activeRarity={activeRarity}
            onCardClick={handleCardClick}
          />
        )}
      </main>

      {/* Card detail dialog */}
      <CardDetailDialog
        card={selectedCard}
        count={selectedCardCount}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onTrade={handleTradeFromDetail}
        isTrading={isTrading}
      />

      <Navigation />
    </div>
  );
};

export default Collection;
