import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Ticket, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { GameCard } from '@/types/card';
import { PackRevealFlow } from '@/components/shop/PackRevealFlow';
import { UserCardWithCount } from '@/hooks/useCards';

interface RedeemCodeSectionProps {
  userCards: UserCardWithCount[];
}

export const RedeemCodeSection = ({ userCards }: RedeemCodeSectionProps) => {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const queryClient = useQueryClient();

  // Pack reveal state
  const [revealedCards, setRevealedCards] = useState<GameCard[]>([]);
  const [isRevealing, setIsRevealing] = useState(false);
  const [ownedSnapshotForReveal, setOwnedSnapshotForReveal] = useState<Set<string>>(new Set());
  const redeemingRef = useRef(false);

  const handleRedeem = async () => {
    if (!code.trim() || !user || redeemingRef.current) return;
    redeemingRef.current = true;

    setIsRedeeming(true);
    try {
      const ownedIdsBeforeRedeem = new Set(
        userCards
          .filter(card => card.count > 0)
          .map(card => card.id)
      );

      const { data, error } = await invokeEdgeFunction('redeem-code', {
        body: { code: code.trim() }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      const reward = data.reward;

      if (reward?.type === 'pack' || reward?.type === 'pack_lucky' || reward?.type === 'pack_ultra') {
        // Cards are now generated server-side and returned directly
        const cards = (reward.cards || []) as GameCard[];
        setOwnedSnapshotForReveal(ownedIdsBeforeRedeem);
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
      redeemingRef.current = false;
    }
  };

  const handleCloseReveal = () => {
    setIsRevealing(false);
    setRevealedCards([]);
    setOwnedSnapshotForReveal(new Set());
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
