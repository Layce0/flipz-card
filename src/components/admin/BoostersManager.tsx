import { useEffect, useState } from 'react';
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
import { isRarityColor } from '@/lib/boosterAppearance';

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

const CustomRaritySelect = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) => options.length ? (
  <Select value={value || 'default'} onValueChange={v => onChange(v === 'default' ? '' : v)}>
    <SelectTrigger className="bg-card border-border w-full sm:w-36"><SelectValue placeholder="Rareté spéciale" /></SelectTrigger>
    <SelectContent>
      <SelectItem value="default">Standard</SelectItem>
      {options.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
    </SelectContent>
  </Select>
) : null;

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
  const [cardBackUrl, setCardBackUrl] = useState<string | null>(null);
  const [cardCount, setCardCount] = useState(5);
  const [customRarities, setCustomRarities] = useState<string[]>([]);
  const [rarityColors, setRarityColors] = useState<Record<string, string>>({});
  const [newRarity, setNewRarity] = useState('');

  // Add existing card
  const [addCardId, setAddCardId] = useState('');
  const [addRarity, setAddRarity] = useState<Rarity>('common');
  const [addCustomRarity, setAddCustomRarity] = useState('');
  const [addDropRate, setAddDropRate] = useState(100);
  // New exclusive card
  const [nc, setNc] = useState({ title: '', description: '', rarity: 'common' as Rarity, customRarity: '', dropRate: 100, file: null as File | null });
  const [newCardPreview, setNewCardPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!nc.file) { setNewCardPreview(null); return; }
    const url = URL.createObjectURL(nc.file);
    setNewCardPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [nc.file]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['boosters'] });
    qc.invalidateQueries({ queryKey: ['booster-cards'] });
    qc.invalidateQueries({ queryKey: ['cards'] });
  };

  const openEditor = (b: Booster | null) => {
    setEditing(b);
    setName(b?.name ?? '');
    setImageUrl(b?.image_url ?? null);
    setCardBackUrl(b?.card_back_url ?? null);
    setCardCount(b?.card_count ?? 5);
    setCustomRarities(b?.custom_rarities ?? []);
    setRarityColors(b?.rarity_colors ?? {});
    setNewRarity('');
    setAddCustomRarity('');
    setOpen(true);
  };

  const saveBooster = async () => {
    if (!name.trim()) return toast.error('Donne un nom au booster');
    setBusy(true);
    try {
      const payload = { name: name.trim(), image_url: imageUrl, card_back_url: cardBackUrl, card_count: Math.max(1, Math.min(50, cardCount)), custom_rarities: customRarities, rarity_colors: rarityColors };
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

  const uploadImage = async (file?: File, target: 'pack' | 'back' = 'pack') => {
    if (!file) return;
    try {
      const url = await upload.mutateAsync(file);
      if (target === 'back') setCardBackUrl(url);
      else setImageUrl(url);
    } catch (e: any) { toast.error(e.message); }
  };

  const addExisting = async () => {
    if (!editing || !addCardId) return;
    const { error } = await db.from('booster_cards').insert({ booster_id: editing.id, card_id: addCardId, rarity: addRarity, custom_rarity: addCustomRarity || null, drop_rate: Math.max(0, addDropRate) });
    if (error) return toast.error(error.message.includes('duplicate') ? 'Carte déjà dans ce booster' : error.message);
    setAddCardId('');
    setAddCustomRarity('');
    setAddDropRate(100);
    refresh();
  };

  const moveRarity = async (i: number, delta: number) => {
    if (!editing) return;
    const next = [...customRarities];
    const j = i + delta;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    const { error } = await db.from('boosters').update({ custom_rarities: next }).eq('id', editing.id);
    if (error) return toast.error(error.message);
    setCustomRarities(next);
    refresh();
  };

  const createExclusive = async () => {
    if (!editing) return;
    if (!nc.title.trim() || !nc.file) return toast.error('Nom et image requis');
    if (!nc.customRarity) return toast.error('Choisis une rareté spéciale');
    setBusy(true);
    try {
      const url = await upload.mutateAsync(nc.file);
      const { data: card, error } = await db.from('cards').insert({
        title: nc.title.trim(), description: nc.description.trim() || nc.title.trim(),
        image_url: url, rarity: 'common', booster_id: editing.id,
      }).select().single();
      if (error) throw error;
      const { error: e2 } = await db.from('booster_cards').insert({ booster_id: editing.id, card_id: card.id, rarity: 'common', custom_rarity: nc.customRarity, drop_rate: Math.max(0, nc.dropRate) });
      if (e2) throw e2;
      setNc({ title: '', description: '', rarity: 'common', customRarity: '', dropRate: 100, file: null });
      toast.success('Carte exclusive créée');
      refresh();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const updateRarity = async (id: string, rarity: Rarity) => {
    const { error } = await db.from('booster_cards').update({ rarity }).eq('id', id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const updateCustomRarity = async (id: string, custom_rarity: string) => {
    const { error } = await db.from('booster_cards').update({ custom_rarity: custom_rarity || null }).eq('id', id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const addRarityLabel = async () => {
    const label = newRarity.trim().slice(0, 32);
    if (!editing || !label || customRarities.some(r => r.toLocaleLowerCase() === label.toLocaleLowerCase())) return;
    const next = [...customRarities, label];
    const { error } = await db.from('boosters').update({ custom_rarities: next }).eq('id', editing.id);
    if (error) return toast.error(error.message);
    setCustomRarities(next);
    setNewRarity('');
    refresh();
  };

  const updateRarityColor = async (label: string, color: string) => {
    if (!editing || !isRarityColor(color)) return;
    const next = { ...rarityColors, [label]: color };
    const { error } = await db.from('boosters').update({ rarity_colors: next }).eq('id', editing.id);
    if (error) return toast.error(error.message);
    setRarityColors(next);
    refresh();
  };

  const removeRarityLabel = async (label: string) => {
    if (!editing) return;
    const next = customRarities.filter(r => r !== label);
    const nextColors = { ...rarityColors };
    delete nextColors[label];
    const { error } = await db.from('boosters').update({ custom_rarities: next, rarity_colors: nextColors }).eq('id', editing.id);
    if (error) return toast.error(error.message);
    await db.from('booster_cards').update({ custom_rarity: null }).eq('booster_id', editing.id).eq('custom_rarity', label);
    setCustomRarities(next);
    setRarityColors(nextColors);
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
            <div className="space-y-1">
              <Label>Dos des cartes du booster</Label>
              <div className="flex items-center gap-3">
                {cardBackUrl && <img src={cardBackUrl} alt="Aperçu du dos" className="w-12 h-16 rounded object-cover" />}
                <Input aria-label="Image du dos des cartes" type="file" accept="image/*" onChange={e => uploadImage(e.target.files?.[0], 'back')} className="bg-card border-border min-w-0" />
                {cardBackUrl && <Button size="icon" variant="ghost" aria-label="Retirer le dos personnalisé" onClick={() => setCardBackUrl(null)}><Trash2 className="w-4 h-4" /></Button>}
              </div>
            </div>
            <div className="space-y-1"><Label>Cartes par ouverture</Label><Input type="number" min={1} max={50} value={cardCount} onChange={e => setCardCount(parseInt(e.target.value) || 1)} className="bg-card border-border" /></div>
            <Button onClick={saveBooster} disabled={busy || upload.isPending} className="w-full">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Enregistrer
            </Button>
          </div>

          {editing && (
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="space-y-2">
                <Label>Raretés spéciales du booster</Label>
                <div className="flex flex-wrap gap-2">
                  {customRarities.map((r, i) => <div key={r} className="flex items-center gap-1 border border-border bg-muted px-2 py-1 text-sm rounded"><span className="text-xs text-muted-foreground w-4">{i + 1}.</span><Button size="icon" variant="ghost" className="h-6 w-6" aria-label={`Monter ${r}`} disabled={i === 0} onClick={() => moveRarity(i, -1)}>↑</Button><Button size="icon" variant="ghost" className="h-6 w-6" aria-label={`Descendre ${r}`} disabled={i === customRarities.length - 1} onClick={() => moveRarity(i, 1)}>↓</Button><input type="color" aria-label={`Couleur de ${r}`} title={`Couleur de ${r}`} value={isRarityColor(rarityColors[r]) ? rarityColors[r] : '#00a896'} onChange={e => updateRarityColor(r, e.target.value)} className="w-8 h-8 cursor-pointer bg-transparent border-0 p-0" /><span>{r}</span><Button size="icon" variant="ghost" className="h-6 w-6" aria-label={`Supprimer ${r}`} onClick={() => removeRarityLabel(r)}><Trash2 className="w-3 h-3" /></Button></div>)}
                </div>
                <div className="flex gap-2"><Input aria-label="Nouvelle rareté" placeholder="Nom de la rareté" maxLength={32} value={newRarity} onChange={e => setNewRarity(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRarityLabel(); } }} /><Button size="icon" aria-label="Ajouter la rareté" onClick={addRarityLabel} disabled={!newRarity.trim()}><Plus className="w-4 h-4" /></Button></div>
              </div>
              <Label>Contenu du booster</Label>
              <div className="space-y-2">
                {contents.map(bc => {
                  const card: any = allCards.find(c => c.id === bc.card_id);
                  if (!card) return null;
                  return (
                    <div key={bc.id} className="flex flex-wrap items-center gap-2 border-b border-border/50 pb-2">
                      <img src={card.image_url} alt={card.title} className="w-12 h-16 rounded object-cover shrink-0" />
                      <span className="flex-1 min-w-24 text-sm truncate">{card.title}{card.booster_id ? ' ★' : ''}</span>
                      <RaritySelect value={bc.rarity} onChange={r => updateRarity(bc.id, r)} />
                      <CustomRaritySelect options={customRarities} value={bc.custom_rarity ?? ''} onChange={r => updateCustomRarity(bc.id, r)} />
                      <div className="flex items-center gap-1">
                        <Input
                          type="number" min={0} max={100} step={1}
                          defaultValue={bc.drop_rate ?? 100}
                          onBlur={e => updateDropRate(bc.id, parseFloat(e.target.value) || 0)}
                          className="bg-card border-border w-20"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => removeCard(bc.id, bc.card_id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  );
                })}
                {contents.length === 0 && <p className="text-xs text-muted-foreground">Aucune carte pour l'instant.</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Ajouter une carte existante</Label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto">
                  {normalCards.map(c => <Button key={c.id} type="button" variant={addCardId === c.id ? 'default' : 'ghost'} className="h-auto flex-col p-1 min-w-0" onClick={() => setAddCardId(c.id)} title={c.title}><img src={c.image_url} alt={c.title} className="w-full aspect-[3/4] object-cover rounded" /><span className="w-full truncate text-xs">{c.title}</span></Button>)}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <Select value={addCardId} onValueChange={setAddCardId}>
                    <SelectTrigger className="bg-card border-border flex-1 min-w-28"><SelectValue placeholder="Carte" /></SelectTrigger>
                    <SelectContent>{normalCards.map(c => <SelectItem key={c.id} value={c.id}><span className="inline-flex items-center gap-2"><img src={c.image_url} alt="" className="w-7 h-9 object-cover rounded" />{c.title}</span></SelectItem>)}</SelectContent>
                  </Select>
                  <RaritySelect value={addRarity} onChange={setAddRarity} />
                  <CustomRaritySelect options={customRarities} value={addCustomRarity} onChange={setAddCustomRarity} />
                  <div className="flex items-center gap-1">
                    <Input type="number" min={0} max={100} value={addDropRate} onChange={e => setAddDropRate(parseFloat(e.target.value) || 0)} className="bg-card border-border w-20" />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                  <Button size="icon" aria-label="Ajouter la carte" disabled={!addCardId} onClick={addExisting}><Plus className="w-4 h-4" /></Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Créer une carte exclusive (★)</Label>
                <Input placeholder="Nom" value={nc.title} onChange={e => setNc({ ...nc, title: e.target.value })} className="bg-card border-border" />
                <Textarea placeholder="Description" value={nc.description} onChange={e => setNc({ ...nc, description: e.target.value })} className="bg-card border-border" />
                {newCardPreview && <img src={newCardPreview} alt="Aperçu de la carte" className="w-20 h-28 object-cover rounded" />}
                <Input type="file" accept="image/*" onChange={e => setNc({ ...nc, file: e.target.files?.[0] ?? null })} className="bg-card border-border" />
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Rareté</Label>
                  {customRarities.length ? (
                    <Select value={nc.customRarity || undefined} onValueChange={v => setNc({ ...nc, customRarity: v })}>
                      <SelectTrigger className="bg-card border-border w-full"><SelectValue placeholder="Choisir une rareté" /></SelectTrigger>
                      <SelectContent>
                        {customRarities.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : <p className="text-xs text-muted-foreground">Ajoute une rareté spéciale plus haut pour pouvoir créer une carte.</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-1">
                    <Input type="number" min={0} max={100} value={nc.dropRate} onChange={e => setNc({ ...nc, dropRate: parseFloat(e.target.value) || 0 })} className="bg-card border-border w-20" />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
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
