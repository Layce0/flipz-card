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

    let failedToLoadHandle: { remove: () => void } | null = null;

    try {
      const options: AdOptions = {
        adId: INTERSTITIAL_AD_ID,
        isTesting: isAdmin ?? false,
      };

      // Listen for load failures (no fill is very common on iOS)
      let loadFailed = false;
      try {
        failedToLoadHandle = await AdMob.addListener(
          InterstitialAdPluginEvents.FailedToLoad,
          () => {
            loadFailed = true;
          }
        );
      } catch (e) {
        console.warn('Could not attach FailedToLoad listener:', e);
      }

      // Timeout of 10s on preparation: never block the user
      await Promise.race([
        AdMob.prepareInterstitial(options),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('PREPARE_TIMEOUT')), 10000)
        ),
      ]);

      failedToLoadHandle?.remove();
      failedToLoadHandle = null;

      if (loadFailed) {
        // No ad available: let the user continue anyway
        setIsLoading(false);
        return true;
      }

      return new Promise<boolean>((resolve) => {
        let settled = false;

        const setupListeners = async () => {
          let safetyTimer: ReturnType<typeof setTimeout> | null = null;

          const cleanup = () => {
            dismissHandle?.remove();
            failHandle?.remove();
            if (safetyTimer) clearTimeout(safetyTimer);
          };

          const finish = (value: boolean) => {
            if (settled) return;
            settled = true;
            cleanup();
            setIsLoading(false);
            resolve(value);
          };

          const dismissHandle = await AdMob.addListener(
            InterstitialAdPluginEvents.Dismissed,
            () => finish(true)
          );

          const failHandle = await AdMob.addListener(
            InterstitialAdPluginEvents.FailedToShow,
            () => finish(true)
          );

          // Safety timer: if nothing happens within 15s, unblock the flow
          safetyTimer = setTimeout(() => finish(true), 15000);

          try {
            await AdMob.showInterstitial();
          } catch (e) {
            console.warn('showInterstitial failed:', e);
            finish(true);
          }
        };

        setupListeners();
      });
    } catch (error) {
      console.error('Failed to show interstitial ad:', error);
      failedToLoadHandle?.remove();
      setIsLoading(false);
      // Graceful fallback: never block the free pack because of ads
      return true;
    }
  }, [isNative, isAdmin]);

  return { showInterstitial, isLoading, isNative, showFakeAd, fakeAdCountdown, dismissFakeAd };
};
