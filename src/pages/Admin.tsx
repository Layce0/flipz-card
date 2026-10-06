import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Shield, Plus, Trash2, Upload, Loader2, Gift, Save, Pencil, Layers, ExternalLink } from 'lucide-react';
import { RewardCodesManager } from '@/components/admin/RewardCodesManager';
import { WinstreakRewardsManager } from '@/components/admin/WinstreakRewardsManager';
import { PackProbabilitiesManager } from '@/components/admin/PackProbabilitiesManager';
import { UserAccountManager } from '@/components/admin/UserAccountManager';
import { ModeratorTools } from '@/components/admin/ModeratorTools';
import { BoostersManager } from '@/components/admin/BoostersManager';
import { GlobalStatsPanel } from '@/components/admin/GlobalStatsPanel';
import { Rarity, RARITY_CONFIG, GameCard } from '@/types/card';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useAllCards, useCreateCard, useDeleteCard, useUploadCardImage, useGiveCard, useAllProfiles } from '@/hooks/useCards';
import { useUpdateCard } from '@/hooks/useUpdateCard';

import { cn } from '@/lib/utils';

const Admin = () => {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: cards = [], isLoading: cardsLoading } = useAllCards();
  const { data: profiles = [], isLoading: profilesLoading } = useAllProfiles();
  const createCard = useCreateCard();
  const deleteCard = useDeleteCard();
  const updateCard = useUpdateCard();
  const uploadImage = useUploadCardImage();
  const giveCard = useGiveCard();
  const [editingCard, setEditingCard] = useState<GameCard | null>(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    title_en: '',
    title_es: '',
    description: '',
    description_en: '',
    description_es: '',
    image_url: '',
    rarity: 'common' as Rarity,
    release_date: '',
  });
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const [giveFormData, setGiveFormData] = useState({
    userId: '',
    cardId: '',
  });

  const [formData, setFormData] = useState({
    title: '',
    title_en: '',
    title_es: '',
    description: '',
    description_en: '',
    description_es: '',
    image_url: '',
    rarity: 'common' as Rarity,
    release_date: new Date().toISOString().split('T')[0],
  });

  // Note: AdminRoute wrapper in App.tsx handles auth/admin validation
  // This effect is kept as a safety fallback
  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
    }
  }, [user, isAdmin, authLoading, navigate]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await uploadImage.mutateAsync(file);
      setFormData(prev => ({ ...prev, image_url: url }));
      toast.success('Image uploadée !');
    } catch (error) {
      toast.error("Erreur lors de l'upload de l'image");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.image_url) {
      toast.error("Veuillez ajouter une image");
      return;
    }

    try {
      await createCard.mutateAsync(formData);
      toast.success('Carte créée avec succès !');
      setFormData({
        title: '',
        title_en: '',
        title_es: '',
        description: '',
        description_en: '',
        description_es: '',
        image_url: '',
        rarity: 'common',
        release_date: new Date().toISOString().split('T')[0],
      });
    } catch (error) {
      toast.error("Erreur lors de la création de la carte");
    }
  };

  const handleDelete = async (cardId: string, cardTitle: string) => {
    if (!confirm(`Supprimer la carte "${cardTitle}" ?`)) return;
    
    try {
      await deleteCard.mutateAsync(cardId);
      toast.success('Carte supprimée');
    } catch (error) {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleGiveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!giveFormData.userId || !giveFormData.cardId) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    try {
      await giveCard.mutateAsync({ userId: giveFormData.userId, cardId: giveFormData.cardId });
      toast.success('Carte donnée avec succès !');
      setGiveFormData({ userId: '', cardId: '' });
    } catch (error) {
      toast.error("Erreur lors de l'attribution de la carte");
    }
  };

  const handleEditCard = (card: GameCard) => {
    setEditingCard(card);
    setEditFormData({
      title: card.title,
      title_en: card.title_en || '',
      title_es: card.title_es || '',
      description: card.description,
      description_en: card.description_en || '',
      description_es: card.description_es || '',
      image_url: card.image_url,
      rarity: card.rarity,
      release_date: card.release_date,
    });
  };

  const handleEditImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await uploadImage.mutateAsync(file);
      setEditFormData(prev => ({ ...prev, image_url: url }));
      toast.success('Image uploadée !');
    } catch (error) {
      toast.error("Erreur lors de l'upload de l'image");
    }
  };

  const handleUpdateCard = async () => {
    if (!editingCard) return;

    try {
      await updateCard.mutateAsync({
        id: editingCard.id,
        ...editFormData,
      });
      toast.success('Carte modifiée avec succès !');
      setEditingCard(null);
    } catch (error) {
      toast.error("Erreur lors de la modification");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="pt-12 pb-6 px-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-xl text-foreground">Espace Admin</h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button asChild variant="default" size="sm" className="gap-2 shadow-lg shadow-primary/20">
            <Link to="/admin/canvas">
              <Layers className="w-4 h-4" />
              Canvas Studio
            </Link>
          </Button>
        </div>
      </header>

      <main className="px-4 space-y-8">
        <GlobalStatsPanel />

        {/* Visual CMS / Canvas Studio Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-card p-5 shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="space-y-1 max-w-md">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-primary text-primary-foreground">
                  Studio Visuel WYSIWYG
                </span>
                <span className="text-xs text-muted-foreground">Autonome & Live</span>
              </div>
              <h3 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" /> Canvas Studio
              </h3>
              <p className="text-xs text-muted-foreground">
                Modifiez en direct les textes, boutons, badges, jauges et overlays de n'importe quelle page de l'application sans recompiler ni passer par Lovable.
              </p>
            </div>
            <Button asChild size="default" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2 shadow-lg">
              <Link to="/admin/canvas">
                Ouvrir le Studio <ExternalLink className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Create card form */}
        <section>
          <h2 className="font-display text-lg mb-4 text-foreground">Créer une carte</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title FR */}
            <div className="space-y-2">
              <Label htmlFor="title">Titre 🇫🇷</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Dragon Ancestral"
                required
                className="bg-card border-border"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="title_en">Titre 🇬🇧</Label>
                <Input
                  id="title_en"
                  value={formData.title_en}
                  onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
                  placeholder="Ancestral Dragon"
                  className="bg-card border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title_es">Titre 🇪🇸</Label>
                <Input
                  id="title_es"
                  value={formData.title_es}
                  onChange={(e) => setFormData({ ...formData, title_es: e.target.value })}
                  placeholder="Dragón Ancestral"
                  className="bg-card border-border"
                />
              </div>
            </div>

            {/* Description FR */}
            <div className="space-y-2">
              <Label htmlFor="description">Description 🇫🇷</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Une courte description..."
                required
                className="bg-card border-border min-h-20"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="desc_en">Description 🇬🇧</Label>
                <Textarea
                  id="desc_en"
                  value={formData.description_en}
                  onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                  placeholder="A short description..."
                  className="bg-card border-border min-h-20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc_es">Description 🇪🇸</Label>
                <Textarea
                  id="desc_es"
                  value={formData.description_es}
                  onChange={(e) => setFormData({ ...formData, description_es: e.target.value })}
                  placeholder="Una breve descripción..."
                  className="bg-card border-border min-h-20"
                />
              </div>
            </div>

            {/* Image upload */}
            <div className="space-y-2">
              <Label>Image</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <div className="flex gap-2">
                <Input
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="URL de l'image ou uploadez"
                  className="bg-card border-border"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadImage.isPending}
                >
                  {uploadImage.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Preview */}
            {formData.image_url && (
              <div className="aspect-video rounded-xl overflow-hidden bg-card border border-border max-w-xs">
                <img 
                  src={formData.image_url} 
                  alt="Preview" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Image+invalide';
                  }}
                />
              </div>
            )}

            {/* Rarity */}
            <div className="space-y-2">
              <Label>Rareté</Label>
              <Select 
                value={formData.rarity} 
                onValueChange={(value: Rarity) => setFormData({ ...formData, rarity: value })}
              >
                <SelectTrigger className="bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RARITY_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <span style={{ color: config.color }}>{config.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Release Date */}
            <div className="space-y-2">
              <Label htmlFor="date">Date de sortie</Label>
              <Input
                id="date"
                type="date"
                value={formData.release_date}
                onChange={(e) => setFormData({ ...formData, release_date: e.target.value })}
                required
                className="bg-card border-border"
              />
            </div>

            <Button 
              type="submit" 
              variant="gold" 
              className="w-full"
              disabled={createCard.isPending}
            >
              {createCard.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Créer la carte
                </>
              )}
            </Button>
          </form>
        </section>

        {/* Give card to user */}
        <section>
          <h2 className="font-display text-lg mb-4 text-foreground flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Donner une carte
          </h2>
          <form onSubmit={handleGiveCard} className="space-y-4">
            <div className="space-y-2">
              <Label>Utilisateur</Label>
              <Select 
                value={giveFormData.userId} 
                onValueChange={(value) => setGiveFormData({ ...giveFormData, userId: value })}
              >
                <SelectTrigger className="bg-card border-border">
                  <SelectValue placeholder="Sélectionner un utilisateur" />
                </SelectTrigger>
                <SelectContent>
                  {profilesLoading ? (
                    <div className="flex justify-center py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  ) : profiles.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-2">Aucun utilisateur</div>
                  ) : (
                    profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.email}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Carte à donner</Label>
              <Select 
                value={giveFormData.cardId} 
                onValueChange={(value) => setGiveFormData({ ...giveFormData, cardId: value })}
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

            <Button 
              type="submit" 
              variant="mystical" 
              className="w-full"
              disabled={giveCard.isPending}
            >
              {giveCard.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Gift className="w-4 h-4" />
                  Donner la carte
                </>
              )}
            </Button>
          </form>
        </section>

        {/* Pack Probabilities Manager */}
        <PackProbabilitiesManager />

        {/* Reward Codes Manager */}
        <RewardCodesManager />

        {/* Winstreak Rewards Manager */}
        <WinstreakRewardsManager />

        {/* Canvas Studio — page dédiée */}
        <section className="bg-card border border-primary/30 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-base">Canvas Studio</h2>
              <p className="text-xs text-muted-foreground">Editez visuellement chaque page de l'app — GIFs, titres, boutons, fonds</p>
            </div>
          </div>
          <Button asChild className="shrink-0 gap-2">
            <Link to="/admin/canvas">
              <ExternalLink className="w-4 h-4" />
              Ouvrir le Studio
            </Link>
          </Button>
        </section>

        {/* User Account Manager */}
        <UserAccountManager />

        {/* Moderator Tools */}
        <ModeratorTools />

        <BoostersManager />


        <section>
          <h2 className="font-display text-lg mb-4 text-foreground">
            Cartes existantes ({cards.length})
          </h2>
          
          {cardsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : cards.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucune carte créée</p>
          ) : (
            <div className="space-y-3">
              {cards.map((card) => {
                const rarityConfig = RARITY_CONFIG[card.rarity as Rarity];
                return (
                  <div 
                    key={card.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border"
                  >
                    <img 
                      src={card.image_url} 
                      alt={card.title}
                      className="w-12 h-16 object-cover rounded-lg"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-display text-sm truncate">{card.title}</h4>
                      <span 
                        className={cn(
                          "inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase",
                          rarityConfig.bgClass
                        )}
                        style={{ color: card.rarity === 'legendary' ? 'hsl(240, 20%, 6%)' : 'white' }}
                      >
                        {rarityConfig.label}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditCard(card)}
                      className="text-primary hover:text-primary hover:bg-primary/10"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(card.id, card.title)}
                      disabled={deleteCard.isPending}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Edit Card Dialog */}
      <Dialog open={!!editingCard} onOpenChange={() => setEditingCard(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier la carte</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Title FR */}
            <div className="space-y-2">
              <Label htmlFor="edit-title">Titre 🇫🇷</Label>
              <Input
                id="edit-title"
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                className="bg-card border-border"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="edit-title-en">Titre 🇬🇧</Label>
                <Input
                  id="edit-title-en"
                  value={editFormData.title_en}
                  onChange={(e) => setEditFormData({ ...editFormData, title_en: e.target.value })}
                  className="bg-card border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-title-es">Titre 🇪🇸</Label>
                <Input
                  id="edit-title-es"
                  value={editFormData.title_es}
                  onChange={(e) => setEditFormData({ ...editFormData, title_es: e.target.value })}
                  className="bg-card border-border"
                />
              </div>
            </div>

            {/* Description FR */}
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description 🇫🇷</Label>
              <Textarea
                id="edit-description"
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                className="bg-card border-border min-h-20"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="edit-desc-en">Description 🇬🇧</Label>
                <Textarea
                  id="edit-desc-en"
                  value={editFormData.description_en}
                  onChange={(e) => setEditFormData({ ...editFormData, description_en: e.target.value })}
                  className="bg-card border-border min-h-20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-desc-es">Description 🇪🇸</Label>
                <Textarea
                  id="edit-desc-es"
                  value={editFormData.description_es}
                  onChange={(e) => setEditFormData({ ...editFormData, description_es: e.target.value })}
                  className="bg-card border-border min-h-20"
                />
              </div>
            </div>

            {/* Image upload */}
            <div className="space-y-2">
              <Label>Image</Label>
              <input
                ref={editFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleEditImageUpload}
                className="hidden"
              />
              <div className="flex gap-2">
                <Input
                  value={editFormData.image_url}
                  onChange={(e) => setEditFormData({ ...editFormData, image_url: e.target.value })}
                  placeholder="URL de l'image"
                  className="bg-card border-border"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon"
                  onClick={() => editFileInputRef.current?.click()}
                  disabled={uploadImage.isPending}
                >
                  {uploadImage.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Preview */}
            {editFormData.image_url && (
              <div className="aspect-video rounded-xl overflow-hidden bg-card border border-border max-w-xs mx-auto">
                <img 
                  src={editFormData.image_url} 
                  alt="Preview" 
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Rarity */}
            <div className="space-y-2">
              <Label>Rareté</Label>
              <Select 
                value={editFormData.rarity} 
                onValueChange={(value: Rarity) => setEditFormData({ ...editFormData, rarity: value })}
              >
                <SelectTrigger className="bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RARITY_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <span style={{ color: config.color }}>{config.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Release Date */}
            <div className="space-y-2">
              <Label htmlFor="edit-date">Date de sortie</Label>
              <Input
                id="edit-date"
                type="date"
                value={editFormData.release_date}
                onChange={(e) => setEditFormData({ ...editFormData, release_date: e.target.value })}
                className="bg-card border-border"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingCard(null)}>
              Annuler
            </Button>
            <Button
              variant="gold"
              onClick={handleUpdateCard}
              disabled={updateCard.isPending}
            >
              {updateCard.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Enregistrer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Navigation />
    </div>
  );
};

export default Admin;
