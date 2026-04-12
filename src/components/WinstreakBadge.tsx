import { useState, lazy, Suspense, memo } from 'react';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

const WinstreakDialog = lazy(() => import('./WinstreakDialog').then(m => ({ default: m.WinstreakDialog })));

interface WinstreakBadgeProps {
  streak: number;
}

export const WinstreakBadge = memo(({ streak }: WinstreakBadgeProps) => {
  const [open, setOpen] = useState(false);

  if (streak <= 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "group relative flex items-center gap-1 px-2.5 py-1.5 rounded-full",
          "bg-gradient-to-r from-orange-500/25 via-amber-500/20 to-orange-500/25",
          "border border-orange-400/50",
          "hover:border-orange-400/80 hover:from-orange-500/35 hover:via-amber-500/30 hover:to-orange-500/35",
          "transition-all duration-300 cursor-pointer",
          "shadow-[0_0_14px_hsl(25_100%_50%_/_0.25)] hover:shadow-[0_0_24px_hsl(25_100%_50%_/_0.45)]",
          "backdrop-blur-md active:scale-95"
        )}
      >
        {/* Outer glow ring */}
        <span className="absolute -inset-[1px] rounded-full bg-gradient-to-r from-orange-400/20 via-amber-300/10 to-orange-400/20 blur-[2px] pointer-events-none" />

        {/* Flame with glow */}
        <div className="relative">
          <Flame className="w-4 h-4 text-orange-400 drop-shadow-[0_0_6px_hsl(25_100%_50%_/_0.9)] group-hover:scale-110 transition-transform" />
          <Flame className="absolute inset-0 w-4 h-4 text-orange-300/40 blur-[2px] animate-pulse pointer-events-none" />
        </div>

        <span className="text-sm font-bold text-orange-200 font-mono tabular-nums drop-shadow-[0_0_4px_hsl(25_100%_50%_/_0.5)] relative z-10">
          {streak}
        </span>
      </button>

      <Suspense fallback={null}>
        <WinstreakDialog open={open} onOpenChange={setOpen} streak={streak} />
      </Suspense>
    </>
  );
});

WinstreakBadge.displayName = 'WinstreakBadge';
