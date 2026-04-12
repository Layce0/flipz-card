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
          "group relative flex items-center gap-1.5 px-3 py-2 rounded-full",
          "bg-gradient-to-r from-orange-500/20 via-amber-500/15 to-orange-500/20",
          "border border-orange-400/40",
          "hover:border-orange-400/70 hover:from-orange-500/30 hover:via-amber-500/25 hover:to-orange-500/30",
          "transition-all duration-300 cursor-pointer",
          "shadow-[0_0_12px_hsl(25_100%_50%_/_0.2)] hover:shadow-[0_0_20px_hsl(25_100%_50%_/_0.4)]",
          "backdrop-blur-md"
        )}
      >
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-orange-400/30 pointer-events-none" style={{ animationDuration: '3s' }} />
        
        <Flame className="w-4 h-4 text-orange-400 drop-shadow-[0_0_8px_hsl(25_100%_50%_/_0.8)] group-hover:scale-110 transition-transform" />
        <span className="text-sm font-bold text-orange-300 font-mono tabular-nums drop-shadow-[0_0_4px_hsl(25_100%_50%_/_0.5)]">
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
