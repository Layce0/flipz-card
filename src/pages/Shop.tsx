import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';
import { PackSection } from '@/components/shop/PackSection';
import { TradeOverviewDialog } from '@/components/shop/TradeOverviewDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Store, Loader2, Sparkles } from 'lucide-react';
import { getPacksByType, TRADE_CONFIG } from '@/types/pack';
import { Rarity } from '@/types/card';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCards, useDeleteUserCards, useRandomCards, useCollectCard, UserCardWithCount } from '@/hooks/useCards';
import { supabase } from '@/integrations/supabase/client';
import { MysteryCard } from '@/components/MysteryCard';

const Shop = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: userCards = [], isLoading: cardsLoading, refetch: refetchCards } = useUserCards(user?.id);
  const deleteCards = useDeleteUserCards();
  const getRandomCards = useRandomCards();
  const collectCard = useCollectCard();

  const [loadingPackId, setLoadingPackId] = useState<string | null>(null);
  const [isTrading, setIsTrading] = useState(false);
  const [purchasedCards, setPurchasedCards] = useState<any[]>([]);
  const [showPurchaseReward, setShowPurchaseReward] = useState(false);
  const [revealedCards, setRevealedCards] = useState<Set<number>>(new Set());
  const [verifyingPurchase, setVerifyingPurchase] = useState(false);

  // Handle successful purchase return
  useEffect(() => {
    const success = searchParams.get('success');
    const sessionId = searchParams.get('session_id');
    const packId = searchParams.get('pack');

    if (success === 'true' && sessionId && !verifyingPurchase) {
      setVerifyingPurchase(true);
      verifyPurchase(sessionId);
      // Clear URL params
      setSearchParams({});
    }

    if (searchParams.get('canceled') === 'true') {
      toast.error('Achat annulé');
      setSearchParams({});
    }
  }, [searchParams]);

  const verifyPurchase = async (sessionId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-pack-purchase', {
        body: { sessionId }
      });

      if (error) throw error;

      if (data.cards && data.cards.length > 0) {
        setPurchasedCards(data.cards);
        setRevealedCards(new Set());
        setShowPurchaseReward(true);
        toast.success(`Vous avez reçu ${data.cardCount} cartes !`);
        refetchCards();
      }
    } catch (error: any) {
      toast.error('Erreur lors de la vérification de l\'achat');
    } finally {
      setVerifyingPurchase(false);
    }
  };

  const handlePurchase = async (packId: string) => {
    if (!user) {
      toast.error('Vous devez être connecté pour acheter');
      return;
    }

    setLoadingPackId(packId);

    try {
      const { data, error } = await supabase.functions.invoke('create-pack-checkout', {
        body: { packId }
      });

      if (error) throw error;

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast.error('Erreur lors de la création du paiement');
    } finally {
      setLoadingPackId(null);
    }
  };

  const handleTrade = async (card: UserCardWithCount): Promise<any[]> => {
    if (!user) {
      toast.error('Vous devez être connecté');
      return [];
    }

    const config = TRADE_CONFIG[card.rarity as Rarity];
    if (card.count < config.required) {
      toast.error(`Vous avez besoin de ${config.required} cartes identiques`);
      return [];
    }

    setIsTrading(true);

    try {
      // Delete required cards (minus what they keep)
      const cardsToDelete = config.required - config.keep;
      await deleteCards.mutateAsync({
        userId: user.id,
        cardId: card.id,
        count: cardsToDelete,
      });

      // Get random reward cards
      const newCards = await getRandomCards.mutateAsync({ count: config.reward });

      // Collect all new cards
      for (const newCard of newCards) {
        await collectCard.mutateAsync({ userId: user.id, cardId: newCard.id });
      }

      toast.success(`Échange réussi ! Vous avez reçu ${config.reward} cartes !`);
      return newCards;
    } catch (error) {
      toast.error("Erreur lors de l'échange");
      return [];
    } finally {
      setIsTrading(false);
    }
  };

  const handleRevealCard = (index: number) => {
    setRevealedCards(prev => new Set([...prev, index]));
  };

  const standardPacks = getPacksByType('standard');
  const luckyPacks = getPacksByType('lucky');
  const ultraPacks = getPacksByType('ultra');

  if (!user) {
    return (
      <div className="min-h-screen pb-24">
        <header className="pt-12 pb-6 px-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Store className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl text-foreground">Boutique</h1>
              <p className="text-sm text-muted-foreground">Connectez-vous pour accéder</p>
            </div>
          </div>
        </header>
        <main className="px-4">
          <p className="text-center text-muted-foreground py-12">
            Vous devez être connecté pour accéder à la boutique.
          </p>
        </main>
        <Navigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="pt-12 pb-6 px-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Store className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl text-foreground">Boutique</h1>
              <p className="text-sm text-muted-foreground">Achetez des packs et échangez vos cartes</p>
            </div>
          </div>
          {!cardsLoading && (
            <TradeOverviewDialog userCards={userCards} />
          )}
        </div>
      </header>

      <main className="px-4 space-y-8">
        {verifyingPurchase ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Vérification de votre achat...</p>
          </div>
        ) : (
          <>
            {/* Standard Packs */}
            <PackSection
              title="Packs Standard"
              description="Probabilités de base pour toutes les raretés"
              packs={standardPacks}
              onPurchase={handlePurchase}
              isLoading={!!loadingPackId}
              loadingPackId={loadingPackId}
            />

            {/* Lucky Packs */}
            <PackSection
              title="Packs Chanceux"
              description="x2 de chances pour les cartes épiques et légendaires"
              packs={luckyPacks}
              onPurchase={handlePurchase}
              isLoading={!!loadingPackId}
              loadingPackId={loadingPackId}
            />

            {/* Ultra Lucky Packs */}
            <PackSection
              title="Packs Ultra Chanceux"
              description="x5 de chances pour les cartes épiques et légendaires"
              packs={ultraPacks}
              onPurchase={handlePurchase}
              isLoading={!!loadingPackId}
              loadingPackId={loadingPackId}
            />
          </>
        )}
      </main>

      {/* Purchase Reward Dialog */}
      <Dialog open={showPurchaseReward} onOpenChange={setShowPurchaseReward}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-center flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Vos nouvelles cartes !
            </DialogTitle>
            <DialogDescription className="text-center">
              Cliquez sur les cartes pour les révéler
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3 py-4 max-h-[60vh] overflow-y-auto">
            {purchasedCards.map((card, index) => (
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
              onClick={() => setShowPurchaseReward(false)}
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
