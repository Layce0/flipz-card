import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Flame, Gift, Check, Lock, ChevronLeft, ChevronRight, Package, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useWinstreakRewards, useWinstreakClaims, useClaimWinstreakReward } from '@/hooks/useWinstreak';
import { toast } from 'sonner';
import { GameCard } from '@/types/card';
import { PackRevealFlow } from '@/components/shop/PackRevealFlow';
import { PackAnimationType } from '@/components/PackOpeningAnimation';
import packClassicImg from '@/assets/pack-classic-reward.png';

interface WinstreakDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  streak: number;
}

const DAYS_PER_PAGE = 5;
const MAX_DAYS = 100;

const getRewardIcon = (type: string) => {
  switch (type) {
    case 'pack':
    case 'pack_lucky':
    case 'pack_ultra':
      return Package;
    case 'card':
      return Sparkles;
    case 'boost_luck':
    case 'boost_pack':
      return Zap;
    default:
      return Gift;
  }
};

const getRewardLabel = (type: string, config: Record<string, any>) => {
  switch (type) {
    case 'pack': return `Pack Standard (${config?.card_count || 5} cartes)`;
    case 'pack_lucky': return `Pack Chanceux (${config?.card_count || 5} cartes)`;
    case 'pack_ultra': return `Pack Ultra (${config?.card_count || 5} cartes)`;
    case 'card': return 'Carte spécifique';
    case 'boost_luck': return `Luck ×${config?.multiplier || 2}`;
    case 'boost_pack': {
      if (config?.multiplier) return `×${config.multiplier} cartes/pack`;
      if (config?.bonus) return `+${config.bonus} cartes/pack`;
      return 'Boost pack';
    }
    default: return type;
  }
};

const DayCell = ({
  day,
  reward,
  isClaimed,
  isCurrentDay,
  isPast,
  isFuture,
  canClaim,
  isPending,
  onClaim,
}: {
  day: number;
  reward: any;
  isClaimed: boolean;
  isCurrentDay: boolean;
  isPast: boolean;
  isFuture: boolean;
  canClaim: boolean;
  isPending: boolean;
  onClaim: () => void;
}) => {
  const RewardIcon = reward ? getRewardIcon(reward.reward_type) : null;

  return (
    <button
      onClick={() => canClaim && onClaim()}
      disabled={!canClaim || isPending}
      className={cn(
        "relative flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all min-h-[80px] justify-center overflow-hidden",
        // Current day — pulsing glow
        isCurrentDay && !isClaimed && "border-orange-400/70 bg-gradient-to-b from-orange-400/15 to-amber-500/10 shadow-[0_0_16px_hsl(25_100%_50%_/_0.25)]",
        isCurrentDay && isClaimed && "border-emerald-400/60 bg-gradient-to-b from-emerald-400/10 to-emerald-500/5",
        // Past
        isPast && !isClaimed && "border-border/60 bg-card/40 opacity-40",
        isPast && isClaimed && "border-emerald-500/30 bg-emerald-500/5",
        // Future
        isFuture && "border-border/30 bg-card/20 opacity-30",
        // Interactions
        canClaim && "cursor-pointer hover:scale-105 hover:shadow-[0_0_24px_hsl(25_100%_50%_/_0.4)] active:scale-95",
        !canClaim && "cursor-default"
      )}
    >
      {/* Shimmer effect on claimable */}
      {canClaim && (
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-400/10 to-transparent animate-shimmer pointer-events-none" />
      )}

      {/* Day label */}
      <span className={cn(
        "text-[10px] font-bold uppercase tracking-wider z-10",
        isCurrentDay ? "text-orange-300" : isClaimed ? "text-emerald-400/80" : "text-muted-foreground/70"
      )}>
        J{day}
      </span>

      {/* Reward icon */}
      {reward && RewardIcon ? (
        (reward as any).icon_url && !isClaimed ? (
          <img src={(reward as any).icon_url} alt={`J${day}`} className="absolute inset-0 w-full h-full object-cover rounded-xl" />
        ) : (
          <div className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center z-10 transition-all",
            isClaimed
              ? "bg-emerald-500/20 ring-1 ring-emerald-400/30"
              : isCurrentDay
              ? "bg-orange-400/20 ring-1 ring-orange-400/30"
              : "bg-muted/60"
          )}>
            {isClaimed ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : reward.reward_type === 'pack' ? (
              <img src={packClassicImg} alt="Pack" className="w-12 h-12 object-contain" />
            ) : (
              <RewardIcon className={cn(
                "w-4 h-4",
                isCurrentDay ? "text-orange-300" : "text-muted-foreground/70"
              )} />
            )}
          </div>
        )
      ) : (
        <div className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center z-10",
          isPast || isCurrentDay ? "bg-muted/40" : "bg-muted/20"
        )}>
          {isPast || isCurrentDay ? (
            <Flame className="w-3.5 h-3.5 text-muted-foreground/40" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-muted-foreground/20" />
          )}
        </div>
      )}
    </button>
  );
};

export const WinstreakDialog = ({ open, onOpenChange, streak }: WinstreakDialogProps) => {
  const { user } = useAuth();
  const { data: rewards = [] } = useWinstreakRewards();
  const { data: claims = [] } = useWinstreakClaims(user?.id);
  const claimReward = useClaimWinstreakReward();
  const [page, setPage] = useState(() => Math.floor((streak - 1) / DAYS_PER_PAGE));
  const totalPages = Math.ceil(MAX_DAYS / DAYS_PER_PAGE);

  const [revealedCards, setRevealedCards] = useState<GameCard[]>([]);
  const [isRevealing, setIsRevealing] = useState(false);
  const [revealPackType, setRevealPackType] = useState<PackAnimationType>('free');
  const claimingRef = useRef(false);

  const startDay = page * DAYS_PER_PAGE + 1;
  const days = Array.from({ length: DAYS_PER_PAGE }, (_, i) => startDay + i);

  const handleClaim = async (rewardId: string, dayNumber: number) => {
    if (!user || claimingRef.current) return;
    claimingRef.current = true;
    try {
      const result = await claimReward.mutateAsync({ userId: user.id, rewardId, dayNumber });
      const reward = result?.reward;
      if (reward?.cards && reward.cards.length > 0) {
        const rewardType = reward.type || 'pack';
        const animType: PackAnimationType = rewardType === 'pack_ultra' ? 'ultra' : rewardType === 'pack_lucky' ? 'lucky' : 'standard';
        setRevealPackType(animType);
        setRevealedCards(reward.cards as GameCard[]);
        setIsRevealing(true);
        onOpenChange(false);
      }
      toast.success(result?.message || 'Récompense récupérée !');
    } catch (e: any) {
      toast.error(e?.message || 'Erreur lors de la récupération');
    } finally {
      claimingRef.current = false;
    }
  };

  const handleCloseReveal = () => {
    setIsRevealing(false);
    setRevealedCards([]);
  };

  // Progress within current page
  const pageProgress = Math.min(Math.max(((streak - startDay + 1) / DAYS_PER_PAGE) * 100, 0), 100);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm p-0 overflow-hidden bg-background/95 backdrop-blur-xl border-orange-400/20 shadow-[0_0_40px_hsl(25_100%_50%_/_0.15)]">
          {/* Header with flame gradient */}
          <div className="relative px-5 pt-5 pb-4 overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-orange-400/10 via-transparent to-transparent pointer-events-none" />
            
            <DialogHeader className="relative z-10">
              <DialogTitle className="flex items-center gap-2.5 text-lg">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center shadow-[0_0_16px_hsl(25_100%_50%_/_0.4)]">
                  <Flame className="w-4 h-4 text-background" />
                </div>
                <div className="flex flex-col">
                  <span className="text-foreground font-bold">
                    {streak} jour{streak > 1 ? 's' : ''}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-normal -mt-0.5">
                    Série en cours
                  </span>
                </div>
              </DialogTitle>
            </DialogHeader>

            {/* Progress bar */}
            <div className="relative mt-3 z-10">
              <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-500 transition-all duration-500 ease-out"
                  style={{ width: `${pageProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Days grid */}
          <div className="px-5 pb-4">
            <div className="grid grid-cols-5 gap-2">
              {days.map((day) => {
                const reward = rewards.find(r => r.day_number === day);
                const isClaimed = claims.some(c => c.day_number === day);
                const isCurrentDay = day === streak;
                const isPast = day < streak;
                const isFuture = day > streak;
                const canClaim = isCurrentDay && !!reward && !isClaimed;

                return (
                  <DayCell
                    key={day}
                    day={day}
                    reward={reward}
                    isClaimed={isClaimed}
                    isCurrentDay={isCurrentDay}
                    isPast={isPast}
                    isFuture={isFuture}
                    canClaim={canClaim}
                    isPending={claimReward.isPending}
                    onClaim={() => handleClaim(reward!.id, day)}
                  />
                );
              })}
            </div>

            {/* Reward info for current day */}
            {(() => {
              const currentReward = rewards.find(r => r.day_number === streak);
              if (!currentReward) return null;
              const isClaimed = claims.some(c => c.day_number === streak);
              return (
                <div className={cn(
                  "mt-3 p-3 rounded-xl text-xs text-center font-medium border transition-all",
                  isClaimed
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-400/20"
                    : "bg-gradient-to-r from-orange-400/10 via-amber-500/10 to-orange-400/10 text-orange-300 border-orange-400/20"
                )}>
                  {isClaimed
                    ? '✓ Récompense du jour récupérée'
                    : `🎁 ${getRewardLabel(currentReward.reward_type, currentReward.reward_config as Record<string, any>)}`
                  }
                </div>
              );
            })()}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-border/50 bg-card/30">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="h-8 w-8 p-0 rounded-full hover:bg-orange-400/10"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              {startDay}–{Math.min(startDay + DAYS_PER_PAGE - 1, MAX_DAYS)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="h-8 w-8 p-0 rounded-full hover:bg-orange-400/10"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PackRevealFlow
        cards={revealedCards}
        isOpen={isRevealing}
        onClose={handleCloseReveal}
        packType={revealPackType}
      />
    </>
  );
};
