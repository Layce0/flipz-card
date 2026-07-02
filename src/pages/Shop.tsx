import { useState, useEffect, useCallback, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Navigation } from '@/components/Navigation';
import { PackSection } from '@/components/shop/PackSection';
import { TradeOverviewDialog } from '@/components/shop/TradeOverviewDialog';
import { PackRevealFlow } from '@/components/shop/PackRevealFlow';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';
import { getPacksByType, TRADE_CONFIG } from '@/types/pack';
import { Rarity } from '@/types/card';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCards, useTradeCards, UserCardWithCount } from '@/hooks/useCards';
import { RedeemCodeSection } from '@/components/shop/RedeemCodeSection';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { useGoogleBilling } from '@/hooks/useGoogleBilling';
import { useAppleBilling } from '@/hooks/useAppleBilling';
import { PackProbabilitiesDialog } from '@/components/shop/PackProbabilitiesDialog';

const Shop = () => {
  const { user, isModerator } = useAuth();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: userCards = [], isLoading: cardsLoading, refetch: refetchCards } = useUserCards(user?.id);
  const tradeCards = useTradeCards();
  const googleBilling = useGoogleBilling();
  const appleBilling = useAppleBilling();

  const [loadingPackId, setLoadingPackId] = useState<string | null>(null);
  const [isTrading, setIsTrading] = useState(false);
  const [purchasedCards, setPurchasedCards] = useState<any[]>([]);
  const [purchasedPackType, setPurchasedPackType] = useState<string>('standard');
  const [purchasedPackId, setPurchasedPackId] = useState<string>('');
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

    const derivedPackType = packId.split('_')[0] || 'standard';

    // Native iOS: use Apple Billing
    if (appleBilling.isNativeIOS) {
      await appleBilling.purchase(packId, (cards, packType) => {
        setPurchasedCards(cards);
        setPurchasedPackType(packType);
        setPurchasedPackId(packId);
        setShowPurchaseReward(true);
        refetchCards();
      });
      return;
    }

    // Native Android: use Google Play Billing
    if (googleBilling.isNative) {
      await googleBilling.purchase(packId, (cards, packType) => {
        setPurchasedCards(cards);
        setPurchasedPackType(packType);
        setPurchasedPackId(packId);
        setShowPurchaseReward(true);
        refetchCards();
      });
      return;
    }

    // Web / Moderator flow
    setLoadingPackId(packId);

    try {
      if (isModerator) {
        const { data, error } = await invokeEdgeFunction('simulate-payment', {
          body: { packId }
        });

        if (error) throw error;

        if (data.cards && data.cards.length > 0) {
          setPurchasedCards(data.cards);
          setPurchasedPackType(derivedPackType);
          setPurchasedPackId(packId);
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
  }, [user, isModerator, t, refetchCards, googleBilling]);

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
              <Sparkles className="w-6 h-6 text-primary" />
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
    <div className="min-h-screen pb-24 relative">
      {/* Ambient background orbs for glassmorphism */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="fixed top-[40%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[100px] pointer-events-none" />
      <div className="fixed bottom-[0%] left-[20%] w-[50%] h-[50%] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative pt-12 pb-4 px-4 bg-transparent border-b border-white/10">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center glow-gold">
            <ShoppingBag className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold text-gradient-gold">{t('shop.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('shop.subtitle')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!cardsLoading && <TradeOverviewDialog userCards={userCards} />}
          <PackProbabilitiesDialog />
        </div>
      </header>

      <main className="px-4 space-y-8 mt-6 relative z-10">
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
              isLoading={!!loadingPackId || googleBilling.loading || appleBilling.loading}
              loadingPackId={loadingPackId || googleBilling.loadingPackId || appleBilling.loadingPackId}
              localPrices={{ ...googleBilling.prices, ...appleBilling.prices }}
            />
            <PackSection
              title={t('shop.luckyPacks')}
              description={t('shop.luckyPacksDesc')}
              packs={luckyPacks}
              onPurchase={handlePurchase}
              isLoading={!!loadingPackId || googleBilling.loading || appleBilling.loading}
              loadingPackId={loadingPackId || googleBilling.loadingPackId || appleBilling.loadingPackId}
              localPrices={{ ...googleBilling.prices, ...appleBilling.prices }}
            />
            <PackSection
              title={t('shop.ultraPacks')}
              description={t('shop.ultraPacksDesc')}
              packs={ultraPacks}
              onPurchase={handlePurchase}
              isLoading={!!loadingPackId || googleBilling.loading || appleBilling.loading}
              loadingPackId={loadingPackId || googleBilling.loadingPackId || appleBilling.loadingPackId}
              localPrices={{ ...googleBilling.prices, ...appleBilling.prices }}
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
        packId={purchasedPackId}
      />

      <Navigation />
    </div>
  );
};

export default Shop;
