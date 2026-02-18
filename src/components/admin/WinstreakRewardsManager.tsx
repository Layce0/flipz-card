import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Flame, Plus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useAllCards } from '@/hooks/useCards';
import { useWinstreakRewards, useCreateWinstreakReward, useDeleteWinstreakReward } from '@/hooks/useWinstreak';
import { RARITY_CONFIG, Rarity } from '@/types/card';
import { cn } from '@/lib/utils';

type RewardType = 'pack' | 'pack_lucky' | 'pack_ultra' | 'card' | 'boost_luck' | 'boost_pack';

const LUCK_MULTIPLIERS = [1.5, 2, 2.5, 3, 3.5, 4];
const PACK_BONUSES = [
  { label: '+1 carte', value: 'bonus_1', bonus: 1 },
  { label: '+2 cartes', value: 'bonus_2', bonus: 2 },
  { label: '+3 cartes', value: 'bonus_3', bonus: 3 },
  { label: '+4 cartes', value: 'bonus_4', bonus: 4 },
  { label: '+5 cartes', value: 'bonus_5', bonus: 5 },
  { label: '×2 cartes', value: 'multiply_2', multiplier: 2 },
];

const getRewardLabel = (type: string, config: any) => {
  if (type === 'pack') return `Pack Standard ${config?.card_count || 5} cartes`;
  if (type === 'pack_lucky') return `Pack Chanceux ${config?.card_count || 5} cartes`;
  if (type === 'pack_ultra') return `Pack Ultra ${config?.card_count || 5} cartes`;
  if (type === 'card') return 'Carte spécifique';
  if (type === 'boost_luck') return `Luck ×${config?.multiplier || 2}`;
  if (type === 'boost_pack') {
    if (config?.multiplier) return `×${config.multiplier} cartes/pack`;
    if (config?.bonus) return `+${config.bonus} cartes/pack`;
    return 'Boost pack';
  }
  return type;
};

export const WinstreakRewardsManager = () => {
  const { user } = useAuth();
  const { data: cards = [] } = useAllCards();
  const { data: rewards = [], isLoading } = useWinstreakRewards();
  const createReward = useCreateWinstreakReward();
  const deleteReward = useDeleteWinstreakReward();
  const [showCreate, setShowCreate] = useState(false);

  const [formData, setFormData] = useState({
    day_number: 1,
    reward_type: 'pack' as RewardType,
    card_count: 5,
    card_id: '',
    luck_multiplier: 2,
    pack_bonus: 'bonus_1',
  });

  const handleCreate = async () => {
    let reward_config: Record<string, any> = {};

    if (formData.reward_type === 'pack' || formData.reward_type === 'pack_lucky' || formData.reward_type === 'pack_ultra') {
      reward_config = { card_count: formData.card_count };
    } else if (formData.reward_type === 'card') {
      reward_config = { card_id: formData.card_id };
    } else if (formData.reward_type === 'boost_luck') {
      reward_config = { multiplier: formData.luck_multiplier };
    } else if (formData.reward_type === 'boost_pack') {
      const bonus = PACK_BONUSES.find(b => b.value === formData.pack_bonus);
      reward_config = bonus ? { ...bonus } : {};
    }

    try {
      await createReward.mutateAsync({
        day_number: formData.day_number,
        reward_type: formData.reward_type,
        reward_config,
        created_by: user?.id,
      });
      toast.success(`Récompense jour ${formData.day_number} créée !`);
      setShowCreate(false);
    } catch (error: any) {
      toast.error('Erreur lors de la création');
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-foreground flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-400" />
          Récompenses Winstreak
        </h2>
        <Button size="sm" variant="gold" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          Ajouter
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : rewards.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">Aucune récompense définie</p>
      ) : (
        <div className="space-y-2">
          {rewards.map((r: any) => (
            <div
              key={r.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border"
            >
              <div className="w-10 h-10 rounded-lg bg-orange-400/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-orange-400">J{r.day_number}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Jour {r.day_number}</p>
                <p className="text-xs text-muted-foreground">
                  {getRewardLabel(r.reward_type, r.reward_config)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (confirm(`Supprimer la récompense du jour ${r.day_number} ?`)) {
                    deleteReward.mutate(r.id);
                  }
                }}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajouter une récompense</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Jour de winstreak (1-100)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={formData.day_number}
                onChange={(e) => setFormData({ ...formData, day_number: parseInt(e.target.value) || 1 })}
                className="bg-card border-border"
              />
            </div>

            <div className="space-y-2">
              <Label>Type de récompense</Label>
              <Select
                value={formData.reward_type}
                onValueChange={(v: RewardType) => setFormData({ ...formData, reward_type: v })}
              >
                <SelectTrigger className="bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pack">Pack Standard</SelectItem>
                  <SelectItem value="pack_lucky">Pack Chanceux</SelectItem>
                  <SelectItem value="pack_ultra">Pack Ultra Chanceux</SelectItem>
                  <SelectItem value="card">Carte spécifique</SelectItem>
                  <SelectItem value="boost_luck">Boost de Luck</SelectItem>
                  <SelectItem value="boost_pack">Amélioration des packs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(formData.reward_type === 'pack' || formData.reward_type === 'pack_lucky' || formData.reward_type === 'pack_ultra') && (
              <div className="space-y-2">
                <Label>Nombre de cartes</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={formData.card_count}
                  onChange={(e) => setFormData({ ...formData, card_count: parseInt(e.target.value) || 1 })}
                  className="bg-card border-border"
                />
              </div>
            )}

            {formData.reward_type === 'card' && (
              <div className="space-y-2">
                <Label>Carte à offrir</Label>
                <Select
                  value={formData.card_id}
                  onValueChange={(v) => setFormData({ ...formData, card_id: v })}
                >
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue placeholder="Sélectionner une carte" />
                  </SelectTrigger>
                  <SelectContent>
                    {cards.map((card) => (
                      <SelectItem key={card.id} value={card.id}>
                        <div className="flex items-center gap-2">
                          <span>{card.title}</span>
                          <span className="text-xs" style={{ color: RARITY_CONFIG[card.rarity as Rarity]?.color }}>
                            ({RARITY_CONFIG[card.rarity as Rarity]?.label})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.reward_type === 'boost_luck' && (
              <div className="space-y-2">
                <Label>Multiplicateur</Label>
                <Select
                  value={String(formData.luck_multiplier)}
                  onValueChange={(v) => setFormData({ ...formData, luck_multiplier: parseFloat(v) })}
                >
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LUCK_MULTIPLIERS.map((m) => (
                      <SelectItem key={m} value={String(m)}>×{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.reward_type === 'boost_pack' && (
              <div className="space-y-2">
                <Label>Amélioration</Label>
                <Select
                  value={formData.pack_bonus}
                  onValueChange={(v) => setFormData({ ...formData, pack_bonus: v })}
                >
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PACK_BONUSES.map((b) => (
                      <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button
              variant="gold"
              onClick={handleCreate}
              disabled={createReward.isPending}
            >
              {createReward.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Créer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
