/**
 * useSfx — Hook pour jouer les effets sonores de Flipz
 * Les sons sont preloadés à l'import et respectent le flag mute en localStorage.
 */

const SFX_MUTE_KEY = 'flipz_sfx_muted';
const SFX_VOLUME_KEY = 'flipz_sfx_volume';

// Preload all sounds once at module level
const sfxFiles = {
  cardFlip:        '/sfx/card-flip.wav',
  cardSwipe:       '/sfx/card-swipe.wav',
  catMeow:         '/sfx/cat-meow.wav',
  collectSuccess:  '/sfx/collect-success.wav',
  error:           '/sfx/error.wav',
  legendaryReveal: '/sfx/legendary-reveal.wav',
  navClick:        '/sfx/nav-click.wav',
  packTap:         '/sfx/pack-tap.wav',
  packTear:        '/sfx/pack-tear.wav',
  streakLost:      '/sfx/streak-lost.wav',
} as const;

export type SfxName = keyof typeof sfxFiles;

// Preload (lazy)
const audioCache: Partial<Record<SfxName, HTMLAudioElement>> = {};

import { useEffect, useCallback } from 'react';

export const useSfx = () => {
  const isMuted = useCallback((): boolean => {
    try {
      return localStorage.getItem(SFX_MUTE_KEY) === 'true';
    } catch {
      return false;
    }
  }, []);

  const getVolume = useCallback((): number => {
    try {
      const v = parseFloat(localStorage.getItem(SFX_VOLUME_KEY) || '1');
      return isNaN(v) ? 1 : Math.max(0, Math.min(1, v));
    } catch {
      return 1;
    }
  }, []);

  const getAudio = useCallback((name: SfxName): HTMLAudioElement | undefined => {
    if (typeof window === 'undefined') return undefined;
    if (!audioCache[name]) {
      const audio = new Audio(sfxFiles[name]);
      audio.preload = 'auto';
      audioCache[name] = audio;
    }
    return audioCache[name];
  }, []);

  const play = useCallback((name: SfxName, volume?: number) => {
    if (isMuted()) return;
    const audio = getAudio(name);
    if (!audio) return;
    const baseVol = volume !== undefined ? volume : getVolume();
    // Applique un boost de volume (x1.8 limité à 1.0 max)
    const vol = Math.max(0, Math.min(1, baseVol * 1.8));
    try {
      audio.volume = vol;
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Blocked by browser autoplay policy — safe to ignore
      });
    } catch {
      // ignore
    }
  }, [isMuted, getAudio, getVolume]);

  const toggleMute = useCallback((): boolean => {
    const next = !isMuted();
    try {
      localStorage.setItem(SFX_MUTE_KEY, String(next));
    } catch {}
    return next;
  }, [isMuted]);

  const getMuted = isMuted;

  return { play, toggleMute, getMuted };
};

/**
 * useGlobalClickSfx — Hook global pour jouer automatiquement nav-click.wav
 * sur tous les boutons, onglets, badges, liens et éléments interactifs de l'application.
 */
export const useGlobalClickSfx = () => {
  const { play } = useSfx();

  useEffect(() => {
    let lastPlayTime = 0;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Ne pas déclencher navClick sur les cartes à retourner ou zones exclues
      if (
        target.closest('.flip-card') ||
        target.closest('[data-no-nav-sfx]') ||
        target.closest('.no-click-sfx')
      ) {
        return;
      }

      // Détecter tout bouton, onglet, badge cliquable, lien ou composant interactif
      const interactive = target.closest(
        'button, [role="button"], [role="tab"], [role="menuitem"], [role="option"], a[href], input[type="button"], input[type="submit"]'
      );

      if (interactive) {
        const now = Date.now();
        // Léger anti-rebond pour éviter les doubles déclenchements
        if (now - lastPlayTime > 50) {
          lastPlayTime = now;
          play('navClick');
        }
      }
    };

    document.addEventListener('click', handleClick, { capture: true });
    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
    };
  }, [play]);
};
