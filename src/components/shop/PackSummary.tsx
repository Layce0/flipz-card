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
  const { getTitle } = useLocalizedCard();
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
            const rarityColor = `hsl(var(--rarity-${card.rarity}))`;
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
                    boxShadow: `0 0 12px hsl(var(--rarity-${card.rarity}) / 0.4)`,
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
                  {rarity?.label}
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

      <CardDetailDialog
        card={selectedCard}
        count={selectedCard ? counts[selectedCard.id] || 1 : 1}
        open={!!selectedCard}
        onOpenChange={(open) => !open && setSelectedCard(null)}
      />
    </div>
  );
};
