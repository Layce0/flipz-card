import { useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/contexts/AuthContext';
import { AdMob, InterstitialAdPluginEvents } from '@capacitor-community/admob';
import type { AdOptions } from '@capacitor-community/admob';

// Production ad unit ID for interstitials
const INTERSTITIAL_AD_ID = 'ca-app-pub-3940256099942544/1033173712';

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
      initializeAdMob(isAdmin ?? true);
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
        isTesting: isAdmin ?? true,
      };

      await AdMob.prepareInterstitial(options);

      return new Promise<boolean>((resolve) => {
        const setupListeners = async () => {
          const dismissHandle = await AdMob.addListener(
            InterstitialAdPluginEvents.Dismissed,
            () => {
              dismissHandle.remove();
              failHandle.remove();
              setIsLoading(false);
              resolve(true);
            }
          );

          const failHandle = await AdMob.addListener(
            InterstitialAdPluginEvents.FailedToShow,
            () => {
              dismissHandle.remove();
              failHandle.remove();
              setIsLoading(false);
              resolve(false);
            }
          );

          AdMob.showInterstitial();
        };
        setupListeners();
      });
    } catch (error) {
      console.error('Failed to show interstitial ad:', error);
      setIsLoading(false);
      return false;
    }
  }, [isNative]);

  return { showInterstitial, isLoading, isNative, showFakeAd, fakeAdCountdown, dismissFakeAd };
};
