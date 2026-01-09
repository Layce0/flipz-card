import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Plus, Image, Trash2, Upload, Loader2, Gift } from 'lucide-react';
import { Rarity, RARITY_CONFIG } from '@/types/card';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useAllCards, useCreateCard, useDeleteCard, useUploadCardImage, useGiveCard, useAllProfiles } from '@/hooks/useCards';
import { cn } from '@/lib/utils';

const Admin = () => {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: cards = [], isLoading: cardsLoading } = useAllCards();
  const { data: profiles = [], isLoading: profilesLoading } = useAllProfiles();
  const createCard = useCreateCard();
  const deleteCard = useDeleteCard();
  const uploadImage = useUploadCardImage();
  const giveCard = useGiveCard();

  const [giveFormData, setGiveFormData] = useState({
    userId: '',
    cardId: '',
  });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    rarity: 'common' as Rarity,
    release_date: new Date().toISOString().split('T')[0],
  });

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
        description: '',
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
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-xl text-foreground">Espace Admin</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>
      </header>

      <main className="px-4 space-y-8">
        {/* Create card form */}
        <section>
          <h2 className="font-display text-lg mb-4 text-foreground">Créer une carte</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Titre</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Dragon Ancestral"
                required
                className="bg-card border-border"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Une courte description..."
                required
                className="bg-card border-border min-h-20"
              />
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

        {/* Drop rates info */}
        <section>
          <h2 className="font-display text-lg mb-4 text-foreground">
            Taux d'obtention
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(RARITY_CONFIG).map(([key, config]) => (
              <div 
                key={key}
                className="p-4 rounded-xl bg-card border border-border"
              >
                <div className="flex items-center justify-between">
                  <span 
                    className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-semibold uppercase",
                      config.bgClass
                    )}
                    style={{ color: key === 'legendary' ? 'hsl(240, 20%, 6%)' : 'white' }}
                  >
                    {config.label}
                  </span>
                  <span className="text-xl font-bold text-foreground">{config.dropRate}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Card list */}
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

      <Navigation />
    </div>
  );
};

export default Admin;
