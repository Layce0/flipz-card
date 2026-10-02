import { useState, useMemo, memo, useCallback, useRef } from 'react';
import { GameCard, Rarity, RARITY_CONFIG } from '@/types/card';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, HelpCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocalizedCard } from '@/hooks/useLocalizedCard';

interface CollectionBookProps {
  allCards: GameCard[];
  collectedCardIds: Set<string>;
  cardCountMap: Map<string, number>;
  obtainedAtMap?: Map<string, string>;
  activeRarity: Rarity | 'all';
  newCardIds?: Set<string>;
  onCardClick?: (card: GameCard, count: number) => void;
}

export const CollectionBook = memo(({ allCards, collectedCardIds, cardCountMap, obtainedAtMap, activeRarity, newCardIds, onCardClick }: CollectionBookProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [flipDirection, setFlipDirection] = useState<'next' | 'prev' | null>(null);
  const cardsPerPage = 4;

  const filteredCards = useMemo(() => {
    const filtered = activeRarity === 'all' 
      ? allCards 
      : allCards.filter(card => card.rarity === activeRarity);
    
    if (activeRarity === 'all') {
      const collected = filtered.filter(c => collectedCardIds.has(c.id));
      const uncollected = filtered.filter(c => !collectedCardIds.has(c.id));
      
      // String comparison is faster than Date parsing
      collected.sort((a, b) => {
        const dateA = obtainedAtMap?.get(a.id) || '';
        const dateB = obtainedAtMap?.get(b.id) || '';
        return dateB.localeCompare(dateA);
      });
      
      return [...collected, ...uncollected];
    }
    
    return filtered;
  }, [allCards, activeRarity, collectedCardIds, obtainedAtMap]);

  const totalPages = Math.ceil(filteredCards.length / cardsPerPage);
  
  const currentCards = useMemo(() => 
    filteredCards.slice(currentPage * cardsPerPage, (currentPage + 1) * cardsPerPage),
    [filteredCards, currentPage, cardsPerPage]
  );

  // Reset page when filter changes
  const prevRarityRef = useMemo(() => ({ current: activeRarity }), []);
  if (prevRarityRef.current !== activeRarity) {
    prevRarityRef.current = activeRarity;
    setCurrentPage(0);
    setFlipDirection(null);
  }

  const goToPage = useCallback((target: number) => {
    setCurrentPage(prev => {
      const clamped = Math.max(0, Math.min(target, totalPages - 1));
      if (clamped === prev) return prev;
      setFlipDirection(clamped > prev ? 'next' : 'prev');
      return clamped;
    });
  }, [totalPages]);

  const nextPage = useCallback(() => goToPage(currentPage + 1), [goToPage, currentPage]);
  const prevPage = useCallback(() => goToPage(currentPage - 1), [goToPage, currentPage]);


  const handleCardClick = useCallback((card: GameCard, count: number) => {
    onCardClick?.(card, count);
  }, [onCardClick]);

  // Pagination dots
  const pageButtons = useMemo(() => {
    const start = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
    return Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i).filter(p => p < totalPages);
  }, [currentPage, totalPages]);

  return (
    <div className="relative">
      <div className="relative bg-gradient-to-br from-amber-900/30 via-card to-amber-900/20 rounded-2xl border-2 border-amber-700/30 p-4 min-h-[500px] shadow-2xl">
        <div className="absolute left-1/2 top-0 bottom-0 w-1 -translate-x-1/2 bg-gradient-to-b from-amber-700/50 via-amber-600/30 to-amber-700/50" />
        <div className="absolute inset-2 bg-gradient-to-r from-amber-50/5 via-transparent to-amber-50/5 rounded-xl pointer-events-none" />
        
        <div
          key={currentPage}
          className={cn(
            "grid grid-cols-2 gap-4 relative z-10 [transform-style:preserve-3d]",
            flipDirection === 'next' && "animate-page-flip-next",
            flipDirection === 'prev' && "animate-page-flip-prev"
          )}
        >
          {currentCards.map((card) => {
            const isCollected = collectedCardIds.has(card.id);
            const count = cardCountMap.get(card.id) || 0;
            return (
              <CardSlot 
                key={card.id} 
                card={card} 
                isCollected={isCollected}
                count={count}
                isNew={newCardIds?.has(card.id) ?? false}
                onClick={isCollected ? () => handleCardClick(card, count) : undefined}
              />
            );
          })}
          
          {Array.from({ length: Math.max(0, cardsPerPage - currentCards.length) }).map((_, i) => (
            <EmptySlot key={`empty-${i}`} />
          ))}
        </div>

      </div>

      <div className="flex justify-between items-center mt-4 px-4">
        <Button variant="outline" size="icon" onClick={prevPage} disabled={currentPage === 0} className="bg-card/50">

          <ChevronLeft className="w-5 h-5" />
        </Button>
        
        <div className="flex gap-2">
          {pageButtons.map((pageIndex) => (
            <button
              key={pageIndex}
              onClick={() => goToPage(pageIndex)}
              className={cn(
                "w-8 h-8 rounded-lg text-sm font-medium transition-all",
                currentPage === pageIndex 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-card/50 text-muted-foreground hover:bg-card"
              )}
            >
              {pageIndex + 1}
            </button>
          ))}
        </div>

        <Button variant="outline" size="icon" onClick={nextPage} disabled={currentPage >= totalPages - 1} className="bg-card/50">
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
});

CollectionBook.displayName = 'CollectionBook';

// Card slot component — memoized
const CardSlot = memo(({ card, isCollected, count, isNew, onClick }: { card: GameCard; isCollected: boolean; count: number; isNew?: boolean; onClick?: () => void }) => {
  const { getTitle } = useLocalizedCard();
  const rarityConfig = RARITY_CONFIG[card.rarity];

  if (!isCollected) {
    return (
      <div className="relative aspect-[3/4] rounded-xl bg-card/50 border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-2">
            <HelpCircle className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <p className="text-xs text-muted-foreground/50">Carte mystère</p>
          <Lock className="w-4 h-4 text-muted-foreground/30 mx-auto mt-1" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative group cursor-pointer" onClick={onClick}>
      <div 
        className={cn(
          "absolute -inset-1 rounded-xl opacity-50 group-hover:opacity-100 transition-opacity blur-sm",
          card.rarity === 'legendary' && "animate-glow-pulse"
        )}
        style={{ background: rarityConfig.color }}
      />
      
      <div 
        className="relative rounded-xl overflow-hidden bg-card border-2 card-shadow aspect-[3/4]"
        style={{ borderColor: rarityConfig.color }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <img 
            src={card.image_url} 
            alt={getTitle(card)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <span 
            className={cn(
              "inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider mb-1",
              card.custom_rarity ? 'rarity-special' : rarityConfig.bgClass
            )}
            style={{ color: card.rarity === 'legendary' ? 'hsl(240, 20%, 6%)' : 'white' }}
          >
            {card.custom_rarity || rarityConfig.label}
          </span>
          <h4 className="font-display text-sm text-foreground truncate">{getTitle(card)}</h4>
        </div>
        
        <div className="absolute top-2 right-2 bg-primary text-primary-foreground px-2 py-1 rounded-full text-xs font-bold shadow-lg">
          ×{count}
        </div>

        {card.rarity === 'legendary' && (
          <div className="shimmer absolute inset-0 pointer-events-none" />
        )}

        {isNew && (
          <div className="absolute top-2 left-2 z-10">
            <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider shadow-lg">
              Nouveau
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

CardSlot.displayName = 'CardSlot';

// Empty slot component — memoized
const EmptySlot = memo(() => (
  <div className="aspect-[3/4] rounded-xl bg-card/20 border-2 border-dashed border-muted-foreground/10" />
));

EmptySlot.displayName = 'EmptySlot';
