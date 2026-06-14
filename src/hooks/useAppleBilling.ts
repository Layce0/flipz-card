import { useState, useCallback, useEffect } from 'react';
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

export const useAppleBilling = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [loadingPackId, setLoadingPackId] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});

  const isNativeIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

  useEffect(() => {
    if (!isNativeIOS || typeof CdvPurchase === 'undefined') return;

    try {
      const productsToRegister = Object.values(PACK_TO_PRODUCT).map(productId => ({
        id: productId,
        type: CdvPurchase.ProductType.CONSUMABLE,
        platform: CdvPurchase.Platform.APPLE_APPSTORE
      }));

      CdvPurchase.store.register(productsToRegister);

      CdvPurchase.store.when().updated((product: any) => {
        if (product.pricing && product.pricing.price) {
          setPrices(prev => {
             // Find packId for this productId
             const packId = Object.keys(PACK_TO_PRODUCT).find(key => PACK_TO_PRODUCT[key] === product.id);
             if (packId && prev[packId] !== product.pricing.price) {
                return { ...prev, [packId]: product.pricing.price };
             }
             return prev;
          });
        }
      });

      CdvPurchase.store.initialize([CdvPurchase.Platform.APPLE_APPSTORE]);
    } catch (e) {
      console.error("CdvPurchase init error", e);
    }
  }, [isNativeIOS]);

  const purchase = useCallback(
    async (packId: string, onSuccess: (cards: any[], packType: string) => void) => {
      if (!user) {
        toast.error(t('shop.mustBeConnected'));
        return;
      }

      if (!isNativeIOS || typeof CdvPurchase === 'undefined') {
         toast.error("Achats Apple non disponibles");
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
        await new Promise<void>((resolve, reject) => {
          let hasFinished = false;

          CdvPurchase.store.when()
            .approved(async (transaction: any) => {
              if (hasFinished) return;
              hasFinished = true;
              
              // Depending on CdvPurchase version, the receipt can be in different places.
              // In iOS it's usually the full App Store receipt.
              const receiptData = transaction.receipt || transaction.nativePurchase?.receipt || transaction.nativePurchase?.appStoreReceipt || transaction.transactionReceipt;
              const transactionId = transaction.transactionId || transaction.id;

              if (!receiptData) {
                 transaction.finish();
                 reject(new Error("Reçu Apple manquant"));
                 return;
              }

              try {
                const { data, error } = await invokeEdgeFunction('verify-apple-purchase', {
                  body: {
                    packId,
                    receiptData,
                    productId,
                    userId: user.id,
                    transactionId
                  },
                });

                if (error) throw error;

                transaction.finish();

                if (data?.alreadyProcessed) {
                  toast.info(t('shop.alreadyProcessed', 'Achat déjà traité'));
                } else if (data?.cards && data.cards.length > 0) {
                  const derivedPackType = packId.split('_')[0] || 'standard';
                  toast.success(t('shop.cardsReceived', { count: data.cardCount }));
                  onSuccess(data.cards, derivedPackType);
                }
                resolve();
              } catch (err) {
                 transaction.finish();
                 reject(err);
              }
            })
            .cancelled(() => {
              if (hasFinished) return;
              hasFinished = true;
              reject({ code: 'USER_CANCELED' });
            })
            .error((err: any) => {
               if (hasFinished) return;
               hasFinished = true;
               reject(err);
            });

          const product = CdvPurchase.store.get(productId, CdvPurchase.Platform.APPLE_APPSTORE);
          if (!product) {
             reject(new Error("Produit non disponible sur l'App Store"));
             return;
          }
          product.getOffer()?.order();
        });

      } catch (err: any) {
        const code = err?.code || err?.message || 'UNKNOWN';
        const debugMsg = err?.message || err?.code || JSON.stringify(err);
        if (code === 'USER_CANCELED' || /cancel/i.test(String(code))) {
          toast.error(t('shop.purchaseCanceled'));
        } else {
          console.error('Apple Billing error:', err);
          toast.error(`${t('shop.paymentError')} [${debugMsg}]`);
        }
      } finally {
        setLoading(false);
        setLoadingPackId(null);
      }
    },
    [user, t, isNativeIOS],
  );

  return { purchase, loading, loadingPackId, isNativeIOS, prices };
};
