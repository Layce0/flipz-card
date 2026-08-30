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
  lucky_5: 'Pack_lucky_5',
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
  const candidates = [
    // cordova-plugin-purchase v13 (StoreKit 1): the application receipt is
    // carried by the transaction's parent SKApplicationReceipt.
    transaction?.parentReceipt?.nativeData?.appStoreReceipt,
    transaction?.receipt?.nativeData?.appStoreReceipt,
    transaction?.nativePurchase?.appStoreReceipt,
    transaction?.nativePurchase?.receipt,
    transaction?.transactionReceipt,
    // Keep legacy shapes last, but never send a Receipt object to the backend.
    transaction?.receipt,
  ];

  return candidates.find(
    (candidate): candidate is string =>
      typeof candidate === 'string' && candidate.trim().length > 0
  ) ?? null;
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
  // Tracks whether CdvPurchase listeners have already been registered.
  // CdvPurchase stacks listeners on every when() call, so we must register them once only.
  const listenersRegisteredRef = useRef(false);

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

    // 1. Register all products
    try {
      const productsToRegister = Object.values(PACK_TO_PRODUCT).map(productId => ({
        id: productId,
        type: CdvPurchase.ProductType.CONSUMABLE,
        platform: CdvPurchase.Platform.APPLE_APPSTORE,
      }));
      CdvPurchase.store.register(productsToRegister);
    } catch (e: any) {
      console.error('CdvPurchase register error', e);
    }

    // 2. Register event listeners (cordova-plugin-purchase v13 `When` API).
    //    NOTE: `When` has no `cancelled`, `ready` or `error` methods — those live
    //    on `store` itself. Each registration is guarded so a failure never
    //    prevents store.initialize() from running.
    //
    //    IMPORTANT: CdvPurchase stacks listeners on every when() call — never
    //    register them more than once per app lifecycle or the approved() handler
    //    will fire multiple times per transaction.
    if (!listenersRegisteredRef.current) {
      listenersRegisteredRef.current = true;
      try {
        CdvPurchase.store
          .when()
          .productUpdated((product: any) => {
            if (product?.pricing?.price) {
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
          })
          .approved(async (transaction: any) => {
            const pending = pendingRef.current;
            if (!pending || pending.finished) {
              // Never consume an approved transaction without server verification.
              // StoreKit will redeliver it when the app has an active purchase flow.
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

            // Build transactionId — try all known StoreKit field names.
            // Fall back to a timestamp-based ID rather than undefined so the
            // server validation never rejects with "missing parameters".
            const transactionId =
              transaction.transactionIdentifier ||
              transaction.transactionId ||
              transaction.nativePurchase?.transactionIdentifier ||
              transaction.id ||
              `fallback-${Date.now()}`;

            if (!receiptData) {
              // Do not finish an unverified transaction: StoreKit must be able to
              // redeliver it after the receipt becomes available.
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

              // Finish the transaction AFTER successful server verification.
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
              // Keep failed verifications pending so StoreKit can redeliver the
              // approved transaction instead of consuming a purchase with no cards.
              pending.reject(err);
            }
          });
        // NOTE: We intentionally do NOT attach a .finished() listener here.
        // Calling transaction.finish() (above) triggers the finished event, and
        // if we attached a .finished() handler that checked for CANCELLED state,
        // a bug in the plugin's TransactionState enum could cause it to call
        // pending.reject() right after pending.resolve(), breaking the flow.
        // Cancellations are already handled by offer.order() returning an error.
      } catch (e: any) {
        console.error('CdvPurchase listener registration error', e);
        listenersRegisteredRef.current = false; // Allow retry on next init
      }
    }

    // 3. Store-level ready / error callbacks (on `store`, not on `when()`)
    try {
      CdvPurchase.store.ready(() => {
        if (initTimeoutRef.current) {
          clearTimeout(initTimeoutRef.current);
          initTimeoutRef.current = null;
        }
        setStoreError(null);
        setIsStoreReady(true);
      });

      CdvPurchase.store.error((err: any) => {
        // Don't surface store-level noise in the UI — individual purchases
        // report their own errors. Just log it.
        console.error('CdvPurchase store error:', err);
      });
    } catch (e: any) {
      console.error('CdvPurchase ready/error hook registration failed', e);
    }

    // 4. Safety timeout — if ready() never fires, unblock the UI after 15 seconds.
    if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
    initTimeoutRef.current = setTimeout(() => {
      const alreadyReady = (() => {
        try { return !!CdvPurchase.store.isReady; } catch (_) { return false; }
      })();
      if (alreadyReady) {
        setStoreError(null);
        setIsStoreReady(true);
        return;
      }
      console.warn(`Apple store init timed out after ${STORE_INIT_TIMEOUT_MS}ms — forcing ready`);
      setStoreError('timeout');
      setIsStoreReady(true); // Unblock UI
    }, STORE_INIT_TIMEOUT_MS);

    // 5. Initialise — products load asynchronously; ready() fires when done
    try {
      CdvPurchase.store.initialize([{
        platform: CdvPurchase.Platform.APPLE_APPSTORE,
        options: { needAppReceipt: true },
      }]);
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
    // Reset init guard so initStore() runs again, but do NOT reset
    // listenersRegisteredRef — CdvPurchase listeners must only be registered once.
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
          // order() resolves with an IError object (it does not always throw)
          offer
            .order()
            .then((err: any) => {
              if (!err) return;
              if (pendingRef.current && !pendingRef.current.finished) {
                pendingRef.current.finished = true;
                pendingRef.current = null;
                reject(err);
              }
            })
            .catch((err: any) => {
              if (pendingRef.current && !pendingRef.current.finished) {
                pendingRef.current.finished = true;
                pendingRef.current = null;
                reject(err);
              }
            });
        });
      } catch (err: any) {
        const cancelCode = CdvPurchase?.ErrorCode?.PAYMENT_CANCELLED;
        const code = err?.code || err?.message || 'UNKNOWN';
        if (code === 'USER_CANCELED' || (cancelCode && err?.code === cancelCode) || /cancel/i.test(String(code))) {
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
