import { useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';

declare const CdvPurchase: any;

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

/**
 * Extract the App Store receipt from a CdvPurchase transaction.
 * cordova-plugin-purchase v13 places it in different locations depending
 * on the version and transaction state — we try all known paths.
 */
const extractReceiptData = (transaction: any): string | null => {
  return (
    transaction?.nativePurchase?.appStoreReceipt ||
    transaction?.receipt?.nativeData?.appStoreReceipt ||
    transaction?.nativePurchase?.receipt ||
    transaction?.receipt ||
    transaction?.transactionReceipt ||
    null
  );
};

export const useAppleBilling = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [loadingPackId, setLoadingPackId] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});

  const isNativeIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

  // Tracks whether the store has already been initialized to prevent duplicate inits.
  const initializedRef = useRef(false);

  // A pending purchase resolver/rejecter so the single global listener can
  // communicate back to the per-purchase Promise.
  const pendingRef = useRef<{
    packId: string;
    productId: string;
    resolve: () => void;
    reject: (err: any) => void;
    onSuccess: (cards: any[], packType: string) => void;
    finished: boolean;
  } | null>(null);

  useEffect(() => {
    if (!isNativeIOS || typeof CdvPurchase === 'undefined') return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {
      // 1. Register all products
      const productsToRegister = Object.values(PACK_TO_PRODUCT).map(productId => ({
        id: productId,
        type: CdvPurchase.ProductType.CONSUMABLE,
        platform: CdvPurchase.Platform.APPLE_APPSTORE,
      }));
      CdvPurchase.store.register(productsToRegister);

      // 2. Register the approved listener ONCE — handles all purchases
      CdvPurchase.store.when().approved(async (transaction: any) => {
        const pending = pendingRef.current;
        if (!pending || pending.finished) {
          // No active purchase — finish stale transactions safely
          try { transaction.finish(); } catch (_) {}
          return;
        }

        // Only handle the product we're currently purchasing
        const txProductId =
          transaction.products?.[0]?.id ||
          transaction.productId ||
          transaction.id;

        if (txProductId && txProductId !== pending.productId) {
          // Not our transaction; let it pass
          return;
        }

        pending.finished = true;

        const receiptData = extractReceiptData(transaction);
        const transactionId =
          transaction.transactionIdentifier ||
          transaction.transactionId ||
          transaction.id;

        if (!receiptData) {
          try { transaction.finish(); } catch (_) {}
          pending.reject(new Error('Apple receipt missing'));
          return;
        }

        try {
          const { data, error } = await invokeEdgeFunction('verify-apple-purchase', {
            body: {
              packId: pending.packId,
              receiptData,
              productId: pending.productId,
              userId: user?.id,
              transactionId,
            },
          });

          if (error) throw error;

          try { transaction.finish(); } catch (_) {}

          if (data?.alreadyProcessed) {
            toast.info(t('shop.alreadyProcessed', 'Achat déjà traité'));
          } else if (data?.cards && data.cards.length > 0) {
            const derivedPackType = pending.packId.split('_')[0] || 'standard';
            toast.success(t('shop.cardsReceived', { count: data.cardCount }));
            pending.onSuccess(data.cards, derivedPackType);
          }

          pending.resolve();
        } catch (err) {
          try { transaction.finish(); } catch (_) {}
          pending.reject(err);
        }
      });

      // 3. Register the cancelled listener ONCE
      CdvPurchase.store.when().cancelled(() => {
        const pending = pendingRef.current;
        if (!pending || pending.finished) return;
        pending.finished = true;
        pending.reject({ code: 'USER_CANCELED' });
      });

      // 4. Fetch localised prices as products load
      CdvPurchase.store.when().updated((product: any) => {
        if (product.pricing?.price) {
          const packId = Object.keys(PACK_TO_PRODUCT).find(
            key => PACK_TO_PRODUCT[key] === product.id
          );
          if (packId) {
            setPrices(prev =>
              prev[packId] === product.pricing.price
                ? prev
                : { ...prev, [packId]: product.pricing.price }
            );
          }
        }
      });

      // 5. Initialise — products will load asynchronously
      CdvPurchase.store.initialize([CdvPurchase.Platform.APPLE_APPSTORE]);
    } catch (e) {
      console.error('CdvPurchase init error', e);
    }
  }, [isNativeIOS]);

  const purchase = useCallback(
    async (packId: string, onSuccess: (cards: any[], packType: string) => void) => {
      if (!user) {
        toast.error(t('shop.mustBeConnected'));
        return;
      }

      if (!isNativeIOS || typeof CdvPurchase === 'undefined') {
        toast.error('Achats Apple non disponibles');
        return;
      }

      const productId = PACK_TO_PRODUCT[packId];
      if (!productId) {
        toast.error('Produit inconnu');
        return;
      }

      const product = CdvPurchase.store.get(productId, CdvPurchase.Platform.APPLE_APPSTORE);
      if (!product) {
        toast.error("Produit non disponible sur l'App Store. Vérifiez votre connexion.");
        return;
      }

      setLoading(true);
      setLoadingPackId(packId);

      try {
        await new Promise<void>((resolve, reject) => {
          // Register pending purchase context for the global listener
          pendingRef.current = {
            packId,
            productId,
            resolve,
            reject,
            onSuccess,
            finished: false,
          };

          // Trigger the purchase — the global .approved() listener will handle the result
          const offer = product.getOffer();
          if (!offer) {
            pendingRef.current = null;
            reject(new Error("Aucune offre disponible pour ce produit"));
            return;
          }
          offer.order().catch((err: any) => {
            if (pendingRef.current && !pendingRef.current.finished) {
              pendingRef.current.finished = true;
              pendingRef.current = null;
              reject(err);
            }
          });
        });
      } catch (err: any) {
        const code = err?.code || err?.message || 'UNKNOWN';
        if (code === 'USER_CANCELED' || /cancel/i.test(String(code))) {
          toast.error(t('shop.purchaseCanceled'));
        } else {
          const debugMsg = err?.message || err?.code || JSON.stringify(err);
          console.error('Apple Billing error:', err);
          toast.error(`${t('shop.paymentError')} [${debugMsg}]`);
        }
      } finally {
        pendingRef.current = null;
        setLoading(false);
        setLoadingPackId(null);
      }
    },
    [user, t, isNativeIOS],
  );

  return { purchase, loading, loadingPackId, isNativeIOS, prices };
};
