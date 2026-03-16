import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Navigation } from '@/components/Navigation';
import { CollectionBook } from '@/components/CollectionBook';
import { RarityTabs } from '@/components/RarityTabs';
import { GameCard, Rarity } from '@/types/card';
import { BookOpen, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAllCards, useUserCards } from '@/hooks/useCards';
import { useNewCardIndicator } from '@/hooks/useNewCardIndicator';

const CardDetailDialog = lazy(() => import('@/components/CardDetailDialog').then(m => ({ default: m.CardDetailDialog })));

const Collection = () => {
  const [activeRarity, setActiveRarity] = useState<Rarity | 'all'>('all');
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const { data: allCards = [], isLoading: cardsLoading } = useAllCards();
  const { data: userCards = [], isLoading: userCardsLoading } = useUserCards(user?.id);
  const { newCardIds, markAsSeen } = useNewCardIndicator();

  // Mark cards as seen when visiting collection
  useEffect(() => {
    if (user && !userCardsLoading) {
      markAsSeen();
    }
  }, [user, userCardsLoading, markAsSeen]);
  
  // Card detail dialog state
  const [selectedCard, setSelectedCard] = useState<GameCard | null>(null);
  const [selectedCardCount, setSelectedCardCount] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const collectedCardIds = useMemo(() => new Set(userCards.map(card => card.id)), [userCards]);
  
  const cardCountMap = useMemo(() => new Map(userCards.map(card => [card.id, card.count])), [userCards]);
  
  const obtainedAtMap = useMemo(() => new Map(userCards.map(card => [card.id, card.obtained_at])), [userCards]);
  
  const totalCardsCollected = useMemo(() => userCards.reduce((sum, card) => sum + card.count, 0), [userCards]);
  
  const handleCardClick = useCallback((card: GameCard, count: number) => {
    setSelectedCard(card);
    setSelectedCardCount(count);
    setDetailOpen(true);
  }, []);

  const counts = useMemo(() => ({
    all: allCards.length,
    common: allCards.filter(c => c.rarity === 'common').length,
    rare: allCards.filter(c => c.rarity === 'rare').length,
    epic: allCards.filter(c => c.rarity === 'epic').length,
    legendary: allCards.filter(c => c.rarity === 'legendary').length,
  }), [allCards]);

  const collectedCounts = useMemo(() => ({
    all: userCards.length,
    common: userCards.filter(c => c.rarity === 'common').length,
    rare: userCards.filter(c => c.rarity === 'rare').length,
    epic: userCards.filter(c => c.rarity === 'epic').length,
    legendary: userCards.filter(c => c.rarity === 'legendary').length,
  }), [userCards]);

  const progressPercent = useMemo(() => allCards.length > 0 ? Math.round((userCards.length / allCards.length) * 100) : 0, [allCards.length, userCards.length]);

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
      {/* Header */}
      <header className="pt-12 pb-4 px-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center glow-gold">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold text-gradient-gold">{t('collection.title')}</h1>
        </div>

        {/* Progress bar */}
        <div className="mt-3 mb-5">
          <div className="flex justify-between items-center mb-1.5">
            <p className="text-xs text-muted-foreground font-medium">
              {t('collection.uniqueCards', { collected: userCards.length, total: allCards.length, totalCount: totalCardsCollected })}
            </p>
            <span className="text-xs font-display text-primary">{progressPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progressPercent}%`,
                background: 'linear-gradient(90deg, hsl(45 90% 55%), hsl(35 90% 50%))',
                boxShadow: '0 0 12px hsl(45 90% 55% / 0.5)',
              }}
            />
          </div>
        </div>

        {/* Rarity filter */}
        <RarityTabs 
          activeRarity={activeRarity} 
          onRarityChange={setActiveRarity}
          counts={counts}
          collectedCounts={collectedCounts}
        />
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
            allCards={allCards}
            collectedCardIds={collectedCardIds}
            cardCountMap={cardCountMap}
            obtainedAtMap={obtainedAtMap}
            activeRarity={activeRarity}
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
          />
        </Suspense>
      )}

      <Navigation />
    </div>
  );
};

export default Collection;
