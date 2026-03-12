import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Flame, Gift, Check, Lock, ChevronLeft, ChevronRight, Package, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useWinstreakRewards, useWinstreakClaims, useClaimWinstreakReward } from '@/hooks/useWinstreak';
import { toast } from 'sonner';
import { GameCard } from '@/types/card';
import { PackRevealFlow } from '@/components/shop/PackRevealFlow';
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

export const WinstreakDialog = ({ open, onOpenChange, streak }: WinstreakDialogProps) => {
  const { user } = useAuth();
  const { data: rewards = [] } = useWinstreakRewards();
  const { data: claims = [] } = useWinstreakClaims(user?.id);
  const claimReward = useClaimWinstreakReward();
  const [page, setPage] = useState(() => Math.floor((streak - 1) / DAYS_PER_PAGE));
  const totalPages = Math.ceil(MAX_DAYS / DAYS_PER_PAGE);

  // Reveal flow state
  const [revealedCards, setRevealedCards] = useState<GameCard[]>([]);
  const [isRevealing, setIsRevealing] = useState(false);

  const startDay = page * DAYS_PER_PAGE + 1;
  const days = Array.from({ length: DAYS_PER_PAGE }, (_, i) => startDay + i);

  const handleClaim = async (rewardId: string, dayNumber: number) => {
    if (!user) return;
    try {
      const result = await claimReward.mutateAsync({ userId: user.id, rewardId, dayNumber });

      const reward = result?.reward;
      if (reward?.cards && reward.cards.length > 0) {
        // Trigger reveal flow for packs and card rewards
        setRevealedCards(reward.cards as GameCard[]);
        setIsRevealing(true);
        onOpenChange(false); // Close winstreak dialog to show reveal
      }

      toast.success(result?.message || 'Récompense récupérée !');
    } catch (e: any) {
      toast.error(e?.message || 'Erreur lors de la récupération');
    }
  };

  const handleCloseReveal = () => {
    setIsRevealing(false);
    setRevealedCards([]);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm p-0 overflow-hidden bg-background border-border">
          {/* Header */}
          <div className="px-5 pt-5 pb-3">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Flame className="w-5 h-5 text-orange-400" />
                Série de {streak} jour{streak > 1 ? 's' : ''}
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground mt-1">
              Connectez-vous chaque jour pour débloquer des récompenses
            </p>
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
                const canClaim = isCurrentDay && reward && !isClaimed;
                const RewardIcon = reward ? getRewardIcon(reward.reward_type) : null;

                return (
                  <button
                    key={day}
                    onClick={() => canClaim && handleClaim(reward!.id, day)}
                    disabled={!canClaim || claimReward.isPending}
                    className={cn(
                      "relative flex flex-col items-center gap-1 p-2 rounded-xl border transition-all min-h-[72px] justify-center",
                      isCurrentDay && !isClaimed && "border-orange-400/60 bg-orange-400/10 ring-1 ring-orange-400/30",
                      isCurrentDay && isClaimed && "border-green-500/60 bg-green-500/10",
                      isPast && !isClaimed && "border-border bg-card/50 opacity-50",
                      isPast && isClaimed && "border-green-500/40 bg-green-500/5",
                      isFuture && "border-border bg-card/30 opacity-40",
                      canClaim && "cursor-pointer hover:bg-orange-400/20 active:scale-95",
                      !canClaim && "cursor-default"
                    )}
                  >
                    <span className={cn(
                      "text-[10px] font-semibold",
                      isCurrentDay ? "text-orange-400" : "text-muted-foreground"
                    )}>
                      J{day}
                    </span>

                    {reward && RewardIcon ? (
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center overflow-hidden",
                        isClaimed ? "bg-green-500/20" : isCurrentDay ? "bg-orange-400/20" : "bg-muted"
                      )}>
                        {isClaimed ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : reward.reward_type === 'pack' ? (
                          <img src={packClassicImg} alt="Pack" className="w-14 h-14 object-contain" />
                        ) : (
                          <RewardIcon className={cn(
                            "w-3.5 h-3.5",
                            isCurrentDay ? "text-orange-400" : "text-muted-foreground"
                          )} />
                        )}
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-muted/50 flex items-center justify-center">
                        {isPast || isCurrentDay ? (
                          <Flame className="w-3 h-3 text-muted-foreground/50" />
                        ) : (
                          <Lock className="w-3 h-3 text-muted-foreground/30" />
                        )}
                      </div>
                    )}
                  </button>
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
                  "mt-3 p-2.5 rounded-lg text-xs text-center",
                  isClaimed ? "bg-green-500/10 text-green-400" : "bg-orange-400/10 text-orange-400"
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
          <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-card/50">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="h-8 px-2"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              Jours {startDay}-{Math.min(startDay + DAYS_PER_PAGE - 1, MAX_DAYS)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="h-8 px-2"
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
      />
    </>
  );
};