import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Ticket, Plus, Loader2, Trash2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useAllCards } from '@/hooks/useCards';
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

export const RewardCodesManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: cards = [] } = useAllCards();
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    reward_type: 'pack' as RewardType,
    // Pack config
    card_count: 5,
    // Card config
    card_id: '',
    // Boost luck config
    luck_multiplier: 2,
    // Boost pack config
    pack_bonus: 'bonus_1',
    // General
    max_uses: '',
    expires_in_hours: '',
    is_gift: true,
  });

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ['reward-codes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reward_codes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createCode = useMutation({
    mutationFn: async () => {
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

      let expires_at = null;
      if (formData.expires_in_hours) {
        const expiry = new Date();
        expiry.setHours(expiry.getHours() + parseInt(formData.expires_in_hours));
        expires_at = expiry.toISOString();
      }

      const { error } = await supabase
        .from('reward_codes')
        .insert({
          code: formData.code.toUpperCase().trim(),
          reward_type: formData.reward_type,
          reward_config,
          expires_at,
          max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
          is_gift: formData.is_gift,
          created_by: user?.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reward-codes'] });
      toast.success('Code créé !');
      setShowCreate(false);
      setFormData({
        code: '', reward_type: 'pack', card_count: 5, card_id: '',
        luck_multiplier: 2, pack_bonus: 'bonus_1', max_uses: '', expires_in_hours: '',
        is_gift: true,
      });
    },
    onError: (error: any) => {
      if (error?.message?.includes('duplicate')) {
        toast.error('Ce code existe déjà');
      } else {
        toast.error('Erreur lors de la création');
      }
    },
  });

  const deleteCode = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reward_codes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reward-codes'] });
      toast.success('Code supprimé');
    },
  });

  const getRewardLabel = (type: string, config: any) => {
    if (type === 'pack') return `Pack Standard ${config?.card_count || 5} cartes`;
    if (type === 'pack_lucky') return `Pack Chanceux ${config?.card_count || 5} cartes`;
    if (type === 'pack_ultra') return `Pack Ultra Chanceux ${config?.card_count || 5} cartes`;
    if (type === 'card') return 'Carte spécifique';
    if (type === 'boost_luck') return `Luck ×${config?.multiplier || 2}`;
    if (type === 'boost_pack') {
      if (config?.multiplier) return `×${config.multiplier} cartes/pack`;
      if (config?.bonus) return `+${config.bonus} cartes/pack`;
      return config?.label || 'Boost pack';
    }
    return type;
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-foreground flex items-center gap-2">
          <Ticket className="w-5 h-5 text-primary" />
          Codes promo
        </h2>
        <Button size="sm" variant="gold" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          Créer
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : codes.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">Aucun code créé</p>
      ) : (
        <div className="space-y-2">
          {codes.map((c: any) => {
            const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
            return (
              <div
                key={c.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl bg-card border border-border",
                  isExpired && "opacity-50"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-primary">{c.code}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(c.code);
                        toast.success('Code copié !');
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getRewardLabel(c.reward_type, c.reward_config)}
                    {isExpired && ' • Expiré'}
                    {c.max_uses && ` • Max ${c.max_uses} utilisations`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm('Supprimer ce code ?')) {
                      deleteCode.mutate(c.id);
                    }
                  }}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Create code dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer un code promo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="Ex: LUCKBOOST1"
                className="bg-card border-border uppercase font-mono"
                maxLength={30}
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
                  <SelectItem value="pack_lucky">Pack Chanceux (×2)</SelectItem>
                  <SelectItem value="pack_ultra">Pack Ultra Chanceux (×5)</SelectItem>
                  <SelectItem value="card">Carte spécifique</SelectItem>
                  <SelectItem value="boost_luck">Boost de Luck</SelectItem>
                  <SelectItem value="boost_pack">Amélioration des packs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Pack config */}
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

            {/* Card config */}
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
                          <span
                            className="text-xs"
                            style={{ color: RARITY_CONFIG[card.rarity as Rarity]?.color }}
                          >
                            ({RARITY_CONFIG[card.rarity as Rarity]?.label})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Boost luck config */}
            {formData.reward_type === 'boost_luck' && (
              <div className="space-y-2">
                <Label>Multiplicateur de chance</Label>
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
                <p className="text-xs text-muted-foreground">
                  Augmente les chances d'obtenir des cartes épiques et légendaires pendant 1h
                </p>
              </div>
            )}

            {/* Boost pack config */}
            {formData.reward_type === 'boost_pack' && (
              <div className="space-y-2">
                <Label>Amélioration des packs</Label>
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
                <p className="text-xs text-muted-foreground">
                  S'applique à tous les packs pendant 1h
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Utilisations max (optionnel)</Label>
              <Input
                type="number"
                min={1}
                value={formData.max_uses}
                onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                placeholder="Illimité"
                className="bg-card border-border"
              />
            </div>

            <div className="space-y-2">
              <Label>Expire dans (heures, optionnel)</Label>
              <Input
                type="number"
                min={1}
                value={formData.expires_in_hours}
                onChange={(e) => setFormData({ ...formData, expires_in_hours: e.target.value })}
                placeholder="Pas d'expiration"
                className="bg-card border-border"
              />
            </div>

            <label className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border cursor-pointer">
              <Checkbox
                checked={formData.is_gift}
                onCheckedChange={(v) => setFormData({ ...formData, is_gift: v === true })}
                className="mt-0.5"
              />
              <span className="text-sm text-foreground">
                Code cadeau gratuit
                <span className="block text-xs text-muted-foreground">
                  Requis pour que le code soit utilisable sur iPhone (jamais vendu).
                </span>
              </span>
            </label>
          </div>


          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Annuler
            </Button>
            <Button
              variant="gold"
              onClick={() => createCode.mutate()}
              disabled={!formData.code.trim() || createCode.isPending}
            >
              {createCode.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Créer le code
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
