import { useState, lazy, Suspense } from 'react';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

const WinstreakDialog = lazy(() => import('./WinstreakDialog').then(m => ({ default: m.WinstreakDialog })));

interface WinstreakBadgeProps {
  streak: number;
}

export const WinstreakBadge = ({ streak }: WinstreakBadgeProps) => {
  const [open, setOpen] = useState(false);

  if (streak <= 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-1 px-2.5 py-1.5 rounded-full",
          "bg-card/80 border border-border backdrop-blur-sm",
          "hover:bg-card transition-colors cursor-pointer"
        )}
      >
        <Flame className="w-4 h-4 text-orange-400 drop-shadow-[0_0_6px_hsl(25_100%_50%_/_0.6)]" />
        <span className="text-sm font-semibold text-orange-400 font-mono">{streak}</span>
      </button>

      <Suspense fallback={null}>
        <WinstreakDialog open={open} onOpenChange={setOpen} streak={streak} />
      </Suspense>
    </>
  );
};
