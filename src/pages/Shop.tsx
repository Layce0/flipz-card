import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Navigation } from '@/components/Navigation';
import { PackSection } from '@/components/shop/PackSection';
import { TradeOverviewDialog } from '@/components/shop/TradeOverviewDialog';
import { PackRevealFlow } from '@/components/shop/PackRevealFlow';
import { Button } from '@/components/ui/button';
import { Store, Loader2 } from 'lucide-react';
import { getPacksByType, TRADE_CONFIG } from '@/types/pack';
import { Rarity } from '@/types/card';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCards, useTradeCards, UserCardWithCount } from '@/hooks/useCards';
import { RedeemCodeSection } from '@/components/shop/RedeemCodeSection';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';

const Shop = () => {
  const { user, isModerator } = useAuth();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: userCards = [], isLoading: cardsLoading, refetch: refetchCards } = useUserCards(user?.id);
  const deleteCards = useDeleteUserCards();
  const getRandomCards = useRandomCards();
  const tradeCards = useTradeCards();

  const [loadingPackId, setLoadingPackId] = useState<string | null>(null);
  const [isTrading, setIsTrading] = useState(false);
  const [purchasedCards, setPurchasedCards] = useState<any[]>([]);
  const [purchasedPackType, setPurchasedPackType] = useState<string>('standard');
  const [showPurchaseReward, setShowPurchaseReward] = useState(false);
  const [verifyingPurchase, setVerifyingPurchase] = useState(false);

  // Handle successful purchase return
  useEffect(() => {
    const success = searchParams.get('success');
    const sessionId = searchParams.get('session_id');

    if (success === 'true' && sessionId && !verifyingPurchase) {
      setVerifyingPurchase(true);
      verifyPurchase(sessionId);
      setSearchParams({});
    }

    if (searchParams.get('canceled') === 'true') {
      toast.error(t('shop.purchaseCanceled'));
      setSearchParams({});
    }
  }, [searchParams]);

  const verifyPurchase = async (sessionId: string) => {
    try {
      const { data, error } = await invokeEdgeFunction('verify-pack-purchase', {
        body: { sessionId }
      });

      if (error) throw error;

      if (data.cards && data.cards.length > 0) {
        setPurchasedCards(data.cards);
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

  const handlePurchase = useCallback(async (packId: string) => {
    if (!user) {
      toast.error(t('shop.mustBeConnected'));
      return;
    }

    setLoadingPackId(packId);
    const derivedPackType = packId.split('_')[0] || 'standard';

    try {
      if (isModerator) {
        // Moderators bypass Stripe — simulate payment directly
        const { data, error } = await invokeEdgeFunction('simulate-payment', {
          body: { packId }
        });

        if (error) throw error;

        if (data.cards && data.cards.length > 0) {
          setPurchasedCards(data.cards);
          setPurchasedPackType(derivedPackType);
          setShowPurchaseReward(true);
          toast.success(t('shop.cardsReceived', { count: data.cardCount }));
          refetchCards();
        }
      } else {
        const { data, error } = await invokeEdgeFunction('create-pack-checkout', {
          body: { packId }
        });

        if (error) throw error;

        if (data.url) {
          window.open(data.url, '_blank');
        }
      }
    } catch (error: any) {
      toast.error(t('shop.paymentError'));
    } finally {
      setLoadingPackId(null);
    }
  }, [user, isModerator, t, refetchCards]);

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
      const result = await tradeCards.mutateAsync({ cardId: card.id, rarity: card.rarity });

      toast.success(t('trade.tradeSuccess', { count: result.rewardCount }));
      return result.cards;
    } catch (error) {
      toast.error(t('trade.tradeError'));
      return [];
    } finally {
      setIsTrading(false);
    }
  };

  const handleClosePurchaseReveal = () => {
    setShowPurchaseReward(false);
    setPurchasedCards([]);
  };

  const standardPacks = useMemo(() => getPacksByType('standard'), []);
  const luckyPacks = useMemo(() => getPacksByType('lucky'), []);
  const ultraPacks = useMemo(() => getPacksByType('ultra'), []);

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
            <PackSection
              title={t('shop.standardPacks')}
              description={t('shop.standardPacksDesc')}
              packs={standardPacks}
              onPurchase={handlePurchase}
              isLoading={!!loadingPackId}
              loadingPackId={loadingPackId}
            />
            <PackSection
              title={t('shop.luckyPacks')}
              description={t('shop.luckyPacksDesc')}
              packs={luckyPacks}
              onPurchase={handlePurchase}
              isLoading={!!loadingPackId}
              loadingPackId={loadingPackId}
            />
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

        <RedeemCodeSection userCards={userCards} />
      </main>

      {/* Purchase Reward - now uses PackRevealFlow with sachet animation */}
      <PackRevealFlow
        cards={purchasedCards}
        isOpen={showPurchaseReward}
        onClose={handleClosePurchaseReveal}
        packType={purchasedPackType as any}
      />

      <Navigation />
    </div>
  );
};

export default Shop;
