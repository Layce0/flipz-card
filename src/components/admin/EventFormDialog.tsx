import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Sparkles, Volume2, Gift, Zap } from 'lucide-react';
import { GameEvent, EventType, DEFAULT_RARITY_BOOSTS } from '@/types/event';
import { RARITY_CONFIG } from '@/types/card';
import { cn } from '@/lib/utils';

interface EventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: GameEvent | null;
  onSave: (event: Omit<GameEvent, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  isLoading?: boolean;
}

const getDefaultFormData = (): Omit<GameEvent, 'id' | 'created_at' | 'updated_at'> => {
  const now = new Date();
  const endDate = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
  
  return {
    name: '',
    description: '',
    type: 'short',
    start_at: now.toISOString().slice(0, 16),
    end_at: endDate.toISOString().slice(0, 16),
    duration_minutes: 30,
    is_active: false,
    is_draft: true,
    glow_enabled: false,
    flash_enabled: false,
    confetti_enabled: false,
    special_animation: null,
    music_url: null,
    sound_effect_url: null,
    affects_free_pack: true,
    affects_standard_pack: true,
    affects_lucky_pack: true,
    affects_ultra_pack: true,
    rarity_boosts: { ...DEFAULT_RARITY_BOOSTS },
    global_multiplier: 1,
    bonus_cards: 0,
    max_stack: 1,
    created_by: null,
  };
};

export const EventFormDialog = ({ 
  open, 
  onOpenChange, 
  event, 
  onSave, 
  isLoading 
}: EventFormDialogProps) => {
  const [formData, setFormData] = useState<Omit<GameEvent, 'id' | 'created_at' | 'updated_at'>>(getDefaultFormData());

  useEffect(() => {
    if (event) {
      setFormData({
        name: event.name,
        description: event.description,
        type: event.type,
        start_at: event.start_at.slice(0, 16),
        end_at: event.end_at.slice(0, 16),
        duration_minutes: event.duration_minutes,
        is_active: event.is_active,
        is_draft: event.is_draft,
        glow_enabled: event.glow_enabled,
        flash_enabled: event.flash_enabled,
        confetti_enabled: event.confetti_enabled,
        special_animation: event.special_animation,
        music_url: event.music_url,
        sound_effect_url: event.sound_effect_url,
        affects_free_pack: event.affects_free_pack,
        affects_standard_pack: event.affects_standard_pack,
        affects_lucky_pack: event.affects_lucky_pack,
        affects_ultra_pack: event.affects_ultra_pack,
        rarity_boosts: event.rarity_boosts || { ...DEFAULT_RARITY_BOOSTS },
        global_multiplier: event.global_multiplier,
        bonus_cards: event.bonus_cards,
        max_stack: event.max_stack,
        created_by: event.created_by,
      });
    } else {
      setFormData(getDefaultFormData());
    }
  }, [event, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
    onOpenChange(false);
  };

  const updateRarityBoost = (rarity: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      rarity_boosts: { ...prev.rarity_boosts, [rarity]: value },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {event ? 'Modifier l\'événement' : 'Créer un événement'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">Général</TabsTrigger>
              <TabsTrigger value="effects">
                <Sparkles className="w-4 h-4 mr-1" />
                Effets
              </TabsTrigger>
              <TabsTrigger value="boosts">
                <Zap className="w-4 h-4 mr-1" />
                Boosts
              </TabsTrigger>
              <TabsTrigger value="packs">
                <Gift className="w-4 h-4 mr-1" />
                Packs
              </TabsTrigger>
            </TabsList>

            {/* General Tab */}
            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom de l'événement *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Double XP Weekend"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Description de l'événement..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type d'événement</Label>
                    <Select 
                      value={formData.type} 
                      onValueChange={(value: EventType) => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short">Court (~30 min)</SelectItem>
                        <SelectItem value="long">Long (jours/semaines)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.type === 'short' && (
                    <div className="space-y-2">
                      <Label htmlFor="duration">Durée (minutes)</Label>
                      <Input
                        id="duration"
                        type="number"
                        min={1}
                        value={formData.duration_minutes || 30}
                        onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start">Début</Label>
                    <Input
                      id="start"
                      type="datetime-local"
                      value={formData.start_at}
                      onChange={(e) => setFormData({ ...formData, start_at: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end">Fin</Label>
                    <Input
                      id="end"
                      type="datetime-local"
                      value={formData.end_at}
                      onChange={(e) => setFormData({ ...formData, end_at: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Effects Tab */}
            <TabsContent value="effects" className="space-y-4 mt-4">
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Effets visuels
                </h3>
                
                <div className="grid gap-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                    <div>
                      <Label>Glow</Label>
                      <p className="text-xs text-muted-foreground">Lueur autour des éléments</p>
                    </div>
                    <Switch
                      checked={formData.glow_enabled}
                      onCheckedChange={(checked) => setFormData({ ...formData, glow_enabled: checked })}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                    <div>
                      <Label>Flash</Label>
                      <p className="text-xs text-muted-foreground">Effet flash à l'ouverture</p>
                    </div>
                    <Switch
                      checked={formData.flash_enabled}
                      onCheckedChange={(checked) => setFormData({ ...formData, flash_enabled: checked })}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                    <div>
                      <Label>Confettis</Label>
                      <p className="text-xs text-muted-foreground">Pluie de confettis</p>
                    </div>
                    <Switch
                      checked={formData.confetti_enabled}
                      onCheckedChange={(checked) => setFormData({ ...formData, confetti_enabled: checked })}
                    />
                  </div>
                </div>

                <h3 className="font-semibold text-foreground flex items-center gap-2 pt-4">
                  <Volume2 className="w-4 h-4 text-primary" />
                  Effets sonores
                </h3>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="music">URL Musique d'ambiance</Label>
                    <Input
                      id="music"
                      value={formData.music_url || ''}
                      onChange={(e) => setFormData({ ...formData, music_url: e.target.value || null })}
                      placeholder="https://..."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="sfx">URL Effet sonore</Label>
                    <Input
                      id="sfx"
                      value={formData.sound_effect_url || ''}
                      onChange={(e) => setFormData({ ...formData, sound_effect_url: e.target.value || null })}
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Boosts Tab */}
            <TabsContent value="boosts" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Multiplicateur global</Label>
                  <Input
                    type="number"
                    min={1}
                    step={0.1}
                    value={formData.global_multiplier}
                    onChange={(e) => setFormData({ ...formData, global_multiplier: parseFloat(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Multiplie toutes les chances (ex: 1.5 = +50%)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Cartes bonus par pack</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.bonus_cards}
                    onChange={(e) => setFormData({ ...formData, bonus_cards: parseInt(e.target.value) })}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Multiplicateurs par rareté</Label>
                  {Object.entries(RARITY_CONFIG).map(([key, config]) => (
                    <div key={key} className="flex items-center gap-3 p-2 rounded-lg bg-card border border-border">
                      <span 
                        className={cn("px-2 py-0.5 rounded-full text-xs font-semibold uppercase", config.bgClass)}
                        style={{ color: key === 'legendary' ? 'hsl(240, 20%, 6%)' : 'white' }}
                      >
                        {config.label}
                      </span>
                      <span className="text-muted-foreground">×</span>
                      <Input
                        type="number"
                        min={0.1}
                        step={0.1}
                        className="w-24"
                        value={formData.rarity_boosts[key] || 1}
                        onChange={(e) => updateRarityBoost(key, parseFloat(e.target.value))}
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label>Limite d'empilement</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.max_stack}
                    onChange={(e) => setFormData({ ...formData, max_stack: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Nombre max d'événements pouvant se cumuler
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Packs Tab */}
            <TabsContent value="packs" className="space-y-4 mt-4">
              <div className="space-y-3">
                <Label>Packs affectés par l'événement</Label>
                
                <div className="grid gap-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                    <div>
                      <Label>Pack gratuit</Label>
                      <p className="text-xs text-muted-foreground">Pack quotidien gratuit</p>
                    </div>
                    <Switch
                      checked={formData.affects_free_pack}
                      onCheckedChange={(checked) => setFormData({ ...formData, affects_free_pack: checked })}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                    <div>
                      <Label>Packs Standard</Label>
                      <p className="text-xs text-muted-foreground">Probabilités normales</p>
                    </div>
                    <Switch
                      checked={formData.affects_standard_pack}
                      onCheckedChange={(checked) => setFormData({ ...formData, affects_standard_pack: checked })}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                    <div>
                      <Label>Packs Chanceux</Label>
                      <p className="text-xs text-muted-foreground">×2 épique/légendaire</p>
                    </div>
                    <Switch
                      checked={formData.affects_lucky_pack}
                      onCheckedChange={(checked) => setFormData({ ...formData, affects_lucky_pack: checked })}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                    <div>
                      <Label>Packs Ultra Chanceux</Label>
                      <p className="text-xs text-muted-foreground">×5 épique/légendaire</p>
                    </div>
                    <Switch
                      checked={formData.affects_ultra_pack}
                      onCheckedChange={(checked) => setFormData({ ...formData, affects_ultra_pack: checked })}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="gold" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : event ? (
                'Sauvegarder'
              ) : (
                'Créer l\'événement'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
