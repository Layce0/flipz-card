import { useEffect, useState } from 'react';
import { Sparkles, Package } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveBoosts, ActiveBoost } from '@/hooks/useActiveBoosts';

const formatTimeRemaining = (expiresAt: string): string => {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return '0:00';
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  if (hours > 0) return `${hours}h${String(minutes).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const BoostIndicator = ({ boost }: { boost: ActiveBoost }) => {
  const [timeLeft, setTimeLeft] = useState(() => formatTimeRemaining(boost.boost_expires_at));
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
    }, 1000);
    return () => clearInterval(interval);
  }, [boost.boost_expires_at]);

  if (expired) return null;

  const isLuck = boost.reward_type === 'boost_luck';
  const config = boost.reward_config;
  const label = isLuck
    ? `×${config?.multiplier || 2}`
    : config?.bonus
    ? `+${config.bonus}`
    : config?.multiplier
    ? `×${config.multiplier}`
    : '';

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-background/60 backdrop-blur-sm border border-border/40">
      {isLuck ? (
        <Sparkles className="w-3 h-3 text-amber-400/70" />
      ) : (
        <Package className="w-3 h-3 text-primary/70" />
      )}
      <span className="text-[10px] font-medium text-foreground/60">{label}</span>
      <span className="text-[10px] tabular-nums text-muted-foreground/60">{timeLeft}</span>
    </div>
  );
};

export const ActiveBoostsOverlay = () => {
  const { user } = useAuth();
  const { data: boosts = [] } = useActiveBoosts(user?.id);

  const activeBoosts = boosts.filter(
    (b) => new Date(b.boost_expires_at).getTime() > Date.now()
  );

  if (activeBoosts.length === 0) return null;

  const luckBoosts = activeBoosts.filter((b) => b.reward_type === 'boost_luck');
  const otherBoosts = activeBoosts.filter((b) => b.reward_type !== 'boost_luck');

  return (
    <>
      {otherBoosts.length > 0 && (
        <div className="fixed top-3 left-3 z-40 flex flex-col gap-1 pointer-events-none">
          {otherBoosts.map((boost) => (
            <BoostIndicator key={boost.id} boost={boost} />
          ))}
        </div>
      )}
      {luckBoosts.length > 0 && (
        <div className="fixed top-3 left-3 z-[60] flex flex-col gap-1 pointer-events-none" style={{ marginTop: otherBoosts.length * 32 }}>
          {luckBoosts.map((boost) => (
            <BoostIndicator key={boost.id} boost={boost} />
          ))}
        </div>
      )}
    </>
  );
};
