import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Navigation } from '@/components/Navigation';
import { CollectionBook } from '@/components/CollectionBook';
import { RarityTabs } from '@/components/RarityTabs';
import { GameCard, Rarity } from '@/types/card';
import { BookOpen, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAllCards, useUserCards, useClaimMilestone } from '@/hooks/useCards';
import { useBoosters, useBoosterCards } from '@/hooks/useBoosters';
import { useNewCardIndicator } from '@/hooks/useNewCardIndicator';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PackRevealFlow } from '@/components/shop/PackRevealFlow';

const CardDetailDialog = lazy(() => import('@/components/CardDetailDialog').then(m => ({ default: m.CardDetailDialog })));

const Collection = () => {
  const [activeRarity, setActiveRarity] = useState<Rarity | 'all'>('all');
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const { data: rawCards = [], isLoading: cardsLoading } = useAllCards();
  const { data: rawUserCards = [], isLoading: userCardsLoading } = useUserCards(user?.id);
  const { data: boosters = [] } = useBoosters();
  const { data: boosterCards = [] } = useBoosterCards();
  const [activeBooster, setActiveBooster] = useState<string | null>(null);
  const ownedIds = useMemo(() => new Set(rawUserCards.map((c: any) => c.id)), [rawUserCards]);
  // Booster categories only appear once the player owns a card created exclusively for that booster
  const visibleBoosters = useMemo(() => boosters.filter(b =>
    rawCards.some((c: any) => c.booster_id === b.id && ownedIds.has(c.id))
  ), [boosters, rawCards, ownedIds]);
  const allCards = useMemo(() => {
    if (activeBooster) {
      const entries = new Map(boosterCards.filter(bc => bc.booster_id === activeBooster).map(bc => [bc.card_id, bc]));
      return rawCards
        .filter((c: any) => c.booster_id === activeBooster)
        .map(c => {
          const custom = entries.get(c.id)?.custom_rarity ?? null;
          const b = boosters.find(x => x.id === activeBooster);
          return { ...c, custom_rarity: custom, custom_rarity_color: custom ? b?.rarity_colors?.[custom] ?? null : null, card_back_url: b?.card_back_url ?? null };
        });
    }
    return rawCards.filter((c: any) => !c.booster_id);
  }, [rawCards, boosterCards, boosters, activeBooster]);
  const [activeCustom, setActiveCustom] = useState<string>('all');
  const activeBoosterObj = boosters.find(b => b.id === activeBooster);
  const customOrder: string[] = activeBoosterObj?.custom_rarities ?? [];
  // Cards shown in the book: in a booster tab, filtered by special rarity and sorted by the admin-defined order
  const bookCards = useMemo(() => {
    if (!activeBooster) return allCards;
    const rank = (c: GameCard) => { const i = customOrder.indexOf(c.custom_rarity ?? ''); return i < 0 ? 999 : i; };
    return allCards
      .filter(c => activeCustom === 'all' || c.custom_rarity === activeCustom)
      .sort((a, b) => rank(a) - rank(b));
  }, [allCards, activeBooster, activeCustom, customOrder]);
  const userCards = useMemo(() => {
    const ids = new Set(allCards.map(c => c.id));
    return rawUserCards.filter((c: any) => ids.has(c.id));
  }, [rawUserCards, allCards]);
  const { newCardIds, markAsSeen } = useNewCardIndicator();
  const claimMilestone = useClaimMilestone();

  // Milestone logic
  const [claimedMilestones, setClaimedMilestones] = useState<number[]>([]);
  
  useEffect(() => {
    if (user?.id) {
      const stored = localStorage.getItem(`flipz_collection_milestones_${user.id}`);
      if (stored) {
        try {
          setClaimedMilestones(JSON.parse(stored));
        } catch(e) {
          console.error(e);
        }
      }
    }
  }, [user?.id]);

  const [revealedCards, setRevealedCards] = useState<GameCard[]>([]);
  const [isRevealing, setIsRevealing] = useState(false);

  // Clear "Nouveau" badges when leaving the collection page
  useEffect(() => {
    return () => {
      markAsSeen();
    };
  }, [markAsSeen]);
  
  // Card detail dialog state — index into the navigable (collected) list
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const collectedCardIds = useMemo(() => new Set(userCards.map(card => card.id)), [userCards]);
  
  const cardCountMap = useMemo(() => new Map(userCards.map(card => [card.id, card.count])), [userCards]);
  
  const obtainedAtMap = useMemo(() => new Map(userCards.map(card => [card.id, card.obtained_at])), [userCards]);

  // Collected cards in the same order as the book — used for card-by-card navigation in the detail view
  // Must match exactly what CollectionBook shows: collected first (sorted by date), then uncollected hidden.
  const navigableCards = useMemo(() => {
    const source = activeRarity !== 'all' && !activeBooster
      ? bookCards.filter(c => c.rarity === activeRarity)
      : bookCards;
    return source
      .filter(c => collectedCardIds.has(c.id))
      .sort((a, b) => (obtainedAtMap.get(b.id) || '').localeCompare(obtainedAtMap.get(a.id) || ''));
  }, [bookCards, activeBooster, activeRarity, collectedCardIds, obtainedAtMap]);
  
  const totalCardsCollected = useMemo(() => userCards.reduce((sum, card) => sum + card.count, 0), [userCards]);
  
  const selectedCard = selectedIndex !== null ? navigableCards[selectedIndex] ?? null : null;
  const selectedCardCount = selectedCard ? cardCountMap.get(selectedCard.id) || 0 : 0;

  const handleCardClick = useCallback((card: GameCard, _count: number) => {
    const idx = navigableCards.findIndex(c => c.id === card.id);
    setSelectedIndex(idx >= 0 ? idx : null);
    setDetailOpen(true);
  }, [navigableCards]);

  const handleNavigate = useCallback((delta: number) => {
    setSelectedIndex(prev => {
      if (prev === null) return prev;
      return Math.max(0, Math.min(navigableCards.length - 1, prev + delta));
    });
  }, [navigableCards.length]);

  const counts = useMemo(() => ({
    all: allCards.length,
    common: allCards.filter(c => c.rarity === 'common').length,
    rare: allCards.filter(c => c.rarity === 'rare').length,
    epic: allCards.filter(c => c.rarity === 'epic').length,
    legendary: allCards.filter(c => c.rarity === 'legendary').length,
  }), [allCards]);

  const collectedCounts = useMemo(() => {
    // Count unique cards collected per rarity (userCards is already deduplicated)
    const common = userCards.filter(c => c.rarity === 'common').length;
    const rare = userCards.filter(c => c.rarity === 'rare').length;
    const epic = userCards.filter(c => c.rarity === 'epic').length;
    const legendary = userCards.filter(c => c.rarity === 'legendary').length;
    return {
      all: userCards.length,
      common,
      rare,
      epic,
      legendary,
    };
  }, [userCards]);

  const progressPercent = useMemo(() => allCards.length > 0 ? Math.round((userCards.length / allCards.length) * 100) : 0, [allCards.length, userCards.length]);

  const availableMilestones = useMemo(() => {
    const milestones = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    return milestones.filter(m => progressPercent >= m && !claimedMilestones.includes(m));
  }, [progressPercent, claimedMilestones]);

  const handleClaimMilestone = async (milestone: number) => {
    if (!user?.id) return;
    try {
      const res = await claimMilestone.mutateAsync(`milestone_${milestone}`);
      const newClaimed = [...claimedMilestones, milestone];
      setClaimedMilestones(newClaimed);
      localStorage.setItem(`flipz_collection_milestones_${user.id}`, JSON.stringify(newClaimed));
      
      if (res?.cards) {
        setRevealedCards(res.cards);
        setIsRevealing(true);
      }
      toast.success(`Récompense du palier ${milestone}% récupérée !`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la récupération');
    }
  };

  const isLoading = authLoading || cardsLoading || userCardsLoading;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Header */}
        <header className="pt-10 md:pt-14 pb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center glow-gold">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-gradient-gold">{t('collection.title')}</h1>
          </div>

        {/* Progress — hero % */}
        <div className="mt-4 mb-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-end justify-between mb-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70 font-semibold">
                Progression{activeBooster ? ` · ${boosters.find(b => b.id === activeBooster)?.name ?? ''}` : ''}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('collection.uniqueCards', { collected: userCards.length, total: allCards.length, totalCount: totalCardsCollected })}
              </p>
            </div>
            <div className="text-right leading-none">
              <span
                className="font-display font-black text-5xl bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(135deg, hsl(45 95% 65%), hsl(35 90% 50%))',
                  filter: 'drop-shadow(0 0 12px hsl(45 90% 55% / 0.35))',
                }}
              >
                {progressPercent}
              </span>
              <span className="font-display font-bold text-2xl text-primary/80 ml-0.5">%</span>
            </div>
          </div>
          <div className="h-2.5 rounded-full bg-muted/40 overflow-hidden border border-primary/10">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out relative"
              style={{
                width: `${progressPercent}%`,
                background: 'linear-gradient(90deg, hsl(45 90% 55%), hsl(35 90% 50%))',
                boxShadow: '0 0 16px hsl(45 90% 55% / 0.55)',
              }}
            >
              <div className="absolute inset-0 shimmer opacity-40" />
            </div>
          </div>
        </div>



        {visibleBoosters.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {[{ id: null as string | null, name: 'FLIPZ', image_url: null as string | null }, ...visibleBoosters].map(b => (
              <button
                key={b.id ?? 'main'}
                onClick={() => { setActiveBooster(b.id); setActiveRarity('all'); setActiveCustom('all'); }}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-display font-semibold border transition-all ${activeBooster === b.id ? 'border-primary bg-primary/20 text-primary' : 'border-border/50 bg-card/30 text-muted-foreground'}`}
              >
                {b.image_url && <img src={b.image_url} alt="" className="w-5 h-5 rounded object-cover" />}
                {b.name}
              </button>
            ))}
          </div>
        )}

        {/* Rarity filter — booster tabs use the booster's own special rarities */}
        {activeBooster ? (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {['all', ...customOrder].map(r => {
              const isActive = activeCustom === r;
              const color = r === 'all' ? 'hsl(45, 90%, 55%)' : (activeBoosterObj?.rarity_colors?.[r] || 'hsl(var(--rarity-special))');
              const total = r === 'all' ? allCards.length : allCards.filter(c => c.custom_rarity === r).length;
              const got = r === 'all' ? userCards.length : userCards.filter((c: any) => c.custom_rarity === r || allCards.find(a => a.id === c.id)?.custom_rarity === r).length;
              return (
                <button key={r} onClick={() => setActiveCustom(r)}
                  className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-display font-semibold border transition-all ${isActive ? 'shadow-lg' : 'border-border/50 bg-card/30 text-muted-foreground'}`}
                  style={isActive ? { borderColor: color, color, WebkitTextFillColor: color } : undefined}>
                  <span>{r === 'all' ? 'Toutes' : r}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/50">{got}/{total}</span>
                </button>
              );
            })}
          </div>
        ) : <RarityTabs 
          activeRarity={activeRarity} 
          onRarityChange={setActiveRarity}
          counts={counts}
          collectedCounts={collectedCounts}
        />}
      </header>

      {/* Collection book */}
      <main className="px-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : allCards.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t('collection.noCards')}</p>
          </div>
        ) : (
          <CollectionBook 
            key={activeBooster ? `${activeBooster}-${activeCustom}` : 'main'}
            allCards={bookCards}
            collectedCardIds={collectedCardIds}
            cardCountMap={cardCountMap}
            obtainedAtMap={obtainedAtMap}
            activeRarity={activeBooster ? 'all' : activeRarity}
            newCardIds={newCardIds}
            onCardClick={handleCardClick}
          />
        )}
      </main>

      {/* Card detail dialog — lazy loaded */}
      {detailOpen && (
        <Suspense fallback={null}>
          <CardDetailDialog
            card={selectedCard}
            count={selectedCardCount}
            open={detailOpen}
            onOpenChange={setDetailOpen}
            onPrev={() => handleNavigate(-1)}
            onNext={() => handleNavigate(1)}
            hasPrev={selectedIndex !== null && selectedIndex > 0}
            hasNext={selectedIndex !== null && selectedIndex < navigableCards.length - 1}
          />
        </Suspense>
      )}

      <PackRevealFlow
        cards={revealedCards}
        isOpen={isRevealing}
        onClose={() => setIsRevealing(false)}
        packType="standard"
      />
      </div>

      <Navigation />
    </div>
  );
};

export default Collection;
