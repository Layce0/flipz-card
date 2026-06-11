import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Flame, Gift, Check, Lock, ChevronLeft, ChevronRight, Package, Sparkles, Zap, Crown, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useWinstreakRewards, useWinstreakClaims, useClaimWinstreakReward, useUserStreak } from '@/hooks/useWinstreak';
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

const CARDS_PER_STREAK = 2;
const TIMER_HOURS = 24;

const ExpiryCountdown = ({ updatedAt }: { updatedAt: string | undefined }) => {
  const [label, setLabel] = useState('--:--:--');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!updatedAt) return;
    const tick = () => {
      const end = new Date(updatedAt).getTime() + TIMER_HOURS * 3600 * 1000;
      const remaining = Math.max(0, Math.floor((end - Date.now()) / 1000));
      if (remaining <= 0) {
        setExpired(true);
        setLabel('Expirée');
        return;
      }
      setExpired(false);
      const h = Math.floor(remaining / 3600).toString().padStart(2, '0');
      const m = Math.floor((remaining % 3600) / 60).toString().padStart(2, '0');
      const s = (remaining % 60).toString().padStart(2, '0');
      setLabel(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [updatedAt]);

  return (
    <div className={cn(
      "flex items-center justify-center gap-1.5 mt-2 px-3 py-1.5 rounded-full text-xs font-semibold border",
      expired
        ? "bg-destructive/10 text-destructive border-destructive/30"
        : "bg-orange-500/10 text-orange-300 border-orange-400/30"
    )}>
      <Clock className="w-3.5 h-3.5" />
      <span className="font-mono tabular-nums">{label}</span>
      {!expired && <span className="text-muted-foreground/70 font-normal">avant reset</span>}
    </div>
  );
};

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

const getRewardColor = (type: string) => {
  switch (type) {
    case 'pack_ultra': return 'from-purple-400 to-violet-500';
    case 'pack_lucky': return 'from-emerald-400 to-teal-500';
    case 'pack': return 'from-blue-400 to-indigo-500';
    case 'card': return 'from-amber-400 to-orange-500';
    case 'boost_luck':
    case 'boost_pack': return 'from-cyan-400 to-blue-500';
    default: return 'from-gray-400 to-gray-500';
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
  const hasCustomIcon = reward?.icon_url && !isClaimed;

  return (
    <button
      onClick={() => canClaim && onClaim()}
      disabled={!canClaim || isPending}
      className={cn(
        "relative flex flex-col items-center gap-1 rounded-2xl border transition-all duration-300 overflow-hidden",
        "min-h-[88px] justify-center",
        // Claimed
        isClaimed && "border-emerald-500/40 bg-emerald-500/10",
        // Current day claimable
        isCurrentDay && !isClaimed && "border-orange-400/60 bg-gradient-to-b from-orange-500/15 to-amber-600/10 shadow-[0_0_20px_hsl(25_100%_55%_/_0.3)]",
        // Past unclaimed
        isPast && !isClaimed && "border-border/40 bg-card/30 opacity-35",
        // Future
        isFuture && "border-border/20 bg-card/15 opacity-25",
        // Interactions
        canClaim && "cursor-pointer hover:scale-[1.06] hover:shadow-[0_0_28px_hsl(25_100%_55%_/_0.5)] active:scale-95",
        !canClaim && "cursor-default"
      )}
    >
      {/* Shimmer on claimable */}
      {canClaim && (
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-300/15 to-transparent animate-shimmer pointer-events-none" />
      )}

      {/* Pulsing ring on current day */}
      {isCurrentDay && !isClaimed && (
        <span className="absolute inset-0 rounded-2xl border-2 border-orange-400/30 animate-pulse pointer-events-none" />
      )}

      {/* Day number */}
      <span className={cn(
        "text-[9px] font-bold uppercase tracking-widest z-10 leading-none",
        isClaimed ? "text-emerald-400/90" : isCurrentDay ? "text-orange-300" : "text-muted-foreground/50"
      )}>
        J{day}
      </span>

      {/* Icon area */}
      {hasCustomIcon ? (
        <img src={reward.icon_url} alt={`J${day}`} className="absolute inset-0 w-full h-full object-cover rounded-xl opacity-90" />
      ) : reward && RewardIcon ? (
        <div className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center z-10 transition-all",
          isClaimed
            ? "bg-emerald-500/20"
            : isCurrentDay
            ? cn("bg-gradient-to-br", getRewardColor(reward.reward_type), "shadow-lg")
            : "bg-muted/40"
        )}>
          {isClaimed ? (
            <div className="w-6 h-6 rounded-full bg-emerald-500/30 flex items-center justify-center">
              <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={3} />
            </div>
          ) : reward.reward_type === 'pack' ? (
            <img src={packClassicImg} alt="Pack" className="w-11 h-11 object-contain drop-shadow-lg" />
          ) : (
            <RewardIcon className={cn(
              "w-4 h-4",
              isCurrentDay ? "text-white drop-shadow-md" : "text-muted-foreground/60"
            )} />
          )}
        </div>
      ) : (
        <div className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center z-10",
          isPast || isCurrentDay ? "bg-muted/30" : "bg-muted/15"
        )}>
          {isFuture ? (
            <Lock className="w-3 h-3 text-muted-foreground/20" />
          ) : (
            <Flame className="w-3.5 h-3.5 text-muted-foreground/30" />
          )}
        </div>
      )}

      {/* Small label under icon for current day reward */}
      {isCurrentDay && !isClaimed && reward && (
        <span className="text-[7px] font-semibold text-orange-300/80 z-10 leading-none mt-0.5 truncate max-w-full px-1">
          Récupérer
        </span>
      )}
    </button>
  );
};

export const WinstreakDialog = ({ open, onOpenChange, streak }: WinstreakDialogProps) => {
  const { user } = useAuth();
  const { data: rewards = [] } = useWinstreakRewards();
  const { data: claims = [] } = useWinstreakClaims(user?.id);
  const { data: userStreak } = useUserStreak(user?.id);
  const claimReward = useClaimWinstreakReward();
  const progress = userStreak?.streak_progress ?? 0;
  const [page, setPage] = useState(() => Math.floor(Math.max(streak - 1, 0) / DAYS_PER_PAGE));
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

  // Milestones on current page
  const rewardsOnPage = days.filter(d => rewards.some(r => r.day_number === d)).length;
  const claimedOnPage = days.filter(d => claims.some(c => c.day_number === d)).length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm p-0 overflow-hidden bg-background/95 backdrop-blur-xl border-orange-400/20 shadow-[0_0_50px_hsl(25_100%_50%_/_0.12)]">
          {/* Header */}
          <div className="relative px-5 pt-5 pb-3 overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-orange-500/8 via-transparent to-transparent pointer-events-none" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-16 bg-orange-400/10 blur-3xl pointer-events-none" />

            <DialogHeader className="relative z-10">
              <DialogTitle className="flex items-center gap-3 text-lg">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 via-amber-500 to-orange-600 flex items-center justify-center shadow-[0_0_20px_hsl(25_100%_50%_/_0.5)]">
                    <Flame className="w-5 h-5 text-background" />
                  </div>
                  {/* Glow behind icon */}
                  <div className="absolute inset-0 rounded-full bg-orange-400/20 blur-md animate-pulse pointer-events-none" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-extrabold text-foreground tabular-nums">
                      {streak}
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">
                      jour{streak > 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="text-[10px] text-orange-400/70 font-medium tracking-wide uppercase -mt-0.5">
                    Série en cours
                  </span>
                </div>
                {streak >= 7 && (
                  <Crown className="w-5 h-5 text-amber-400/60 ml-auto" />
                )}
              </DialogTitle>
            </DialogHeader>

            {/* Progress dots */}
            <div className="flex items-center gap-1.5 mt-3 z-10 relative">
              {days.map((day) => {
                const isClaimed = claims.some(c => c.day_number === day);
                const isCurrentDay = day === streak;
                const isPast = day < streak;
                return (
                  <div key={day} className="flex-1 h-1.5 rounded-full overflow-hidden bg-muted/40">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        isClaimed ? "w-full bg-emerald-400" :
                        isCurrentDay ? "w-full bg-gradient-to-r from-orange-400 to-amber-500" :
                        isPast ? "w-full bg-muted-foreground/30" :
                        "w-0"
                      )}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Days grid */}
          <div className="px-4 pb-3">
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

            {/* Current day reward info */}
            {(() => {
              const currentReward = rewards.find(r => r.day_number === streak);
              if (!currentReward) return null;
              const isClaimed = claims.some(c => c.day_number === streak);
              return (
                <div className={cn(
                  "mt-3 p-2.5 rounded-xl text-xs text-center font-semibold border transition-all",
                  isClaimed
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-gradient-to-r from-orange-400/10 via-amber-500/8 to-orange-400/10 text-orange-300 border-orange-400/20 shadow-[inset_0_0_20px_hsl(25_100%_50%_/_0.05)]"
                )}>
                  {isClaimed
                    ? <span className="flex items-center justify-center gap-1.5"><Check className="w-3.5 h-3.5" /> Récompense récupérée</span>
                    : <span className="flex items-center justify-center gap-1.5"><Gift className="w-3.5 h-3.5" /> {getRewardLabel(currentReward.reward_type, currentReward.reward_config as Record<string, any>)}</span>
                  }
                </div>
              );
            })()}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-border/40 bg-card/20">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="h-8 w-8 p-0 rounded-full hover:bg-orange-400/10 disabled:opacity-20"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex flex-col items-center">
              <span className="text-xs text-muted-foreground/80 font-mono tabular-nums">
                Jours {startDay}–{Math.min(startDay + DAYS_PER_PAGE - 1, MAX_DAYS)}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="h-8 w-8 p-0 rounded-full hover:bg-orange-400/10 disabled:opacity-20"
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
