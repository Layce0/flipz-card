import { useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { AdMob, InterstitialAdPluginEvents } from '@capacitor-community/admob';
import type { AdOptions } from '@capacitor-community/admob';

// Production ad unit ID for interstitials
const INTERSTITIAL_AD_ID = 'ca-app-pub-1812377454430177/5961368412';

let admobInitialized = false;

const initializeAdMob = async () => {
  if (admobInitialized) return;
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    await AdMob.initialize({
      initializeForTesting: false,
    });
    admobInitialized = true;
  } catch (error) {
    console.error('AdMob initialization failed:', error);
  }
};

export const useAdMob = () => {
  const [isLoading, setIsLoading] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (isNative) {
      initializeAdMob();
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
        isTesting: false,
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

  return { showInterstitial, isLoading, isNative };
};
