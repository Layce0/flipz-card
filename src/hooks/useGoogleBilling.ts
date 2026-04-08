import { useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';

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

const ALL_PRODUCT_IDS = Object.values(PACK_TO_PRODUCT);

export const useGoogleBilling = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [loadingPackId, setLoadingPackId] = useState<string | null>(null);
  const storeInitialized = useRef(false);
  const pendingCallback = useRef<((cards: any[], packType: string) => void) | null>(null);
  const pendingPackId = useRef<string | null>(null);

  const isNative = Capacitor.isNativePlatform();

  // Initialize CdvPurchase store on native
  useEffect(() => {
    if (!isNative || storeInitialized.current) return;

    const initStore = () => {
      const CdvPurchase = (window as any).CdvPurchase;
      if (!CdvPurchase?.store) {
        console.warn('CdvPurchase.store not available yet');
        return;
      }

      const store = CdvPurchase.store;
      storeInitialized.current = true;

      // Register all products
      ALL_PRODUCT_IDS.forEach((productId) => {
        store.register({
          id: productId,
          platform: CdvPurchase.Platform.GOOGLE_PLAY,
          type: CdvPurchase.ProductType.CONSUMABLE,
        });
      });

      // Listen for approved transactions → verify on backend
      store.when().approved(async (transaction: any) => {
        const receipt = transaction.parentReceipt;
        const purchaseToken = receipt?.purchaseToken || transaction.purchaseToken || transaction.nativePurchase?.purchaseToken;
        const productId = transaction.products?.[0]?.id || transaction.productId;
        const packId = pendingPackId.current;

        if (!purchaseToken || !productId || !packId) {
          console.error('Missing purchase data', { purchaseToken, productId, packId });
          transaction.finish();
          setLoading(false);
          setLoadingPackId(null);
          return;
        }

        try {
          const { data, error } = await invokeEdgeFunction('verify-google-purchase', {
            body: {
              packId,
              purchaseToken,
              productId,
              userId: user?.id,
            },
          });

          if (error) throw error;

          if (data?.alreadyProcessed) {
            toast.info(t('shop.alreadyProcessed', 'Achat déjà traité'));
          } else if (data?.cards && data.cards.length > 0) {
            const derivedPackType = packId.split('_')[0] || 'standard';
            toast.success(t('shop.cardsReceived', { count: data.cardCount }));
            pendingCallback.current?.(data.cards, derivedPackType);
          }
        } catch (err) {
          console.error('verify-google-purchase error:', err);
          toast.error(t('shop.paymentError'));
        } finally {
          transaction.finish();
          setLoading(false);
          setLoadingPackId(null);
          pendingCallback.current = null;
          pendingPackId.current = null;
        }
      });

      // Listen for cancelled / error
      store.when().cancelled(() => {
        toast.error(t('shop.purchaseCanceled'));
        setLoading(false);
        setLoadingPackId(null);
        pendingCallback.current = null;
        pendingPackId.current = null;
      });

      store.error((err: any) => {
        console.error('CdvPurchase error:', err);
        // Don't toast on every error – some are informational
      });

      store.initialize([CdvPurchase.Platform.GOOGLE_PLAY]);
    };

    // CdvPurchase may load after deviceready
    if ((window as any).CdvPurchase?.store) {
      initStore();
    } else {
      document.addEventListener('deviceready', initStore, { once: true });
    }
  }, [isNative, user, t]);

  const purchase = useCallback(async (
    packId: string,
    onSuccess: (cards: any[], packType: string) => void,
  ) => {
    if (!user) {
      toast.error(t('shop.mustBeConnected'));
      return;
    }

    const productId = PACK_TO_PRODUCT[packId];
    if (!productId) {
      toast.error('Produit inconnu');
      return;
    }

    const CdvPurchase = (window as any).CdvPurchase;
    if (!CdvPurchase?.store) {
      toast.error('Store non disponible');
      return;
    }

    setLoading(true);
    setLoadingPackId(packId);
    pendingCallback.current = onSuccess;
    pendingPackId.current = packId;

    try {
      const offer = CdvPurchase.store.get(productId, CdvPurchase.Platform.GOOGLE_PLAY)?.getOffer();
      if (!offer) {
        throw new Error(`Offer not found for ${productId}`);
      }
      await CdvPurchase.store.order(offer);
      // The approved listener handles the rest
    } catch (err: any) {
      console.error('Google Billing order error:', err);
      toast.error(t('shop.paymentError'));
      setLoading(false);
      setLoadingPackId(null);
      pendingCallback.current = null;
      pendingPackId.current = null;
    }
  }, [user, t]);

  return { purchase, loading, loadingPackId, isNative };
};
