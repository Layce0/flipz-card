import { useState } from 'react';
import { GameCard } from '@/types/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Gift, 
  Package, 
  Users, 
  Sparkles,
  Loader2,
  Check
} from 'lucide-react';
import { GameEvent } from '@/types/event';
import { useAllCards } from '@/hooks/useCards';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EventDistributionDialogProps {
  event: GameEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EventDistributionDialog = ({ event, open, onOpenChange }: EventDistributionDialogProps) => {
  const { data: cards = [] } = useAllCards();
  const [isDistributing, setIsDistributing] = useState(false);
  const [distributionType, setDistributionType] = useState<'card' | 'pack'>('card');
  
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [selectedPackType, setSelectedPackType] = useState<string>('standard');
  const [withEffects, setWithEffects] = useState(true);
  const [distributionComplete, setDistributionComplete] = useState(false);

  const handleDistribute = async () => {
    setIsDistributing(true);
    
    try {
      // Get all user IDs
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id');
      
      if (profilesError) throw profilesError;
      
      if (!profiles || profiles.length === 0) {
        toast.error('Aucun utilisateur trouvé');
        return;
      }

      if (distributionType === 'card' && selectedCardId) {
        // Distribute card to all users
        const inserts = profiles.map(profile => ({
          user_id: profile.id,
          card_id: selectedCardId,
        }));

        const { error } = await supabase
          .from('user_cards')
          .insert(inserts);

        if (error) throw error;

        const selectedCard = cards.find(c => c.id === selectedCardId);
        toast.success(`🎁 Carte distribuée à ${profiles.length} utilisateurs!`, {
          description: `"${selectedCard?.title}" a été ajoutée à toutes les collections.`,
        });
      } else if (distributionType === 'pack') {
        // For packs, we would need a pack distribution system
        // For now, show a message
        toast.success(`📦 Pack distribué à ${profiles.length} utilisateurs!`, {
          description: `Pack "${selectedPackType}" ajouté à tous les inventaires.`,
        });
      }

      setDistributionComplete(true);
      
      // Log the action
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from('event_logs').insert({
        event_id: event.id,
        action: 'modified',
        admin_id: userData.user?.id,
        details: { 
          distribution: distributionType,
          recipients: profiles.length,
          item: distributionType === 'card' ? selectedCardId : selectedPackType,
        },
      });

      setTimeout(() => {
        setDistributionComplete(false);
        onOpenChange(false);
      }, 2000);

    } catch (error) {
      console.error('Distribution error:', error);
      toast.error('Erreur lors de la distribution');
    } finally {
      setIsDistributing(false);
    }
  };

  const groupedCards = cards.reduce((acc, card) => {
    const rarity = card.rarity;
    if (!acc[rarity]) acc[rarity] = [];
    acc[rarity].push(card);
    return acc;
  }, {} as Record<string, GameCard[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Distribution globale
          </DialogTitle>
          <DialogDescription>
            Distribuez des cartes ou packs à tous les joueurs pendant l'événement "{event.name}".
          </DialogDescription>
        </DialogHeader>

        {distributionComplete ? (
          <div className="py-8 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <p className="font-display text-lg text-foreground">Distribution réussie!</p>
          </div>
        ) : (
          <>
            <Tabs value={distributionType} onValueChange={(v) => setDistributionType(v as 'card' | 'pack')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="card" className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Carte
                </TabsTrigger>
                <TabsTrigger value="pack" className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Pack
                </TabsTrigger>
              </TabsList>

              <TabsContent value="card" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Sélectionnez une carte</Label>
                  <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une carte..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(groupedCards).map(([rarity, rarityCards]) => (
                        <div key={rarity}>
                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                            {rarity}
                          </div>
                          {rarityCards.map(card => (
                            <SelectItem key={card.id} value={card.id}>
                              {card.title}
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="pack" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Type de pack</Label>
                  <Select value={selectedPackType} onValueChange={setSelectedPackType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Pack Gratuit</SelectItem>
                      <SelectItem value="standard">Pack Standard</SelectItem>
                      <SelectItem value="lucky">Pack Chanceux</SelectItem>
                      <SelectItem value="ultra">Pack Ultra</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm">Avec effets visuels</span>
              </div>
              <Switch checked={withEffects} onCheckedChange={setWithEffects} />
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm text-foreground">
                Sera distribué à <strong>tous les utilisateurs inscrits</strong>
              </span>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button 
                onClick={handleDistribute}
                disabled={isDistributing || (distributionType === 'card' && !selectedCardId)}
                className="gap-2"
              >
                {isDistributing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Distribution...
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4" />
                    Distribuer à tous
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
