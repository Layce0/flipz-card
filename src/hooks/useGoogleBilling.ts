import { useState, useCallback, useEffect } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';

interface BillingPluginInterface {
  purchaseProduct(options: { productId: string }): Promise<{
    purchaseToken: string;
    productId: string;
    orderId: string;
  }>;
  getProducts(options: { productIds: string[] }): Promise<{
    prices: Record<string, string>;
  }>;
}

const BillingPlugin = registerPlugin<BillingPluginInterface>('BillingPlugin');

// Maps packId (from PACK_CONFIGS) to Google Play product ID
const PACK_TO_PRODUCT: Record<string, string> = {
  standard_5: 'pack_standard_5',
  standard_10: 'pack_standard_10',
  standard_20: 'pack_standard_20',
  standard_50: 'pack_standard_50',
  lucky_5: 'pack_lucky_5',
  lucky_10: 'pack_lucky_10',
  lucky_20: 'pack_lucky_20',
  lucky_50: 'pack_lucky_50',
  ultra_5: 'pack_ultra_5',
  ultra_10: 'pack_ultra_10',
  ultra_20: 'pack_ultra_20',
  ultra_50: 'pack_ultra_50',
};

export const useGoogleBilling = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [loadingPackId, setLoadingPackId] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});

  const isNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

  useEffect(() => {
    if (!isNative) return;

    const fetchPrices = async () => {
      try {
        const productIds = Object.values(PACK_TO_PRODUCT);
        const result = await BillingPlugin.getProducts({ productIds });
        if (result && result.prices) {
          // Inverse map to store prices by packId
          const localPrices: Record<string, string> = {};
          Object.entries(PACK_TO_PRODUCT).forEach(([packId, productId]) => {
            if (result.prices[productId]) {
              localPrices[packId] = result.prices[productId];
            }
          });
          setPrices(localPrices);
        }
      } catch (err) {
        console.error('Failed to fetch Google Play prices:', err);
      }
    };

    fetchPrices();
  }, [isNative]);

  const purchase = useCallback(
    async (packId: string, onSuccess: (cards: any[], packType: string) => void) => {
      if (!user) {
        toast.error(t('shop.mustBeConnected'));
        return;
      }

      const productId = PACK_TO_PRODUCT[packId];
      if (!productId) {
        toast.error('Produit inconnu');
        return;
      }

      setLoading(true);
      setLoadingPackId(packId);

      try {
        // 1. Launch Google Play billing flow via native plugin
        const result = await BillingPlugin.purchaseProduct({ productId });

        if (!result?.purchaseToken) {
          throw new Error('Aucun token de paiement reçu');
        }

        // 2. Verify purchase on backend & credit cards
        const { data, error } = await invokeEdgeFunction('verify-google-purchase', {
          body: {
            packId,
            purchaseToken: result.purchaseToken,
            productId: result.productId,
            userId: user.id,
          },
        });

        if (error) throw error;

        if (data?.alreadyProcessed) {
          toast.info(t('shop.alreadyProcessed', 'Achat déjà traité'));
        } else if (data?.cards && data.cards.length > 0) {
          const derivedPackType = packId.split('_')[0] || 'standard';
          toast.success(t('shop.cardsReceived', { count: data.cardCount }));
          onSuccess(data.cards, derivedPackType);
        }
      } catch (err: any) {
        const code = err?.code || err?.message || 'UNKNOWN';
        const debugMsg = err?.message || err?.code || JSON.stringify(err);
        if (code === 'USER_CANCELED' || /cancel/i.test(String(code))) {
          toast.error(t('shop.purchaseCanceled'));
        } else {
          console.error('Google Billing error:', err);
          toast.error(`${t('shop.paymentError')} [${debugMsg}]`);
        }
      } finally {
        setLoading(false);
        setLoadingPackId(null);
      }
    },
    [user, t],
  );

  return { purchase, loading, loadingPackId, isNative, prices };
};
