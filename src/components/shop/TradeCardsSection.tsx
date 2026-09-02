import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowRightLeft, Loader2, Package } from 'lucide-react';
import { Rarity, RARITY_CONFIG } from '@/types/card';
import { TRADE_CONFIG } from '@/types/pack';
import { UserCardWithCount } from '@/hooks/useCards';
import { useLocalizedCard } from '@/hooks/useLocalizedCard';
import { cn } from '@/lib/utils';
import { PackRevealFlow } from '@/components/shop/PackRevealFlow';

interface TradeCardsSectionProps {
  userCards: UserCardWithCount[];
  onTrade: (card: UserCardWithCount) => Promise<any[]>;
  isTrading: boolean;
}

export const TradeCardsSection = ({ userCards, onTrade, isTrading }: TradeCardsSectionProps) => {
  const { t } = useTranslation();
  const { getTitle } = useLocalizedCard();
  const [selectedCard, setSelectedCard] = useState<UserCardWithCount | null>(null);
  const [rewardCards, setRewardCards] = useState<any[]>([]);
  const [showReward, setShowReward] = useState(false);
  const [localTrading, setLocalTrading] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  const getEligibleCardsByRarity = (rarity: Rarity) => {
    const config = TRADE_CONFIG[rarity];
    return userCards.filter(
      (card) => card.rarity === rarity && card.count >= config.required
    );
  };

  // Build the full list of trades (a card can be traded several times)
  const bulkPlan = userCards.flatMap((card) => {
    const config = TRADE_CONFIG[card.rarity as Rarity];
    if (!config) return [];
    const consumed = config.required - config.keep;
    let remaining = card.count;
    const plan: UserCardWithCount[] = [];
    while (remaining >= config.required && consumed > 0) {
      plan.push(card);
      remaining -= consumed;
    }
    return plan;
  });

  const bulkReward = bulkPlan.reduce(
    (sum, card) => sum + (TRADE_CONFIG[card.rarity as Rarity]?.reward ?? 0),
    0
  );

  const handleTradeAll = async () => {
    setConfirmAll(false);
    setLocalTrading(true);
    const collected: any[] = [];
    try {
      for (let i = 0; i < bulkPlan.length; i++) {
        setBulkProgress({ current: i + 1, total: bulkPlan.length });
        const cards = await onTrade(bulkPlan[i]);
        if (cards?.length) collected.push(...cards);
      }
    } finally {
      setBulkProgress(null);
      setLocalTrading(false);
    }
    if (collected.length > 0) {
      setRewardCards(collected);
      setShowReward(true);
    }
  };

  const handleConfirmTrade = async () => {
    if (!selectedCard) return;
    
    setLocalTrading(true);
    try {
      const cards = await onTrade(selectedCard);
      setRewardCards(cards);
      setShowReward(true);
      setSelectedCard(null);
    } finally {
      setLocalTrading(false);
    }
  };

  const handleCloseReveal = () => {
    setShowReward(false);
    setRewardCards([]);
  };

  const rarities: Rarity[] = ['legendary', 'epic', 'rare', 'common'];

  return (
    <>
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg text-foreground">{t('trade.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('trade.subtitle')}</p>
          </div>
        </div>

        {bulkPlan.length > 0 && (
          <Button
            variant="gold"
            className="w-full gap-2"
            disabled={isTrading || localTrading}
            onClick={() => setConfirmAll(true)}
          >
            {bulkProgress ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('trade.tradeAllProgress', bulkProgress)}
              </>
            ) : (
              <>
                <Package className="w-4 h-4" />
                {t('trade.tradeAll')} (+{bulkReward})
              </>
            )}
          </Button>
        )}


        {rarities.map((rarity) => {
          const config = TRADE_CONFIG[rarity];
          const rarityConfig = RARITY_CONFIG[rarity];
          const eligibleCards = getEligibleCardsByRarity(rarity);
          const rarityLabel = t(`rarity.${rarity}`);

          return (
            <Card key={rarity} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-semibold uppercase",
                      rarityConfig.bgClass
                    )}
                    style={{ color: rarity === 'legendary' ? 'hsl(240, 20%, 6%)' : 'white' }}
                  >
                    {rarityLabel}
                  </span>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Package className="w-4 h-4" />
                    <span>{config.required} → {config.reward} {t('common.cards')}</span>
                  </div>
                </div>
                <CardDescription className="mt-2">
                  {t('trade.description', { 
                    required: config.required, 
                    rarity: rarityLabel.toLowerCase(), 
                    reward: config.reward,
                    keep: config.keep 
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {eligibleCards.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t('trade.noEligible', { required: config.required })}
                  </p>
                ) : (
                  <ScrollArea className="w-full">
                    <div className="flex gap-3 pb-2">
                      {eligibleCards.map((card) => (
                        <button
                          key={card.id}
                          onClick={() => setSelectedCard(card)}
                          className="flex-shrink-0 group"
                          disabled={isTrading || localTrading}
                        >
                          <div className="relative w-20 aspect-[2/3] rounded-lg overflow-hidden border-2 border-border group-hover:border-primary transition-colors">
                            <img
                              src={card.image_url}
                              alt={getTitle(card)}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                              <span className="text-[10px] text-white font-medium truncate block">
                                {getTitle(card)}
                              </span>
                              <span className="text-[10px] text-primary font-bold">
                                ×{card.count}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* Bulk trade confirmation */}
      <Dialog open={confirmAll} onOpenChange={setConfirmAll}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('trade.tradeAllConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('trade.tradeAllConfirmDescription', { cards: bulkPlan.length, reward: bulkReward })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmAll(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="gold" onClick={handleTradeAll} disabled={localTrading}>
              {t('trade.tradeAll')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* Confirmation Dialog */}
      <Dialog open={!!selectedCard} onOpenChange={() => setSelectedCard(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('trade.confirmTitle')}</DialogTitle>
            <DialogDescription>
              {selectedCard && t('trade.confirmDescription', {
                required: TRADE_CONFIG[selectedCard.rarity as Rarity].required,
                title: getTitle(selectedCard),
                reward: TRADE_CONFIG[selectedCard.rarity as Rarity].reward
              })}
            </DialogDescription>
          </DialogHeader>

          {selectedCard && (
            <div className="flex justify-center py-4">
              <div className="relative w-24 aspect-[2/3] rounded-xl overflow-hidden border-2 border-border">
                <img
                  src={selectedCard.image_url}
                  alt={getTitle(selectedCard)}
                  className="w-full h-full object-cover"
                />
                 <div className="absolute top-1 right-1 bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 rounded-full font-bold">
                   -{TRADE_CONFIG[selectedCard.rarity as Rarity].required - TRADE_CONFIG[selectedCard.rarity as Rarity].keep}
                </div>
              </div>
              <div className="flex items-center px-4">
                <ArrowRightLeft className="w-6 h-6 text-primary" />
              </div>
              <div className="flex items-center justify-center w-24 aspect-[2/3] rounded-xl border-2 border-dashed border-primary/50 bg-primary/5">
                <div className="text-center">
                  <Package className="w-6 h-6 text-primary mx-auto mb-1" />
                  <span className="text-xs text-primary font-bold">
                    +{TRADE_CONFIG[selectedCard.rarity as Rarity].reward}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedCard(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="gold"
              onClick={handleConfirmTrade}
              disabled={localTrading}
            >
              {localTrading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t('trade.exchange')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reward Reveal with Pack Animation */}
      <PackRevealFlow
        cards={rewardCards}
        isOpen={showReward}
        onClose={handleCloseReveal}
        packType="standard"
      />
    </>
  );
};
