import { useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import { toast } from "sonner";

declare const CdvPurchase: any;

export const GOOGLE_PLAY_PRODUCT_IDS: Record<string, string> = {
  standard_5: "pack_standard_5",
  standard_10: "pack_standard_10",
  standard_20: "pack_standard_20",
  standard_50: "pack_standard_50",
  lucky_5: "pack_lucky_5",
  lucky_10: "pack_lucky_10",
  lucky_20: "pack_lucky_20",
  lucky_50: "pack_lucky_50",
  ultra_5: "pack_ultra_5",
  ultra_10: "pack_ultra_10",
  ultra_20: "pack_ultra_20",
  ultra_50: "pack_ultra_50",
};

export const useRevenueCat = () => {
  const [loadingPackId, setLoadingPackId] = useState<string | null>(null);
  const [purchasedCards, setPurchasedCards] = useState<any[]>([]);
  const [showPurchaseReward, setShowPurchaseReward] = useState(false);

  const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

  const handlePurchase = useCallback(async (packId: string, userId: string, refetchCards: () => void) => {
    if (!isAndroid) {
      toast.error("Les achats sont disponibles uniquement sur Android.");
      return;
    }

    setLoadingPackId(packId);

    try {
      const productId = GOOGLE_PLAY_PRODUCT_IDS[packId];
      if (!productId) throw new Error("Produit introuvable");

      await new Promise<void>((resolve, reject) => {
        CdvPurchase.store.register([{
          id: productId,
          type: CdvPurchase.ProductType.CONSUMABLE,
          platform: CdvPurchase.Platform.GOOGLE_PLAY,
        }]);

        CdvPurchase.store.when()
          .approved((transaction: any) => {
            const purchaseToken = transaction.purchaseId || transaction.transactionId;

            invokeEdgeFunction("verify-google-purchase", {
              body: { packId, purchaseToken, productId, userId },
            }).then(({ data, error }) => {
              if (error) {
                transaction.finish();
                reject(error);
                return;
              }
              transaction.finish();
              if (data.cards && data.cards.length > 0) {
                setPurchasedCards(data.cards);
                setShowPurchaseReward(true);
                toast.success(`${data.cardCount} cartes reçues !`);
                refetchCards();
              }
              resolve();
            });
          })
          .cancelled(() => {
            resolve();
          });

        CdvPurchase.store.initialize([CdvPurchase.Platform.GOOGLE_PLAY])
          .then(() => {
            const product = CdvPurchase.store.get(productId, CdvPurchase.Platform.GOOGLE_PLAY);
            if (!product) throw new Error("Produit non disponible");
            product.getOffer()?.order();
          })
          .catch(reject);
      });

    } catch (error: any) {
      if (error?.code !== CdvPurchase?.ErrorCode?.PAYMENT_CANCELLED) {
        toast.error("Erreur : " + (error?.message || "Erreur inconnue"));
      }
    } finally {
      setLoadingPackId(null);
    }
  }, [isAndroid]);

  const handleClosePurchaseReveal = () => {
    setShowPurchaseReward(false);
    setPurchasedCards([]);
  };

  return {
    handlePurchase,
    loadingPackId,
    purchasedCards,
    showPurchaseReward,
    handleClosePurchaseReveal,
    isAndroid,
  };
};
