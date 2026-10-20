import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, Package, Loader2, Sparkles, Users, X, Gavel, Store } from 'lucide-react';
import { Rarity, RARITY_CONFIG, GameCard } from '@/types/card';
import { TRADE_CONFIG } from '@/types/pack';
import { UserCardWithCount, useTradeCards } from '@/hooks/useCards';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { PackRevealFlow } from '@/components/shop/PackRevealFlow';
import { P2PTradeView } from '@/components/shop/P2PTradeView';
import { MarketplaceTab } from '@/components/shop/MarketplaceView';
import { useP2PTrade } from '@/hooks/useP2PTrade';

interface TradeOverviewDialogProps {
  userCards: UserCardWithCount[];
}

export const TradeOverviewDialog = ({ userCards }: TradeOverviewDialogProps) => {
  const [open, setOpen] = useState(false);
  const { session, joinTradeRoom, cancelTrade, isCreator } = useP2PTrade();
  const [confirmAll, setConfirmAll] = useState(false);
  const [tradeMode, setTradeMode] = useState<'p2p' | 'marketplace' | 'system'>('p2p');

  const [targetRoomCode, setTargetRoomCode] = useState<string | null>(null);
  const [isP2PSessionActive, setIsP2PSessionActive] = useState(false);

  const handleCloseDialog = () => {
    if (session && session.status === 'waiting' && isCreator) {
      cancelTrade();
    }
    setOpen(false);
    setTargetRoomCode(null);
  };

  useEffect(() => {
    const handler = (e: any) => {
      if (e?.detail?.roomCode) {
        setTargetRoomCode(e.detail.roomCode);
        setTradeMode('p2p');
        setOpen(true);
        joinTradeRoom(e.detail.roomCode);
      }
    };
    window.addEventListener('open_trade_room', handler);

    // Check for pending trade room
    const pending =
      (window as any).__pendingTradeRoomCode ||
      sessionStorage.getItem('flipz_pending_trade_room') ||
      localStorage.getItem('flipz_pending_trade_room');
    if (pending) {
      setTargetRoomCode(pending);
      setTradeMode('p2p');
      setOpen(true);
      joinTradeRoom(pending);
    }

    return () => window.removeEventListener('open_trade_room', handler);
  }, [joinTradeRoom]);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [tradingCardId, setTradingCardId] = useState<string | null>(null);
  const [revealCards, setRevealCards] = useState<GameCard[]>([]);
  const [showReveal, setShowReveal] = useState(false);
  const [ownedIdsSnapshot, setOwnedIdsSnapshot] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const { t } = useTranslation();
  
  const tradeCards = useTradeCards();

  const getEligibleCardsByRarity = (rarity: Rarity) => {
    const config = TRADE_CONFIG[rarity];
    return userCards.filter(
      (card) => card.rarity === rarity && card.count >= config.required
    );
  };

  const handleTrade = async (cardId: string, rarity: Rarity) => {
    if (!user) return;
    
    setTradingCardId(cardId);
    setOwnedIdsSnapshot(new Set(userCards.map(c => c.id)));
    try {
      const result = await tradeCards.mutateAsync({ cardId, rarity });
      
      toast.success(`Échange réussi ! ${result.rewardCount} nouvelles cartes ajoutées.`);
      
      setOpen(false);
      setRevealCards(result.cards);
      setShowReveal(true);
    } catch (error) {
      console.error('Trade error:', error);
      toast.error("Erreur lors de l'échange");
    } finally {
      setTradingCardId(null);
    }
  };

  const handleRevealClose = () => {
    setShowReveal(false);
    setRevealCards([]);
    setOpen(true);
  };

  const rarities: Rarity[] = ['legendary', 'epic', 'rare', 'common'];

  const totalEligible = rarities.reduce((sum, rarity) => {
    return sum + getEligibleCardsByRarity(rarity).length;
  }, 0);

  // Full plan of every possible trade across all rarities
  const bulkPlan = useMemo(() => {
    const plan: { cardId: string; rarity: Rarity }[] = [];
    for (const rarity of rarities) {
      const config = TRADE_CONFIG[rarity];
      for (const card of getEligibleCardsByRarity(rarity)) {
        const trades = Math.floor(card.count / config.required);
        for (let i = 0; i < trades; i++) {
          plan.push({ cardId: card.id, rarity });
        }
      }
    }
    return plan;
  }, [userCards]);

  const bulkReward = bulkPlan.reduce(
    (sum, t) => sum + TRADE_CONFIG[t.rarity].reward,
    0
  );

  const handleTradeAll = async () => {
    if (!user || bulkPlan.length === 0) return;
    setConfirmAll(false);
    setOwnedIdsSnapshot(new Set(userCards.map(c => c.id)));

    const allCards: GameCard[] = [];
    let failed = false;
    for (let i = 0; i < bulkPlan.length; i++) {
      setBulkProgress({ current: i + 1, total: bulkPlan.length });
      try {
        const result = await tradeCards.mutateAsync({
          cardId: bulkPlan[i].cardId,
          rarity: bulkPlan[i].rarity,
        });
        allCards.push(...result.cards);
      } catch {
        failed = true;
        break;
      }
    }
    setBulkProgress(null);

    if (allCards.length > 0) {
      toast.success(t('trade.tradeAllSuccess', { count: allCards.length }));
      setOpen(false);
      setRevealCards(allCards);
      setShowReveal(true);
    }
    if (failed) {
      toast.error(t('trade.tradeError'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleCloseDialog(); else setOpen(val); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-purple-500/30 hover:border-purple-400 bg-purple-950/20" data-tour="trade-button">
          <ArrowRightLeft className="w-4 h-4 text-purple-400" />
          Échanges disponibles
          {totalEligible > 0 && (
            <span className="bg-yellow-400 text-black text-xs px-2 py-0.5 rounded-full font-black">
              {totalEligible}
            </span>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className={cn(
        "overflow-hidden flex flex-col p-0 border shadow-2xl transition-all duration-300 text-white [&>button]:hidden",
        tradeMode === 'p2p' && (isP2PSessionActive || session)
          ? "max-w-4xl lg:max-w-5xl w-full max-h-[94vh] rounded-2xl sm:rounded-3xl bg-[#090a16] border-purple-500/30"
          : "max-w-xl md:max-w-3xl w-full max-h-[92vh] rounded-2xl sm:rounded-3xl bg-[#0c0d18] border-purple-500/30 shadow-[0_20px_60px_rgba(0,0,0,0.85),0_0_40px_rgba(112,26,117,0.25)]"
      )}>
        <DialogTitle className="sr-only">Échanges FLIPZ</DialogTitle>
        <DialogDescription className="sr-only">Interface d'échange de cartes et d'objets entre joueurs</DialogDescription>
        {/* Top Header with Switcher Tabs */}
        <div className="relative flex items-center justify-between px-3.5 sm:px-4 py-3 bg-[#0d0d1a] border-b border-white/10">
          {session ? (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="text-xs sm:text-sm font-black text-white tracking-wide uppercase">
                Échange en direct
              </span>
              <span className="px-2 py-0.5 rounded-md bg-purple-950/70 border border-purple-500/30 font-mono text-[11px] font-bold text-purple-300">
                #{session.code}
              </span>
            </div>
          ) : (
            /* Triple Tab Switcher Pill */
            <div className="inline-flex items-center p-1 rounded-xl bg-black/40 border border-white/10 overflow-x-auto">
              <button
                onClick={() => setTradeMode('p2p')}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap",
                  tradeMode === 'p2p'
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Échange P2P</span>
              </button>

              <button
                onClick={() => setTradeMode('marketplace')}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap",
                  tradeMode === 'marketplace'
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 text-black shadow-sm"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Marketplace</span>
              </button>

              <button
                onClick={() => setTradeMode('system')}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap",
                  tradeMode === 'system'
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Recyclage</span>
                {totalEligible > 0 && (
                  <span className="px-1.5 py-0.2 bg-yellow-400 text-black text-[10px] font-black rounded-full">
                    {totalEligible}
                  </span>
                )}
              </button>
            </div>
          )}

          <button
            onClick={handleCloseDialog}
            className="text-zinc-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        {tradeMode === 'p2p' ? (
          <div className="flex-1 overflow-y-auto bg-[#0a0a14]">
            <P2PTradeView 
              initialRoomCode={targetRoomCode}
              onSessionStateChange={setIsP2PSessionActive}
              onClose={handleCloseDialog}
              onSwitchToSystem={() => setTradeMode('system')}
            />
          </div>
        ) : tradeMode === 'marketplace' ? (
          <div className="flex-1 overflow-hidden bg-[#0a0a14] flex flex-col">
            <MarketplaceTab userCards={userCards} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-5 bg-[#0b0c14] text-white">
            {/* Title / Description */}
            <div className="mb-3.5">
              <div className="flex items-start gap-2.5">
                <ArrowRightLeft className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h2 className="text-[17px] font-bold text-white tracking-tight">
                    Aperçu des échanges
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Faites défiler pour voir toutes vos cartes éligibles à l'échange.
                  </p>
                </div>
              </div>
            </div>

            {/* Bulk Button - EXACT Image 2: Yellow pill, box icon, Tout échanger (+XXX) */}
            {bulkPlan.length > 0 && (
              <div className="mb-3.5">
                <button
                  disabled={tradingCardId !== null || bulkProgress !== null}
                  onClick={() => setConfirmAll(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#eab308] hover:bg-[#facc15] text-black font-bold text-xs sm:text-sm tracking-wide shadow transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  {bulkProgress ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('trade.tradeAllProgress', bulkProgress)}</span>
                    </>
                  ) : (
                    <>
                      <Package className="w-4 h-4 text-black" />
                      <span>Tout échanger (+{bulkReward})</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Cards by Rarity List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
              {rarities.map((rarity) => {
                const config = TRADE_CONFIG[rarity];
                const rarityConfig = RARITY_CONFIG[rarity];
                const eligibleCards = getEligibleCardsByRarity(rarity);

                return (
                  <div
                    key={rarity}
                    className="rounded-2xl border border-zinc-800/80 bg-[#12131e] p-3 space-y-2.5"
                  >
                    {/* Header: Rarity pill on left, X -> Y on right */}
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-lg text-[11px] font-bold tracking-wider",
                          rarity === 'legendary' ? "bg-amber-400 text-black font-extrabold" :
                          rarity === 'epic' ? "bg-purple-600 text-white font-bold" :
                          rarity === 'rare' ? "bg-blue-600 text-white font-bold" :
                          "bg-zinc-600 text-white font-bold"
                        )}
                      >
                        {rarityConfig.label.toUpperCase()}
                      </span>
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-medium">
                        <Package className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{config.required} → {config.reward} cartes</span>
                      </div>
                    </div>

                    {/* Scrollable cards list */}
                    {eligibleCards.length === 0 ? (
                      <p className="text-xs text-zinc-500 text-center py-2.5 italic">
                        Aucune carte éligible
                      </p>
                    ) : (
                      <div className="overflow-x-auto pb-1 scrollbar-thin">
                        <div className="flex gap-2 min-w-min">
                          {eligibleCards.map((card) => (
                            <button
                              key={card.id}
                              onClick={() => handleTrade(card.id, rarity)}
                              disabled={tradingCardId !== null}
                              className="flex-shrink-0 relative w-[72px] h-[92px] rounded-xl overflow-hidden border border-zinc-700/60 hover:border-yellow-400 group transition-all active:scale-95 disabled:opacity-50 shadow-sm bg-zinc-900"
                            >
                              <img
                                src={card.image_url}
                                alt={card.title}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                              
                              <div className="absolute bottom-0 inset-x-0 p-1 text-center">
                                <span className="text-[9px] text-white font-medium truncate block leading-tight">
                                  {card.title}
                                </span>
                                <span className="text-[11px] text-amber-400 font-black leading-none mt-0.5 block">
                                  ×{card.count}
                                </span>
                              </div>

                              {tradingCardId === card.id && (
                                <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                                  <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-right">
                      <span className="text-[10px] text-zinc-500 font-normal">
                        {eligibleCards.length} carte{eligibleCards.length > 1 ? 's' : ''} éligible{eligibleCards.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer close button */}
            <div className="pt-3 mt-1">
              <button
                onClick={() => setOpen(false)}
                className="w-full py-2.5 rounded-xl border border-zinc-800 bg-[#12131e] hover:bg-zinc-800/80 text-yellow-400 font-bold text-xs tracking-wide transition-all active:scale-[0.99]"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Bulk trade confirmation */}
      <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
        <AlertDialogContent className="bg-[#120b24] border-2 border-purple-500/40 text-white rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black text-yellow-400">
              {t('trade.tradeAllConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-300">
              {t('trade.tradeAllConfirmDescription', { cards: bulkPlan.length, reward: bulkReward })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-purple-950/60 hover:bg-purple-900 text-zinc-300 border-purple-500/30">
              {t('common.cancel', 'Annuler')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTradeAll}
              className="bg-yellow-400 hover:bg-yellow-500 text-black font-black"
            >
              {t('trade.tradeAll')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pack reveal flow */}
      <PackRevealFlow
        cards={revealCards}
        isOpen={showReveal}
        onClose={handleRevealClose}
        packType="standard"
      />
    </Dialog>
  );
};
