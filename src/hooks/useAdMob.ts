import { useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/contexts/AuthContext';
import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';
import type { RewardAdOptions } from '@capacitor-community/admob';

const REWARDED_AD_ID_IOS = 'ca-app-pub-6340983480597130/7607679191';
const REWARDED_AD_ID_ANDROID = 'ca-app-pub-6340983480597130/7607679191'; // TODO: Update with real Android ID
const TEST_REWARDED_AD_ID_ANDROID = 'ca-app-pub-3940256099942544/5224354917';
const TEST_REWARDED_AD_ID_IOS = 'ca-app-pub-3940256099942544/1712485313';

let admobInitialized = false;

const initializeAdMob = async (isTesting: boolean) => {
  if (admobInitialized) return;
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    if (Capacitor.getPlatform() === 'ios') {
      try {
        await AdMob.requestTrackingAuthorization();
      } catch (e) {
        console.warn('ATT request failed or not supported:', e);
      }
    }

    await AdMob.initialize({
      initializeForTesting: isTesting,
    });
    admobInitialized = true;
  } catch (error) {
    console.error('AdMob initialization failed:', error);
  }
};

export const useAdMob = () => {
  const [isLoading, setIsLoading] = useState(false);
  const isNative = Capacitor.isNativePlatform();
  const { isAdmin } = useAuth();

  useEffect(() => {
    if (isNative) {
      initializeAdMob(isAdmin ?? false);
    }
  }, [isNative, isAdmin]);

  const [showFakeAd, setShowFakeAd] = useState(false);
  const [fakeAdCountdown, setFakeAdCountdown] = useState(5);
  const fakeAdResolveRef = useRef<((val: boolean) => void) | null>(null);

  const dismissFakeAd = useCallback(() => {
    setShowFakeAd(false);
    setIsLoading(false);
    fakeAdResolveRef.current?.(true);
    fakeAdResolveRef.current = null;
  }, []);

  const showRewardedAd = useCallback(async (): Promise<boolean> => {
    if (!isNative) {
      setIsLoading(true);
      setFakeAdCountdown(5);
      setShowFakeAd(true);

      return new Promise<boolean>((resolve) => {
        fakeAdResolveRef.current = resolve;
        let count = 5;
        const interval = setInterval(() => {
          count--;
          setFakeAdCountdown(count);
          if (count <= 0) {
            clearInterval(interval);
            setShowFakeAd(false);
            setIsLoading(false);
            resolve(true);
            fakeAdResolveRef.current = null;
          }
        }, 1000);
      });
    }

    setIsLoading(true);

    try {
      const isTestMode = (isAdmin ?? false) || import.meta.env.DEV;
      const testAdId = Capacitor.getPlatform() === 'ios' ? TEST_REWARDED_AD_ID_IOS : TEST_REWARDED_AD_ID_ANDROID;
      const prodAdId = Capacitor.getPlatform() === 'ios' ? REWARDED_AD_ID_IOS : REWARDED_AD_ID_ANDROID;

      const options: RewardAdOptions = {
        adId: isTestMode ? testAdId : prodAdId,
        isTesting: isTestMode,
      };

      // Timeout de sécurité : si AdMob ne répond pas en 10s on laisse passer
      const prepareWithTimeout = Promise.race([
        AdMob.prepareRewardVideoAd(options),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('AdMob prepareRewardVideoAd timeout')), 10000)
        ),
      ]);

      await prepareWithTimeout;

      return new Promise<boolean>((resolve) => {
        let settled = false;
        const settle = (result: boolean) => {
          if (settled) return;
          settled = true;
          setIsLoading(false);
          resolve(result);
        };

        // Timeout de sécurité sur showRewardVideoAd : si l'ad ne se ferme pas en 15s on continue
        const safetyTimer = setTimeout(() => {
          console.warn('AdMob rewarded safety timeout — resolving gracefully');
          dismissHandle?.then(h => h.remove()).catch(() => {});
          failShowHandle?.then(h => h.remove()).catch(() => {});
          failLoadHandle?.then(h => h.remove()).catch(() => {});
          rewardedHandle?.then(h => h.remove()).catch(() => {});
          settle(true);
        }, 15000);

        const cleanup = () => {
          clearTimeout(safetyTimer);
          dismissHandle?.then(h => h.remove()).catch(() => {});
          failShowHandle?.then(h => h.remove()).catch(() => {});
          failLoadHandle?.then(h => h.remove()).catch(() => {});
          rewardedHandle?.then(h => h.remove()).catch(() => {});
        };

        const dismissHandle = AdMob.addListener(
          RewardAdPluginEvents.Dismissed,
          () => { cleanup(); settle(true); }
        );

        const failShowHandle = AdMob.addListener(
          RewardAdPluginEvents.FailedToShow,
          () => {
            console.warn('AdMob FailedToShow — resolving gracefully');
            cleanup();
            settle(true); // graceful : on ouvre quand même le pack
          }
        );

        // FailedToLoad
        const failLoadHandle = AdMob.addListener(
          'rewardVideoAdFailedToLoad' as any,
          () => {
            console.warn('AdMob FailedToLoad — resolving gracefully');
            cleanup();
            settle(true); // graceful : on ouvre quand même le pack
          }
        );

        const rewardedHandle = AdMob.addListener(
          RewardAdPluginEvents.Rewarded,
          () => {
            // L'utilisateur a obtenu la récompense
          }
        );

        AdMob.showRewardVideoAd().catch((e: unknown) => {
          console.warn('AdMob showRewardVideoAd error:', e);
          cleanup();
          settle(true); // graceful
        });
      });
    } catch (error) {
      console.warn('AdMob prepareRewardVideoAd failed (no fill or timeout) — resolving gracefully:', error);
      setIsLoading(false);
      return true; // graceful : pas de pub = on ouvre quand même le pack
    }
  }, [isNative, isAdmin]);

  return { showRewardedAd, isLoading, isNative, showFakeAd, fakeAdCountdown, dismissFakeAd };
};
