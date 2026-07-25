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

/**
 * Wait for a product to appear in the store after initialization.
 * The sandbox environment can be significantly slower than production,
 * so we retry up to maxAttempts times with a delay between each.
 */
const waitForProduct = (
  productId: string,
  maxAttempts = 8,
  delayMs = 750
): Promise<any> => {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const attempt = () => {
      attempts++;
      const product = CdvPurchase.store.get(productId, CdvPurchase.Platform.APPLE_APPSTORE);
      if (product) {
        resolve(product);
        return;
      }
      if (attempts >= maxAttempts) {
        reject(new Error(`Product "${productId}" not found after ${maxAttempts} attempts`));
        return;
      }
      setTimeout(attempt, delayMs);
    };

    attempt();
  });
};

/** Maximum time (ms) to wait for the store to become ready before unblocking the UI. */
const STORE_INIT_TIMEOUT_MS = 15_000;

export const useAppleBilling = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [loadingPackId, setLoadingPackId] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  // True once CdvPurchase.store fires its "ready" event — products are loaded.
  const [isStoreReady, setIsStoreReady] = useState(false);
  // Non-null when the store init failed or timed out — contains the error reason.
  const [storeError, setStoreError] = useState<string | null>(null);

  const isNativeIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

  // Tracks whether the store has already been initialized to prevent duplicate inits.
  const initializedRef = useRef(false);
  // Safety timeout ref — cleared when .ready() fires.
  const initTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  /** Core initialization logic — extracted so retryInit can reuse it. */
  const initStore = useCallback(() => {
    if (typeof CdvPurchase === 'undefined') {
      console.warn('CdvPurchase is not available');
      setStoreError('plugin_unavailable');
      setIsStoreReady(true); // Unblock UI — purchases will fail individually with a clear message
      return;
    }

    // Reset states for fresh / retry initialization
    setStoreError(null);
    setIsStoreReady(false);

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

      // 5. Mark the store as ready once all products have been fetched from Apple.
      //    This fires after initialize() completes and products are available.
      CdvPurchase.store.when().ready(() => {
        if (initTimeoutRef.current) {
          clearTimeout(initTimeoutRef.current);
          initTimeoutRef.current = null;
        }
        setStoreError(null);
        setIsStoreReady(true);
      });

      // 5b. Listen for store-level errors so we can unblock the UI
      CdvPurchase.store.when().error((err: any) => {
        console.error('CdvPurchase store error:', err);
        // Don't block the UI — individual purchases handle their own errors
        if (!isStoreReady) {
          setStoreError(err?.message || 'store_error');
          setIsStoreReady(true);
        }
      });

      // 6. Safety timeout — if .ready() never fires, unblock the UI after 15 seconds.
      //    This is the CRITICAL FIX for the Apple rejection: without this, the store
      //    spinner would spin forever in the sandbox environment.
      if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
      initTimeoutRef.current = setTimeout(() => {
        setIsStoreReady(current => {
          if (!current) {
            console.warn(`Apple store init timed out after ${STORE_INIT_TIMEOUT_MS}ms — forcing ready`);
            setStoreError('timeout');
            return true; // Unblock UI
          }
          return current;
        });
      }, STORE_INIT_TIMEOUT_MS);

      // 7. Initialise — products will load asynchronously; .ready() fires when done
      CdvPurchase.store.initialize([CdvPurchase.Platform.APPLE_APPSTORE]);
    } catch (e: any) {
      console.error('CdvPurchase init error', e);
      setStoreError(e?.message || 'init_failed');
      setIsStoreReady(true); // Unblock UI even on crash
    }
  }, [isNativeIOS, user?.id, t]);

  // Auto-initialize on first mount for native iOS
  useEffect(() => {
    if (!isNativeIOS) return;
    if (initializedRef.current) return;
    initializedRef.current = true;
    initStore();

    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
    };
  }, [isNativeIOS, initStore]);

  /** Allow the Shop UI to retry initialization after a timeout or error. */
  const retryInit = useCallback(() => {
    initializedRef.current = false;
    initStore();
    initializedRef.current = true;
  }, [initStore]);

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

      setLoading(true);
      setLoadingPackId(packId);

      try {
        // Wait for the product to be available in the store.
        // In the sandbox the store can take several seconds to fully load products
        // after initialize() completes, so we retry with a backoff instead of
        // failing immediately.
        let product: any;
        try {
          product = await waitForProduct(productId);
        } catch (_) {
          toast.error(
            t('shop.productNotAvailable', "Ce produit n'est pas encore disponible. Réessayez dans quelques secondes.")
          );
          return;
        }

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
            reject(new Error('Aucune offre disponible pour ce produit'));
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

  return { purchase, loading, loadingPackId, isNativeIOS, prices, isStoreReady, storeError, retryInit };
};
