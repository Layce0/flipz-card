import { useState, lazy, Suspense, memo } from 'react';
import { Flame, FlameKindling, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useRestoreStreak } from '@/hooks/useWinstreak';
import { toast } from 'sonner';

const WinstreakDialog = lazy(() => import('./WinstreakDialog').then(m => ({ default: m.WinstreakDialog })));

interface WinstreakBadgeProps {
  streak: number;
}

export const WinstreakBadge = memo(({ streak }: WinstreakBadgeProps) => {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const restoreStreak = useRestoreStreak();
  
  const previousStreak = user?.user_metadata?.previous_streak;
  const restoreExpiresAt = user?.user_metadata?.restore_expires_at;
  const canRestore = streak <= 0 && previousStreak > 0 && restoreExpiresAt && new Date(restoreExpiresAt) > new Date();

  const handleRestore = async () => {
    try {
      await restoreStreak.mutateAsync();
      toast.success('Série restaurée avec succès !');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la restauration');
    }
  };

  if (streak <= 0 && !canRestore) return null;

  if (canRestore) {
    return (
      <button
        onClick={handleRestore}
        disabled={restoreStreak.isPending}
        className={cn(
          "group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-full",
          "bg-gradient-to-r from-gray-500/25 via-gray-400/20 to-gray-500/25",
          "border border-gray-400/50 hover:border-gray-300/80",
          "transition-all duration-300 cursor-pointer backdrop-blur-md active:scale-95"
        )}
      >
        <div className="relative flex items-center">
          {restoreStreak.isPending ? (
            <Loader2 className="w-4 h-4 text-gray-300 animate-spin" />
          ) : (
            <FlameKindling className="w-4 h-4 text-gray-400" />
          )}
        </div>
        <span className="text-xs font-semibold text-gray-300 flex flex-col items-start leading-tight">
          <span>{previousStreak} perdu</span>
          <span className="text-[9px] text-gray-400">Restaurez !</span>
        </span>
      </button>
    );
  }

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
