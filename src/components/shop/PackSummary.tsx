import { useState } from 'react';
import { X } from 'lucide-react';
import { GameCard, RARITY_CONFIG, Rarity } from '@/types/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { useLocalizedCard } from '@/hooks/useLocalizedCard';
import { cn } from '@/lib/utils';

interface PackSummaryProps {
  cards: GameCard[];
  ownedSnapshot: Set<string>;
  onClose: () => void;
}

export const PackSummary = ({ cards, ownedSnapshot, onClose }: PackSummaryProps) => {
  const { t } = useTranslation();
  const { getTitle, getDescription } = useLocalizedCard();
  const [selectedCard, setSelectedCard] = useState<GameCard | null>(null);

  const seen = new Set<string>();
  const enriched = cards.map((c) => {
    const isNew = !ownedSnapshot.has(c.id) && !seen.has(c.id);
    seen.add(c.id);
    return { card: c, isNew };
  });
  const newCount = enriched.filter((e) => e.isNew).length;

  const counts = cards.reduce<Record<string, number>>((acc, c) => {
    acc[c.id] = (acc[c.id] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-[70] bg-background flex flex-col items-center p-4 overflow-y-auto">
      <div className="w-full max-w-md flex flex-col items-center pt-6 pb-24">
        <h2 className="font-display text-2xl font-bold text-gradient-gold mb-1">
          {t('packs.summaryTitle', 'Résumé du pack')}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {t('packs.summarySubtitle', '{{newCount}} nouvelle(s) · {{total}} carte(s)', {
            newCount,
            total: cards.length,
          })}
        </p>

        <div className="grid grid-cols-3 gap-3 w-full">
          {enriched.map(({ card, isNew }, idx) => {
            const rarity = RARITY_CONFIG[card.rarity];
            const rarityColor = card.custom_rarity ? 'hsl(var(--rarity-special))' : `hsl(var(--rarity-${card.rarity}))`;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedCard(card)}
                className="flex flex-col items-center focus:outline-none transition-transform active:scale-95 hover:scale-105"
              >
                <div
                  className="relative w-full aspect-[3/4] rounded-lg overflow-hidden border-2"
                  style={{
                    borderColor: rarityColor,
                    boxShadow: `0 0 12px ${rarityColor}`,
                  }}
                >
                  {card.image_url ? (
                    <img src={card.image_url} alt={getTitle(card)} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-card flex items-center justify-center text-2xl">?</div>
                  )}
                  {isNew && (
                    <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded">
                      {t('common.new', 'NOUVEAU')}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-center mt-1 truncate w-full" style={{ color: rarityColor }}>
                  {card.custom_rarity || rarity?.label}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent">
        <div className="max-w-md mx-auto">
          <Button variant="gold" size="xl" className="w-full" onClick={onClose}>
            {t('common.finish', 'Terminer')}
          </Button>
        </div>
      </div>

      {selectedCard && (() => {
        const config = RARITY_CONFIG[selectedCard.rarity as Rarity];
        const count = counts[selectedCard.id] || 1;
        return (
          <div
            className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setSelectedCard(null)}
          >
            <div
              className="relative w-full max-w-sm rounded-2xl overflow-hidden bg-card border-2 shadow-2xl animate-scale-in"
              style={{ borderColor: config.color }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedCard(null)}
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="relative aspect-[3/4] w-full">
                <img
                  src={selectedCard.image_url}
                  alt={getTitle(selectedCard)}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />

                <div className="absolute top-3 left-3 bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-sm font-bold shadow-lg">
                  ×{count}
                </div>

                <div
                  className={cn(
                    "absolute top-3 right-12 px-3 py-1 rounded-full text-xs font-semibold uppercase",
                    selectedCard.custom_rarity ? 'rarity-special' : config.bgClass
                  )}
                  style={{ color: selectedCard.rarity === 'legendary' ? 'hsl(240, 20%, 6%)' : 'white' }}
                >
                  {selectedCard.custom_rarity || t(`rarity.${selectedCard.rarity}`)}
                </div>

                {selectedCard.rarity === 'legendary' && (
                  <div className="shimmer absolute inset-0 pointer-events-none" />
                )}
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <h2 className="font-display text-xl text-foreground">{getTitle(selectedCard)}</h2>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    {getDescription(selectedCard)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
