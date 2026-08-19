import { useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/contexts/AuthContext';
import { AdMob, InterstitialAdPluginEvents } from '@capacitor-community/admob';
import type { AdOptions } from '@capacitor-community/admob';

// Production ad unit ID for interstitials
const INTERSTITIAL_AD_ID = 'ca-app-pub-6340983480597130/7607679191';

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
  }, [isNative]);

  const [showFakeAd, setShowFakeAd] = useState(false);
  const [fakeAdCountdown, setFakeAdCountdown] = useState(5);
  const fakeAdResolveRef = useRef<((val: boolean) => void) | null>(null);

  const dismissFakeAd = useCallback(() => {
    setShowFakeAd(false);
    setIsLoading(false);
    fakeAdResolveRef.current?.(true);
    fakeAdResolveRef.current = null;
  }, []);

  const showInterstitial = useCallback(async (): Promise<boolean> => {
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
      const options: AdOptions = {
        adId: INTERSTITIAL_AD_ID,
        isTesting: isAdmin ?? false,
      };

      // Timeout de sécurité : si AdMob ne répond pas en 10s on laisse passer
      const prepareWithTimeout = Promise.race([
        AdMob.prepareInterstitial(options),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('AdMob prepareInterstitial timeout')), 10000)
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

        // Timeout de sécurité sur showInterstitial : si l'ad ne se ferme pas en 15s on continue
        const safetyTimer = setTimeout(() => {
          console.warn('AdMob interstitial safety timeout — resolving gracefully');
          dismissHandle?.then(h => h.remove()).catch(() => {});
          failShowHandle?.then(h => h.remove()).catch(() => {});
          failLoadHandle?.then(h => h.remove()).catch(() => {});
          settle(true);
        }, 15000);

        const cleanup = () => {
          clearTimeout(safetyTimer);
          dismissHandle?.then(h => h.remove()).catch(() => {});
          failShowHandle?.then(h => h.remove()).catch(() => {});
          failLoadHandle?.then(h => h.remove()).catch(() => {});
        };

        const dismissHandle = AdMob.addListener(
          InterstitialAdPluginEvents.Dismissed,
          () => { cleanup(); settle(true); }
        );

        const failShowHandle = AdMob.addListener(
          InterstitialAdPluginEvents.FailedToShow,
          () => {
            console.warn('AdMob FailedToShow — resolving gracefully');
            cleanup();
            settle(true); // graceful : on ouvre quand même le pack
          }
        );

        // FailedToLoad peut aussi survenir après prepareInterstitial dans certaines versions
        const failLoadHandle = AdMob.addListener(
          'interstitialAdFailedToLoad' as any,
          () => {
            console.warn('AdMob FailedToLoad — resolving gracefully');
            cleanup();
            settle(true); // graceful : on ouvre quand même le pack
          }
        );

        AdMob.showInterstitial().catch((e: unknown) => {
          console.warn('AdMob showInterstitial error:', e);
          cleanup();
          settle(true); // graceful
        });
      });
    } catch (error) {
      console.warn('AdMob prepareInterstitial failed (no fill or timeout) — resolving gracefully:', error);
      setIsLoading(false);
      return true; // graceful : pas de pub = on ouvre quand même le pack
    }
  }, [isNative, isAdmin]);

  return { showInterstitial, isLoading, isNative, showFakeAd, fakeAdCountdown, dismissFakeAd };
};
