import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, Plus, Trash2, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useAllCards, useUploadCardImage } from '@/hooks/useCards';
import { useBoosters, useBoosterCards, Booster } from '@/hooks/useBoosters';
import { RARITY_CONFIG, Rarity } from '@/types/card';

const db = supabase as any;
const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

const RaritySelect = ({ value, onChange }: { value: Rarity; onChange: (r: Rarity) => void }) => (
  <Select value={value} onValueChange={(v) => onChange(v as Rarity)}>
    <SelectTrigger className="bg-card border-border w-32"><SelectValue /></SelectTrigger>
    <SelectContent>
      {RARITIES.map(r => <SelectItem key={r} value={r}>{RARITY_CONFIG[r].label}</SelectItem>)}
    </SelectContent>
  </Select>
);

export const BoostersManager = () => {
  const qc = useQueryClient();
  const { data: boosters = [] } = useBoosters();
  const { data: boosterCards = [] } = useBoosterCards();
  const { data: allCards = [] } = useAllCards();
  const upload = useUploadCardImage();

  const [editing, setEditing] = useState<Booster | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [cardCount, setCardCount] = useState(5);

  // Add existing card
  const [addCardId, setAddCardId] = useState('');
  const [addRarity, setAddRarity] = useState<Rarity>('common');
  const [addDropRate, setAddDropRate] = useState(100);
  // New exclusive card
  const [nc, setNc] = useState({ title: '', description: '', rarity: 'common' as Rarity, dropRate: 100, file: null as File | null });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['boosters'] });
    qc.invalidateQueries({ queryKey: ['booster-cards'] });
    qc.invalidateQueries({ queryKey: ['cards'] });
  };

  const openEditor = (b: Booster | null) => {
    setEditing(b);
    setName(b?.name ?? '');
    setImageUrl(b?.image_url ?? null);
    setCardCount(b?.card_count ?? 5);
    setOpen(true);
  };

  const saveBooster = async () => {
    if (!name.trim()) return toast.error('Donne un nom au booster');
    setBusy(true);
    try {
      const payload = { name: name.trim(), image_url: imageUrl, card_count: Math.max(1, Math.min(50, cardCount)) };
      if (editing) {
        const { error } = await db.from('boosters').update(payload).eq('id', editing.id);
        if (error) throw error;
        setEditing({ ...editing, ...payload });
      } else {
        const { data, error } = await db.from('boosters').insert(payload).select().single();
        if (error) throw error;
        setEditing(data);
      }
      toast.success('Booster enregistré');
      refresh();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const deleteBooster = async (b: Booster) => {
    if (!confirm(`Supprimer « ${b.name} » et ses cartes exclusives ?`)) return;
    const { error } = await db.from('boosters').delete().eq('id', b.id);
    if (error) return toast.error(error.message);
    toast.success('Booster supprimé');
    refresh();
  };

  const uploadImage = async (file?: File) => {
    if (!file) return;
    try { setImageUrl(await upload.mutateAsync(file)); } catch (e: any) { toast.error(e.message); }
  };

  const addExisting = async () => {
    if (!editing || !addCardId) return;
    const { error } = await db.from('booster_cards').insert({ booster_id: editing.id, card_id: addCardId, rarity: addRarity, drop_rate: Math.max(0, addDropRate) });
    if (error) return toast.error(error.message.includes('duplicate') ? 'Carte déjà dans ce booster' : error.message);
    setAddCardId('');
    setAddDropRate(100);
    refresh();
  };

  const createExclusive = async () => {
    if (!editing) return;
    if (!nc.title.trim() || !nc.file) return toast.error('Nom et image requis');
    setBusy(true);
    try {
      const url = await upload.mutateAsync(nc.file);
      const { data: card, error } = await db.from('cards').insert({
        title: nc.title.trim(), description: nc.description.trim() || nc.title.trim(),
        image_url: url, rarity: nc.rarity, booster_id: editing.id,
      }).select().single();
      if (error) throw error;
      const { error: e2 } = await db.from('booster_cards').insert({ booster_id: editing.id, card_id: card.id, rarity: nc.rarity, drop_rate: Math.max(0, nc.dropRate) });
      if (e2) throw e2;
      setNc({ title: '', description: '', rarity: 'common', dropRate: 100, file: null });
      toast.success('Carte exclusive créée');
      refresh();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const updateRarity = async (id: string, rarity: Rarity) => {
    const { error } = await db.from('booster_cards').update({ rarity }).eq('id', id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const updateDropRate = async (id: string, drop_rate: number) => {
    const { error } = await db.from('booster_cards').update({ drop_rate: Math.max(0, drop_rate) }).eq('id', id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const removeCard = async (bcId: string, cardId: string) => {
    const card = allCards.find(c => c.id === cardId) as any;
    if (card?.booster_id === editing?.id) {
      if (!confirm('Carte exclusive : elle sera supprimée définitivement. Continuer ?')) return;
      const { error } = await db.from('cards').delete().eq('id', cardId);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await db.from('booster_cards').delete().eq('id', bcId);
      if (error) return toast.error(error.message);
    }
    refresh();
  };

  const contents = editing ? boosterCards.filter(bc => bc.booster_id === editing.id) : [];
  const normalCards = allCards.filter((c: any) => !c.booster_id);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-foreground flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" /> Boosters
        </h2>
        <Button size="sm" onClick={() => openEditor(null)}><Plus className="w-4 h-4" /> Créer</Button>
      </div>

      <div className="space-y-2">
        {boosters.map(b => (
          <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
            {b.image_url ? <img src={b.image_url} alt={b.name} className="w-12 h-12 rounded-lg object-cover" /> : <div className="w-12 h-12 rounded-lg bg-muted" />}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">{b.name}</p>
              <p className="text-xs text-muted-foreground">{b.card_count} cartes/ouverture • {boosterCards.filter(bc => bc.booster_id === b.id).length} dans le booster</p>
            </div>
            <Button size="icon" variant="ghost" onClick={() => openEditor(b)}><Pencil className="w-4 h-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => deleteBooster(b)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? editing.name : 'Nouveau booster'}</DialogTitle></DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1"><Label>Nom</Label><Input value={name} onChange={e => setName(e.target.value)} className="bg-card border-border" /></div>
            <div className="space-y-1">
              <Label>Photo</Label>
              <div className="flex items-center gap-3">
                {imageUrl && <img src={imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover" />}
                <Input type="file" accept="image/*" onChange={e => uploadImage(e.target.files?.[0])} className="bg-card border-border" />
              </div>
            </div>
            <div className="space-y-1"><Label>Cartes par ouverture</Label><Input type="number" min={1} max={50} value={cardCount} onChange={e => setCardCount(parseInt(e.target.value) || 1)} className="bg-card border-border" /></div>
            <Button onClick={saveBooster} disabled={busy || upload.isPending} className="w-full">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Enregistrer
            </Button>
          </div>

          {editing && (
            <div className="space-y-4 pt-4 border-t border-border">
              <Label>Contenu du booster</Label>
              <div className="space-y-2">
                {contents.map(bc => {
                  const card: any = allCards.find(c => c.id === bc.card_id);
                  if (!card) return null;
                  return (
                    <div key={bc.id} className="flex items-center gap-2">
                      <img src={card.image_url} alt="" className="w-10 h-10 rounded object-cover" />
                      <span className="flex-1 text-sm truncate">{card.title}{card.booster_id ? ' ★' : ''}</span>
                      <RaritySelect value={bc.rarity} onChange={r => updateRarity(bc.id, r)} />
                      <Button size="icon" variant="ghost" onClick={() => removeCard(bc.id, bc.card_id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  );
                })}
                {contents.length === 0 && <p className="text-xs text-muted-foreground">Aucune carte pour l'instant.</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Ajouter une carte existante</Label>
                <div className="flex gap-2">
                  <Select value={addCardId} onValueChange={setAddCardId}>
                    <SelectTrigger className="bg-card border-border flex-1"><SelectValue placeholder="Carte" /></SelectTrigger>
                    <SelectContent>{normalCards.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                  </Select>
                  <RaritySelect value={addRarity} onChange={setAddRarity} />
                  <Button size="icon" onClick={addExisting}><Plus className="w-4 h-4" /></Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Créer une carte exclusive (★)</Label>
                <Input placeholder="Nom" value={nc.title} onChange={e => setNc({ ...nc, title: e.target.value })} className="bg-card border-border" />
                <Textarea placeholder="Description" value={nc.description} onChange={e => setNc({ ...nc, description: e.target.value })} className="bg-card border-border" />
                <div className="flex gap-2">
                  <Input type="file" accept="image/*" onChange={e => setNc({ ...nc, file: e.target.files?.[0] ?? null })} className="bg-card border-border flex-1" />
                  <RaritySelect value={nc.rarity} onChange={r => setNc({ ...nc, rarity: r })} />
                </div>
                <Button variant="outline" className="w-full" onClick={createExclusive} disabled={busy}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Créer la carte
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};
