import { useState, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { AdMob, InterstitialAdPluginEvents } from '@capacitor-community/admob';
import type { AdOptions } from '@capacitor-community/admob';

// Use test ad unit IDs during development
const INTERSTITIAL_AD_ID = Capacitor.getPlatform() === 'ios'
  ? 'ca-app-pub-3940256099942544/4411468910' // iOS test ID
  : 'ca-app-pub-3940256099942544/1033173712'; // Android test ID

let admobInitialized = false;

const initializeAdMob = async () => {
  if (admobInitialized) return;
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    await AdMob.initialize({
      initializeForTesting: true, // Set to false in production
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

  const showInterstitial = useCallback(async (): Promise<boolean> => {
    // On web, simulate an ad with a timer
    if (!isNative) {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 3000));
      setIsLoading(false);
      return true;
    }

    setIsLoading(true);

    try {
      const options: AdOptions = {
        adId: INTERSTITIAL_AD_ID,
        isTesting: true, // Set to false in production
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
