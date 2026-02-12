import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      toast.error(t('shop.purchaseCanceled'));
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
        toast.success(t('shop.cardsReceived', { count: data.cardCount }));
        refetchCards();
      }
    } catch (error: any) {
      toast.error(t('shop.purchaseError'));
    } finally {
      setVerifyingPurchase(false);
    }
  };

  const handlePurchase = async (packId: string) => {
    if (!user) {
      toast.error(t('shop.mustBeConnected'));
      return;
    }

    setLoadingPackId(packId);

    try {
      const { data, error } = await supabase.functions.invoke('create-pack-checkout', {
        body: { packId }
      });

      if (error) throw error;

      if (data.url) {
        // Open in new tab to avoid iframe restrictions
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      toast.error(t('shop.paymentError'));
    } finally {
      setLoadingPackId(null);
    }
  };

  const handleTrade = async (card: UserCardWithCount): Promise<any[]> => {
    if (!user) {
      toast.error(t('shop.mustBeConnected'));
      return [];
    }

    const config = TRADE_CONFIG[card.rarity as Rarity];
    if (card.count < config.required) {
      toast.error(t('trade.needCards', { count: config.required }));
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

      toast.success(t('trade.tradeSuccess', { count: config.reward }));
      return newCards;
    } catch (error) {
      toast.error(t('trade.tradeError'));
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
              <h1 className="font-display text-2xl text-foreground">{t('shop.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('shop.loginRequired')}</p>
            </div>
          </div>
        </header>
        <main className="px-4">
          <p className="text-center text-muted-foreground py-12">
            {t('shop.loginRequiredMessage')}
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
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Store className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl text-foreground">{t('shop.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('shop.subtitle')}</p>
          </div>
        </div>
        {!cardsLoading && (
          <TradeOverviewDialog userCards={userCards} />
        )}
      </header>

      <main className="px-4 space-y-8">
        {verifyingPurchase ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">{t('shop.verifyingPurchase')}</p>
          </div>
        ) : (
          <>
            {/* Standard Packs */}
            <PackSection
              title={t('shop.standardPacks')}
              description={t('shop.standardPacksDesc')}
              packs={standardPacks}
              onPurchase={handlePurchase}
              isLoading={!!loadingPackId}
              loadingPackId={loadingPackId}
            />

            {/* Lucky Packs */}
            <PackSection
              title={t('shop.luckyPacks')}
              description={t('shop.luckyPacksDesc')}
              packs={luckyPacks}
              onPurchase={handlePurchase}
              isLoading={!!loadingPackId}
              loadingPackId={loadingPackId}
            />

            {/* Ultra Lucky Packs */}
            <PackSection
              title={t('shop.ultraPacks')}
              description={t('shop.ultraPacksDesc')}
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
              {t('shop.newCards')}
            </DialogTitle>
            <DialogDescription className="text-center">
              {t('shop.clickToReveal')}
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
                  isNew={!userCards.some(uc => uc.id === card.id)}
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
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Navigation />
    </div>
  );
};

export default Shop;
