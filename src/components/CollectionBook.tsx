import { useState } from 'react';
import { GameCard, Rarity, RARITY_CONFIG } from '@/types/card';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, HelpCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CollectionBookProps {
  allCards: GameCard[];
  collectedCardIds: Set<string>;
  activeRarity: Rarity | 'all';
}

export const CollectionBook = ({ allCards, collectedCardIds, activeRarity }: CollectionBookProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  const cardsPerPage = 4;

  // Filter cards by rarity
  const filteredCards = activeRarity === 'all' 
    ? allCards 
    : allCards.filter(card => card.rarity === activeRarity);

  const totalPages = Math.ceil(filteredCards.length / cardsPerPage);
  const currentCards = filteredCards.slice(
    currentPage * cardsPerPage,
    (currentPage + 1) * cardsPerPage
  );

  const nextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  };

  // Reset page when filter changes
  const handleRarityChange = () => {
    setCurrentPage(0);
  };

  return (
    <div className="relative">
      {/* Book container */}
      <div className="relative bg-gradient-to-br from-amber-900/30 via-card to-amber-900/20 rounded-2xl border-2 border-amber-700/30 p-4 min-h-[500px] shadow-2xl">
        {/* Book spine decoration */}
        <div className="absolute left-1/2 top-0 bottom-0 w-1 -translate-x-1/2 bg-gradient-to-b from-amber-700/50 via-amber-600/30 to-amber-700/50" />
        
        {/* Page texture */}
        <div className="absolute inset-2 bg-gradient-to-r from-amber-50/5 via-transparent to-amber-50/5 rounded-xl pointer-events-none" />
        
        {/* Cards grid */}
        <div className="grid grid-cols-2 gap-4 relative z-10">
          {currentCards.map((card) => {
            const isCollected = collectedCardIds.has(card.id);
            return (
              <CardSlot 
                key={card.id} 
                card={card} 
                isCollected={isCollected} 
              />
            );
          })}
          
          {/* Empty slots */}
          {Array.from({ length: Math.max(0, cardsPerPage - currentCards.length) }).map((_, i) => (
            <EmptySlot key={`empty-${i}`} />
          ))}
        </div>

        {/* Page number */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-muted-foreground text-sm font-display">
          Page {currentPage + 1} / {Math.max(1, totalPages)}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center mt-4 px-4">
        <Button
          variant="outline"
          size="icon"
          onClick={prevPage}
          disabled={currentPage === 0}
          className="bg-card/50"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        
        <div className="flex gap-2">
          {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
            const pageIndex = Math.max(0, Math.min(currentPage - 2, totalPages - 5)) + i;
            if (pageIndex >= totalPages) return null;
            return (
              <button
                key={pageIndex}
                onClick={() => setCurrentPage(pageIndex)}
                className={cn(
                  "w-8 h-8 rounded-lg text-sm font-medium transition-all",
                  currentPage === pageIndex 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-card/50 text-muted-foreground hover:bg-card"
                )}
              >
                {pageIndex + 1}
              </button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={nextPage}
          disabled={currentPage >= totalPages - 1}
          className="bg-card/50"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};

// Card slot component
const CardSlot = ({ card, isCollected }: { card: GameCard; isCollected: boolean }) => {
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
    <div className="relative group">
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
        {/* Image */}
        <div className="absolute inset-0 overflow-hidden">
          <img 
            src={card.image_url} 
            alt={card.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
        </div>

        {/* Info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <span 
            className={cn(
              "inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider mb-1",
              rarityConfig.bgClass
            )}
            style={{ color: card.rarity === 'legendary' ? 'hsl(240, 20%, 6%)' : 'white' }}
          >
            {rarityConfig.label}
          </span>
          <h4 className="font-display text-sm text-foreground truncate">{card.title}</h4>
        </div>

        {card.rarity === 'legendary' && (
          <div className="shimmer absolute inset-0 pointer-events-none" />
        )}
      </div>
    </div>
  );
};

// Empty slot component
const EmptySlot = () => (
  <div className="aspect-[3/4] rounded-xl bg-card/20 border-2 border-dashed border-muted-foreground/10" />
);
