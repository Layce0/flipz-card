import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

// ─── Readiness helpers ───────────────────────────────────────────────

/** Probe network by hitting a tiny known endpoint.
 *  We try the Supabase health endpoint first, then fall back to a
 *  generic connectivity check via `navigator.onLine`. */
async function checkNetwork(): Promise<boolean> {
  // Quick bail-out when the browser already reports offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (supabaseUrl) {
      const resp = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'HEAD',
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      });
      return resp.ok || resp.status === 401; // 401 = auth required = server reachable
    }
  } catch {
    // fetch failed – probably offline
  }

  // Fallback: rely on navigator.onLine (not 100% reliable but better than nothing)
  return navigator.onLine;
}

// ─── Loading milestones ──────────────────────────────────────────────
// Each milestone maps to a progress range. The splash animates smoothly
// through each chunk once the milestone is reached.

interface Milestone {
  /** Progress % this milestone resolves to */
  target: number;
  /** i18n key for the label shown while this milestone is running */
  labelKey: string;
  /** Default (French) text if translation is missing */
  defaultLabel: string;
}

const MILESTONES: Milestone[] = [
  { target: 20,  labelKey: 'splash.loadingCore',    defaultLabel: 'Chargement des modules…' },
  { target: 50,  labelKey: 'splash.loadingAuth',    defaultLabel: 'Vérification de votre session…' },
  { target: 80,  labelKey: 'splash.loadingData',    defaultLabel: 'Préparation de vos données…' },
  { target: 99,  labelKey: 'splash.waitingNetwork', defaultLabel: 'Connexion au serveur…' },
  { target: 100, labelKey: 'splash.ready',          defaultLabel: 'C\'est parti !' },
];

// ─── Component ───────────────────────────────────────────────────────

interface SplashScreenProps {
  /** Auth context finished bootstrapping */
  isAuthReady: boolean;
}

export const SplashScreen = ({ isAuthReady }: SplashScreenProps) => {
  const { t } = useTranslation();

  // Visual progress (animated)
  const [displayProgress, setDisplayProgress] = useState(0);
  // Which milestone index we are waiting for
  const [milestoneIdx, setMilestoneIdx] = useState(0);
  // Network reachability
  const [networkOk, setNetworkOk] = useState<boolean | null>(null); // null = not checked yet
  // Splash visibility states
  const [visible, setVisible] = useState(true);
  const [render, setRender] = useState(true);
  // Whether we've shown the "no connection" warning
  const [showOfflineHint, setShowOfflineHint] = useState(false);

  const animFrameRef = useRef<number | null>(null);
  const targetProgressRef = useRef(0);

  // ── Smooth progress animation ──────────────────────────────────────
  const animateProgress = useCallback(() => {
    const tick = () => {
      setDisplayProgress(prev => {
        const target = targetProgressRef.current;
        if (prev >= target) return prev;
        // Ease towards target
        const next = Math.min(prev + Math.max(0.5, (target - prev) * 0.08), target);
        return Math.round(next * 10) / 10; // 1 decimal place
      });
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    animateProgress();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [animateProgress]);

  // ── Milestone 0 → 20 %: core JS loaded (instant) ──────────────────
  useEffect(() => {
    // Small delay to feel intentional
    const timer = setTimeout(() => {
      targetProgressRef.current = MILESTONES[0].target;
      setMilestoneIdx(1);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // ── Milestone 1 → 50 %: auth bootstrap ready ──────────────────────
  useEffect(() => {
    if (milestoneIdx !== 1) return;
    if (isAuthReady) {
      targetProgressRef.current = MILESTONES[1].target;
      setMilestoneIdx(2);
    }
  }, [milestoneIdx, isAuthReady]);

  // ── Milestone 2 → 80 %: short wait for data queries to initiate ───
  useEffect(() => {
    if (milestoneIdx !== 2) return;
    const timer = setTimeout(() => {
      targetProgressRef.current = MILESTONES[2].target;
      setMilestoneIdx(3);
    }, 400);
    return () => clearTimeout(timer);
  }, [milestoneIdx]);

  // ── Milestone 3 → 99 %: network check ─────────────────────────────
  useEffect(() => {
    if (milestoneIdx !== 3) return;

    let cancelled = false;

    const probe = async () => {
      targetProgressRef.current = MILESTONES[3].target; // show 99 while checking

      const ok = await checkNetwork();
      if (cancelled) return;

      setNetworkOk(ok);

      if (ok) {
        // Network OK → go to 100 %
        setMilestoneIdx(4);
      } else {
        // Show offline hint, keep polling
        setShowOfflineHint(true);
      }
    };

    probe();

    // If offline, keep retrying every 2 seconds
    const interval = setInterval(async () => {
      if (cancelled) return;
      const ok = await checkNetwork();
      if (cancelled) return;
      setNetworkOk(ok);
      if (ok) {
        setShowOfflineHint(false);
        setMilestoneIdx(4);
        clearInterval(interval);
      }
    }, 2000);

    // Also listen to browser online events
    const onOnline = () => {
      checkNetwork().then(ok => {
        if (cancelled) return;
        setNetworkOk(ok);
        if (ok) {
          setShowOfflineHint(false);
          setMilestoneIdx(4);
          clearInterval(interval);
        }
      });
    };
    window.addEventListener('online', onOnline);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('online', onOnline);
    };
  }, [milestoneIdx]);

  // ── Milestone 4 → 100 %: done → fade out ──────────────────────────
  useEffect(() => {
    if (milestoneIdx !== 4) return;
    targetProgressRef.current = 100;

    // Wait until the displayed progress visually reaches 100
    const check = setInterval(() => {
      setDisplayProgress(p => {
        if (p >= 99.5) {
          clearInterval(check);
          // Short hold at 100%, then fade out
          setTimeout(() => {
            setVisible(false);
            setTimeout(() => setRender(false), 700);
          }, 350);
        }
        return p;
      });
    }, 50);

    return () => clearInterval(check);
  }, [milestoneIdx]);

  if (!render) return null;

  // Determine which label to show
  const currentMilestone = MILESTONES[Math.min(milestoneIdx, MILESTONES.length - 1)];
  const progressInt = Math.round(displayProgress);

  const statusText = showOfflineHint
    ? t('splash.offline', 'Pas de connexion internet — en attente…')
    : progressInt >= 100
      ? t(currentMilestone.labelKey, currentMilestone.defaultLabel)
      : `${t(currentMilestone.labelKey, currentMilestone.defaultLabel)} ${progressInt}%`;

  return (
    <div
      className={`fixed inset-0 w-full h-full z-[99999] flex flex-col justify-end items-center bg-[#0f0d17] select-none transition-all duration-700 ease-in-out ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
      }`}
      style={{
        backgroundImage: "url('/splash.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Dynamic Overlay gradient for bottom legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0f0d17]/85 via-transparent to-[#0f0d17]/20 z-0 pointer-events-none" />

      {/* Glassmorphic Loading Area */}
      <div className="relative w-full flex flex-col items-center gap-3 px-6 pb-[12vh] z-10">
        
        {/* Status text */}
        <span className={`text-white/80 font-display text-sm font-semibold tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] transition-all duration-300 ${
          showOfflineHint ? 'text-amber-400/90 animate-pulse' : progressInt >= 100 ? 'text-green-400/90' : 'animate-pulse'
        }`}>
          {statusText}
        </span>

        {/* Premium Progress Bar Wrapper */}
        <div className="w-full max-w-xs h-2 bg-white/10 backdrop-blur-md rounded-full overflow-hidden border border-white/10 shadow-[0_4px_10px_rgba(0,0,0,0.3)]">
          {/* Progress Bar Fill */}
          <div
            className={`h-full rounded-full transition-all duration-100 ease-out ${
              showOfflineHint
                ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]'
                : progressInt >= 100
                  ? 'bg-gradient-to-r from-green-400 via-emerald-300 to-green-500 shadow-[0_0_12px_rgba(52,211,153,0.6)]'
                  : 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]'
            }`}
            style={{ width: `${displayProgress}%` }}
          />
        </div>

        {/* Offline retry hint */}
        {showOfflineHint && (
          <span className="text-[11px] text-amber-400/60 uppercase tracking-widest font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] animate-pulse">
            {t('splash.retrying', 'Tentative de reconnexion automatique…')}
          </span>
        )}

        {/* Tiny subtext */}
        <span className="text-[10px] text-white/40 uppercase tracking-widest font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
          {t('loading.version', 'Collection Quotidienne v1.4')}
        </span>

      </div>
    </div>
  );
};
