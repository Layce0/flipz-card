import { useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';
import type { RewardAdOptions } from '@capacitor-community/admob';
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
        try {
          await AdMob.requestTrackingAuthorization();
        } catch (e) {
          console.warn('[AdMob] ATT request failed or unsupported:', e);
        }
      }
      await AdMob.initialize({ initializeForTesting: isTesting });
      console.log('[AdMob] Initialized with app id', ADMOB_APP_ID);
      return true;
    } catch (error) {
      console.error('[AdMob] Initialization failed:', error);
      initPromise = null; // autorise une nouvelle tentative au prochain appel
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

  // Pré-initialise le SDK dès que possible sur natif
  useEffect(() => {
    if (isNative) {
      ensureAdMobInitialized(isTestMode);
    }
  }, [isNative, isTestMode]);

  // -------------------- Faussse pub web (aperçu / tests) --------------------
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
      // Repli gracieux : pas de SDK = on laisse passer pour ne pas bloquer le jeu
      return true;
    }

    const platform = Capacitor.getPlatform();
    const adId = isTestMode
      ? platform === 'ios' ? TEST_REWARDED_AD_UNIT_IOS : TEST_REWARDED_AD_UNIT_ANDROID
      : REWARDED_AD_UNIT;

    const options: RewardAdOptions = { adId, isTesting: isTestMode };

    // 1. Chargement de la pub (avec timeout)
    try {
      await withTimeout(AdMob.prepareRewardVideoAd(options), PREPARE_TIMEOUT_MS, 'prepareRewardVideoAd');
    } catch (error) {
      console.warn('[AdMob] prepare failed (no fill / timeout) — graceful pass:', error);
      return true; // Repli gracieux : pas de pub disponible = récompense quand même
    }

    // 2. Affichage + écoute du cycle de vie
    return new Promise<boolean>((resolve) => {
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
        resolve(result);
      };

      // Timer de sécurité : si l'annonce ne se ferme jamais, on débloque
      const safetyTimer = setTimeout(() => {
        console.warn('[AdMob] show safety timeout — graceful pass');
        settle(true);
      }, SHOW_TIMEOUT_MS);

      const listen = async () => {
        handles.push(
          await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
            rewardEarned = true;
          }),
          await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
            // Fermé : récompense accordée seulement si la vidéo a été vue en entier
            settle(rewardEarned);
          }),
          await AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (error) => {
            console.warn('[AdMob] FailedToLoad — graceful pass:', error);
            settle(true); // Repli gracieux
          }),
          await AdMob.addListener(RewardAdPluginEvents.FailedToShow, (error) => {
            console.warn('[AdMob] FailedToShow — graceful pass:', error);
            settle(true); // Repli gracieux
          }),
        );

        if (settled) {
          cleanup();
          return;
        }

        try {
          await AdMob.showRewardVideoAd();
        } catch (error) {
          console.warn('[AdMob] showRewardVideoAd threw — graceful pass:', error);
          settle(true);
        }
      };

      listen();
    });
  }, [isTestMode]);

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

  return { showRewardedAd, isLoading, isNative, showFakeAd, fakeAdCountdown, dismissFakeAd };
};
