import { useEffect, useState, memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveBoosts, ActiveBoost } from '@/hooks/useActiveBoosts';
import { LuckBoostIcon, PackBoostIcon } from '@/components/BoostIcons';

/* ─── Circular progress ring for timer ─── */
const TimerRing = ({ progress, size = 32, stroke = 2.5, color }: {
  progress: number; size?: number; stroke?: number; color: string;
}) => {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.max(0, Math.min(1, progress)));

  return (
    <svg width={size} height={size} className="absolute inset-0">
      {/* Track */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="hsl(0 0% 100% / 0.08)" strokeWidth={stroke}
      />
      {/* Progress */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{
          transform: 'rotate(-90deg)',
          transformOrigin: '50% 50%',
          transition: 'stroke-dashoffset 1s linear',
          filter: `drop-shadow(0 0 4px ${color})`,
        }}
      />
    </svg>
  );
};

/* ─── Time formatting ─── */
const formatTimeRemaining = (expiresAt: string): string => {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return '0:00';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  if (hours > 0) return `${hours}h${String(minutes).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

/* Compute progress [0..1] where 1 = full time, 0 = expired.
   We assume boosts last up to 24h — adjust BOOST_MAX_DURATION_MS if needed. */
const BOOST_MAX_DURATION_MS = 24 * 3600 * 1000;

const getProgress = (expiresAt: string): number => {
  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (remaining <= 0) return 0;
  return Math.min(1, remaining / BOOST_MAX_DURATION_MS);
};

/* ─── Single boost card ─── */
const BoostCard = ({ boost }: { boost: ActiveBoost }) => {
  const [timeLeft, setTimeLeft] = useState(() => formatTimeRemaining(boost.boost_expires_at));
  const [progress, setProgress] = useState(() => getProgress(boost.boost_expires_at));
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = new Date(boost.boost_expires_at).getTime() - Date.now();
      if (remaining <= 0) {
        setExpired(true);
        clearInterval(interval);
        return;
      }
      setTimeLeft(formatTimeRemaining(boost.boost_expires_at));
      setProgress(getProgress(boost.boost_expires_at));
    }, 1000);
    return () => clearInterval(interval);
  }, [boost.boost_expires_at]);

  if (expired) return null;

  const isLuck = boost.reward_type === 'boost_luck';
  const config = boost.reward_config;
  const label = isLuck
    ? `Luck ×${config?.multiplier || 2}`
    : config?.bonus
    ? `+${config.bonus} cartes`
    : config?.multiplier
    ? `×${config.multiplier} cartes`
    : 'Boost';

  const ringColor = isLuck ? 'hsl(45 95% 60%)' : 'hsl(260 70% 65%)';
  const glowColor = isLuck
    ? 'hsl(45 95% 55% / 0.25)'
    : 'hsl(260 70% 55% / 0.25)';
  const borderColor = isLuck
    ? 'hsl(45 95% 55% / 0.4)'
    : 'hsl(260 70% 55% / 0.4)';

  return (
    <div
      className="relative flex items-center gap-2.5 pl-1 pr-3 py-1.5 rounded-2xl overflow-hidden"
      style={{
        background: `linear-gradient(135deg, hsl(240 15% 12% / 0.85) 0%, hsl(240 15% 8% / 0.9) 100%)`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1.5px solid ${borderColor}`,
        boxShadow: `0 4px 24px ${glowColor}, inset 0 1px 0 hsl(0 0% 100% / 0.06)`,
        animation: 'boost-slide-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      }}
    >
      {/* Shimmer sweep */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${isLuck ? 'hsl(45 90% 70% / 0.08)' : 'hsl(260 70% 70% / 0.08)'} 50%, transparent 100%)`,
          animation: 'boost-shimmer 4s ease-in-out infinite',
        }}
      />

      {/* Icon with circular progress ring */}
      <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
        <TimerRing progress={progress} size={32} stroke={2.5} color={ringColor} />
        <div className="relative z-10">
          {isLuck ? (
            <LuckBoostIcon size={18} />
          ) : (
            <PackBoostIcon size={18} />
          )}
        </div>
      </div>

      {/* Label + timer */}
      <div className="flex flex-col leading-none z-10 min-w-0">
        <span
          className="text-xs font-bold tracking-wide"
          style={{
            background: isLuck
              ? 'linear-gradient(to right, hsl(45 100% 70%), hsl(35 90% 55%))'
              : 'linear-gradient(to right, hsl(260 80% 75%), hsl(280 70% 65%))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {label}
        </span>
        <span className="text-[10px] font-mono tabular-nums text-muted-foreground/80 mt-0.5">
          {timeLeft}
        </span>
      </div>
    </div>
  );
};

/* ─── Main overlay ─── */
export const ActiveBoostsOverlay = memo(() => {
  const { user } = useAuth();
  const { data: boosts = [] } = useActiveBoosts(user?.id);

  const activeBoosts = useMemo(
    () => boosts.filter((b) => new Date(b.boost_expires_at).getTime() > Date.now()),
    [boosts]
  );

  if (activeBoosts.length === 0) return null;

  const luckBoosts = activeBoosts.filter((b) => b.reward_type === 'boost_luck');
  const otherBoosts = activeBoosts.filter((b) => b.reward_type !== 'boost_luck');
  const sortedBoosts = [...luckBoosts, ...otherBoosts];

  return createPortal(
    <div className="fixed top-3 left-3 z-[2147483647] flex flex-col gap-2 pointer-events-none">
      {sortedBoosts.map((boost) => (
        <BoostCard key={boost.id} boost={boost} />
      ))}
    </div>,
    document.body
  );
});

ActiveBoostsOverlay.displayName = 'ActiveBoostsOverlay';
