import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Ticket, Loader2, Check, AlertCircle, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { MysteryCard } from '@/components/MysteryCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useUserCards } from '@/hooks/useCards';
import { useAuth } from '@/contexts/AuthContext';

export const RedeemCodeSection = () => {
  const { user } = useAuth();
  const { data: userCards = [] } = useUserCards(user?.id);
  const [code, setCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [rewardCards, setRewardCards] = useState<any[]>([]);
  const [showReward, setShowReward] = useState(false);
  const [revealedCards, setRevealedCards] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();

  const handleRedeem = async () => {
    if (!code.trim()) return;

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

      if (data.reward?.type === 'pack' && data.reward?.cards) {
        setRewardCards(data.reward.cards);
        setRevealedCards(new Set());
        setShowReward(true);
      }

      toast.success(data.message || 'Code utilisé avec succès !');
      setCode('');
      queryClient.invalidateQueries({ queryKey: ['user-cards'] });
      queryClient.invalidateQueries({ queryKey: ['active-boosts'] });
    } catch (error: any) {
      toast.error('Erreur lors de l\'utilisation du code');
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleRevealCard = (index: number) => {
    setRevealedCards(prev => new Set([...prev, index]));
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

      {/* Pack reward dialog */}
      <Dialog open={showReward} onOpenChange={setShowReward}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-center flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Récompense du code !
            </DialogTitle>
            <DialogDescription className="text-center">
              Cliquez sur les cartes pour les révéler
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3 py-4 max-h-[60vh] overflow-y-auto">
            {rewardCards.map((card, index) => {
              const alreadyOwned = userCards.some(uc => uc.id === card.id);
              const discoveredEarlier = rewardCards.slice(0, index).some(c => c.id === card.id);
              const isNew = !alreadyOwned && !discoveredEarlier;
              return (
                <div key={index} className="flex justify-center">
                  <MysteryCard
                    card={card}
                    isRevealed={revealedCards.has(index)}
                    onReveal={() => handleRevealCard(index)}
                    size="sm"
                    isNew={isNew}
                  />
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button
              variant="gold"
              onClick={() => setShowReward(false)}
              className="w-full"
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
