import { useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';
import type { RewardAdOptions } from '@capacitor-community/admob';
import { MaxAdContentRating } from '@capacitor-community/admob';
import { useAuth } from '@/contexts/AuthContext';

// ---------------------------------------------------------------------------
// Configuration des unités publicitaires
// ---------------------------------------------------------------------------
const ADMOB_APP_ID = 'ca-app-pub-6340983480597130~9251933354';
const REWARDED_AD_UNIT_IOS = 'ca-app-pub-6340983480597130/7607679191';
const REWARDED_AD_UNIT_ANDROID = 'ca-app-pub-6340983480597130/9963115881';

// Unités de test officielles Google (mode test admin / dev uniquement)
const TEST_REWARDED_AD_UNIT_IOS = 'ca-app-pub-3940256099942544/1712485313';
const TEST_REWARDED_AD_UNIT_ANDROID = 'ca-app-pub-3940256099942544/5224354917';

const PREPARE_TIMEOUT_MS = 12000;
const SHOW_TIMEOUT_MS = 60000;

// ---------------------------------------------------------------------------
// Initialisation (une seule fois par session native)
// ---------------------------------------------------------------------------
let initPromise: Promise<boolean> | null = null;

const ensureAdMobInitialized = (isTesting: boolean): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(false);
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (Capacitor.getPlatform() === 'ios') {
        // Demande de consentement ATT (tracking publicitaire)
        try {
          await AdMob.requestTrackingAuthorization();
        } catch (e) {
          console.warn('[AdMob] ATT request failed or unsupported:', e);
        }
      }
      await AdMob.initialize({
        initializeForTesting: isTesting,
      });
      console.log('[AdMob] Initialized');
      return true;
    } catch (error) {
      console.error('[AdMob] Initialization failed:', error);
      initPromise = null;
      return false;
    }
  })();

  return initPromise;
};

const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`[AdMob] ${label} timeout`)), ms)
    ),
  ]);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export const useAdMob = () => {
  const [isLoading, setIsLoading] = useState(false);
  const isNative = Capacitor.isNativePlatform();
  const { isAdmin } = useAuth();
  const isTestMode = (isAdmin ?? false) || import.meta.env.DEV;

  // État de préchargement de la vidéo récompensée
  const isAdReadyRef = useRef<boolean>(false);
  const isPreloadingRef = useRef<boolean>(false);
  const preloadRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getAdOptions = useCallback((): RewardAdOptions => {
    const platform = Capacitor.getPlatform();
    const adId = isTestMode
      ? platform === 'ios' ? TEST_REWARDED_AD_UNIT_IOS : TEST_REWARDED_AD_UNIT_ANDROID
      : platform === 'ios' ? REWARDED_AD_UNIT_IOS : REWARDED_AD_UNIT_ANDROID;
    return { adId, isTesting: isTestMode };
  }, [isTestMode]);

  // Fonction de préchargement automatique en tâche de fond
  const preloadRewardedAd = useCallback(async () => {
    if (!isNative || isPreloadingRef.current || isAdReadyRef.current) return;
    
    const initialized = await ensureAdMobInitialized(isTestMode);
    if (!initialized) return;

    isPreloadingRef.current = true;
    try {
      console.log('[AdMob] Preloading rewarded video in background...');
      await withTimeout(
        AdMob.prepareRewardVideoAd(getAdOptions()),
        PREPARE_TIMEOUT_MS,
        'preloadRewardVideoAd'
      );
      isAdReadyRef.current = true;
      console.log('[AdMob] Rewarded video successfully preloaded & ready!');
    } catch (error) {
      console.warn('[AdMob] Preload failed (retrying in 20s):', error);
      isAdReadyRef.current = false;
      // Retente discrètement dans 20 secondes si le réseau ou AdMob était temporairement indisponible
      if (preloadRetryTimerRef.current) clearTimeout(preloadRetryTimerRef.current);
      preloadRetryTimerRef.current = setTimeout(() => {
        preloadRewardedAd();
      }, 20_000);
    } finally {
      isPreloadingRef.current = false;
    }
  }, [isNative, isTestMode, getAdOptions]);

  // Initialise et lance le préchargement dès l'arrivée sur l'app
  useEffect(() => {
    if (isNative) {
      preloadRewardedAd();
    }
    return () => {
      if (preloadRetryTimerRef.current) {
        clearTimeout(preloadRetryTimerRef.current);
      }
    };
  }, [isNative, preloadRewardedAd]);

  // -------------------- Fausse pub web (aperçu / tests) --------------------
  const [showFakeAd, setShowFakeAd] = useState(false);
  const [fakeAdCountdown, setFakeAdCountdown] = useState(5);
  const fakeAdResolveRef = useRef<((val: boolean) => void) | null>(null);
  const fakeAdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const finishFakeAd = useCallback((result: boolean) => {
    if (fakeAdIntervalRef.current) {
      clearInterval(fakeAdIntervalRef.current);
      fakeAdIntervalRef.current = null;
    }
    setShowFakeAd(false);
    setIsLoading(false);
    fakeAdResolveRef.current?.(result);
    fakeAdResolveRef.current = null;
  }, []);

  const dismissFakeAd = useCallback(() => finishFakeAd(true), [finishFakeAd]);

  const showFakeRewardedAd = useCallback((): Promise<boolean> => {
    setIsLoading(true);
    setFakeAdCountdown(5);
    setShowFakeAd(true);

    return new Promise<boolean>((resolve) => {
      fakeAdResolveRef.current = resolve;
      let count = 5;
      fakeAdIntervalRef.current = setInterval(() => {
        count--;
        setFakeAdCountdown(count);
        if (count <= 0) finishFakeAd(true);
      }, 1000);
    });
  }, [finishFakeAd]);

  // ------------------------- Pub rewarded native ---------------------------
  const showNativeRewardedAd = useCallback(async (): Promise<boolean> => {
    const initialized = await ensureAdMobInitialized(isTestMode);
    if (!initialized) {
      // AdMob non disponible sur cet appareil → pas de pub → pas de récompense
      return false;
    }

    return new Promise<boolean>(async (resolve) => {
      let settled = false;
      let rewardEarned = false;
      const handles: PluginListenerHandle[] = [];

      const cleanup = () => {
        handles.forEach((h) => h.remove().catch(() => {}));
        handles.length = 0;
        clearTimeout(safetyTimer);
      };

      const settle = (result: boolean) => {
        if (settled) return;
        settled = true;
        cleanup();
        setIsLoading(false);
        // Marque l'annonce comme consommée et lance immédiatement le préchargement de la suivante
        isAdReadyRef.current = false;
        preloadRewardedAd();
        resolve(result);
      };

      // Timer de sécurité : si la pub se bloque, débloque après 30s
      const safetyTimer = setTimeout(() => {
        console.warn('[AdMob] show safety timeout — graceful pass');
        settle(true);
      }, 30_000);

      // 1. Enregistrement de tous les listeners
      try {
        handles.push(
          await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
            console.log('[AdMob] User rewarded event received');
            rewardEarned = true;
          }),
          await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
            console.log('[AdMob] Ad dismissed by user, earned:', rewardEarned);
            settle(rewardEarned);
          }),
          await AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (error) => {
            console.warn('[AdMob] FailedToLoad — pub non chargée, pas de récompense:', error);
            settle(false);
          }),
          await AdMob.addListener(RewardAdPluginEvents.FailedToShow, (error) => {
            console.warn('[AdMob] FailedToShow — pub non affichée, pas de récompense:', error);
            settle(false);
          }),
        );
      } catch (e) {
        console.warn('[AdMob] addListener failed:', e);
        settle(false);
        return;
      }

      // 2. Si pas déjà préchargée, on la prépare maintenant
      if (!isAdReadyRef.current) {
        try {
          console.log('[AdMob] Ad was not preloaded, preparing on the fly...');
          await withTimeout(
            AdMob.prepareRewardVideoAd(getAdOptions()),
            PREPARE_TIMEOUT_MS,
            'prepareRewardVideoAd'
          );
        } catch (error) {
          console.warn('[AdMob] prepare failed (no fill / timeout) — pas de récompense:', error);
          settle(false);
          return;
        }
      }

      // 3. Affichage immédiat (instantané grâce au preload)
      if (settled) { cleanup(); return; }

      try {
        console.log('[AdMob] Showing reward video ad...');
        await AdMob.showRewardVideoAd();
      } catch (error) {
        console.warn('[AdMob] showRewardVideoAd threw — no reward:', error);
        settle(false);
      }
    });
  }, [isTestMode, getAdOptions, preloadRewardedAd]);

  // ------------------------------- API publique ----------------------------
  const showRewardedAd = useCallback(async (): Promise<boolean> => {
    if (isLoading) return false;

    if (!isNative) {
      return showFakeRewardedAd();
    }

    setIsLoading(true);
    try {
      return await showNativeRewardedAd();
    } catch (error) {
      console.warn('[AdMob] unexpected error — graceful pass:', error);
      setIsLoading(false);
      return true;
    }
  }, [isLoading, isNative, showFakeRewardedAd, showNativeRewardedAd]);

  return { 
    showRewardedAd, 
    isLoading, 
    isNative, 
    showFakeAd, 
    fakeAdCountdown, 
    dismissFakeAd,
    isAdReady: isAdReadyRef.current 
  };
};
