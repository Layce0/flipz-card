import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Ticket, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useRandomCards, useCollectCard } from '@/hooks/useCards';
import { GameCard } from '@/types/card';
import { PackRevealFlow } from '@/components/shop/PackRevealFlow';

export const RedeemCodeSection = () => {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const queryClient = useQueryClient();

  // Pack reveal state
  const [revealedCards, setRevealedCards] = useState<GameCard[]>([]);
  const [isRevealing, setIsRevealing] = useState(false);
  const getRandomCards = useRandomCards();
  const collectCard = useCollectCard();

  const handleRedeem = async () => {
    if (!code.trim() || !user) return;

    setIsRedeeming(true);
    try {
      const { data, error } = await supabase.functions.invoke('redeem-code', {
        body: { code: code.trim() }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      const reward = data.reward;

      if (reward?.type === 'pack' || reward?.type === 'pack_lucky' || reward?.type === 'pack_ultra') {
        // Open pack through normal RNG flow
        const packType = reward.type;
        const cardCount = reward.card_count || 5;
        const rarityMultiplier = packType === 'pack_ultra' ? 5 : packType === 'pack_lucky' ? 2 : 1;

        const cards = await getRandomCards.mutateAsync({
          count: cardCount,
          userId: user.id,
          rarityMultiplier,
        });

        // Collect all cards
        for (const card of cards) {
          try {
            await collectCard.mutateAsync({ userId: user.id, cardId: card.id });
          } catch {}
        }

        setRevealedCards(cards);
        setIsRevealing(true);
        toast.success(data.message || 'Pack reçu !');
      } else {
        toast.success(data.message || 'Code utilisé avec succès !');
      }

      setCode('');
      queryClient.invalidateQueries({ queryKey: ['user-cards'] });
      queryClient.invalidateQueries({ queryKey: ['active-boosts'] });
    } catch (error: any) {
      toast.error('Erreur lors de l\'utilisation du code');
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleCloseReveal = () => {
    setIsRevealing(false);
    setRevealedCards([]);
  };

  return (
    <>
      <section className="mt-8">
        <div className="flex items-center gap-2 mb-3">
          <Ticket className="w-5 h-5 text-primary" />
          <h2 className="font-display text-lg text-foreground">Code promo</h2>
        </div>
        <div className="p-4 rounded-2xl bg-card/60 border border-border">
          <p className="text-sm text-muted-foreground mb-3">
            Entrez un code pour recevoir des récompenses
          </p>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Entrer un code..."
              className="bg-background border-border uppercase font-mono tracking-wider"
              maxLength={30}
              onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
              disabled={isRedeeming}
            />
            <Button
              onClick={handleRedeem}
              disabled={!code.trim() || isRedeeming}
              variant="gold"
              className="shrink-0"
            >
              {isRedeeming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </section>

      <PackRevealFlow
        cards={revealedCards}
        isOpen={isRevealing}
        onClose={handleCloseReveal}
      />
    </>
  );
};
