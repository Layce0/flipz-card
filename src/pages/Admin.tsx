import { useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Plus, Image, Lock } from 'lucide-react';
import { Rarity, RARITY_CONFIG } from '@/types/card';
import { toast } from 'sonner';

const Admin = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    rarity: 'common' as Rarity,
    release_date: new Date().toISOString().split('T')[0],
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement proper auth
    if (password === 'admin123') {
      setIsAuthenticated(true);
      toast.success('Connecté en tant que modérateur');
    } else {
      toast.error('Mot de passe incorrect');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Save to DB
    console.log('Creating card:', formData);
    toast.success('Carte créée avec succès !');
    setFormData({
      title: '',
      description: '',
      image_url: '',
      rarity: 'common',
      release_date: new Date().toISOString().split('T')[0],
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pb-24 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h1 className="font-display text-2xl text-foreground mb-2">Espace Modérateur</h1>
            <p className="text-muted-foreground text-sm">Connectez-vous pour créer des cartes</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Entrez le mot de passe"
                className="bg-card border-border"
              />
            </div>
            <Button type="submit" variant="gold" className="w-full">
              <Shield className="w-4 h-4" />
              Se connecter
            </Button>
          </form>
        </div>
        <Navigation />
      </div>
    );
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
            <h1 className="font-display text-xl text-foreground">Créer une Carte</h1>
            <p className="text-sm text-muted-foreground">Espace modérateur</p>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="px-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Titre de la carte</Label>
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
              placeholder="Une courte description mystérieuse..."
              required
              className="bg-card border-border min-h-24"
            />
          </div>

          {/* Image URL */}
          <div className="space-y-2">
            <Label htmlFor="image">URL de l'image</Label>
            <div className="flex gap-2">
              <Input
                id="image"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                placeholder="https://..."
                required
                className="bg-card border-border"
              />
              <Button type="button" variant="outline" size="icon">
                <Image className="w-4 h-4" />
              </Button>
            </div>
          </div>

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

          {/* Preview */}
          {formData.image_url && (
            <div className="space-y-2">
              <Label>Aperçu</Label>
              <div className="aspect-video rounded-xl overflow-hidden bg-card border border-border">
                <img 
                  src={formData.image_url} 
                  alt="Preview" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Image+invalide';
                  }}
                />
              </div>
            </div>
          )}

          {/* Submit */}
          <Button type="submit" variant="gold" size="lg" className="w-full">
            <Plus className="w-5 h-5" />
            Créer la carte
          </Button>
        </form>
      </main>

      <Navigation />
    </div>
  );
};

export default Admin;
