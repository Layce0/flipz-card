import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useUserCardStats } from '@/hooks/useCards';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { User, Settings, BarChart3, LogOut, Camera, Lock, Save, Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';

const LANGUAGES = [
  { code: 'fr', name: 'Français' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'pl', name: 'Polski' },
  { code: 'ru', name: 'Русский' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'zh', name: '中文' },
  { code: 'ar', name: 'العربية' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'sv', name: 'Svenska' },
  { code: 'da', name: 'Dansk' },
  { code: 'no', name: 'Norsk' },
  { code: 'fi', name: 'Suomi' },
  { code: 'cs', name: 'Čeština' },
  { code: 'el', name: 'Ελληνικά' },
];

interface ProfileData {
  username: string | null;
  avatar_url: string | null;
  language: string;
  notifications_enabled: boolean;
  visual_effects_enabled: boolean;
  theme: string;
}

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { data: cardStats = { total: 0, common: 0, rare: 0, epic: 0, legendary: 0 } } = useUserCardStats(user?.id);
  const [profile, setProfile] = useState<ProfileData>({
    username: '',
    avatar_url: null,
    language: 'fr',
    notifications_enabled: true,
    visual_effects_enabled: true,
    theme: 'dark',
  });
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchProfile();
  }, [user, navigate]);

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('username, avatar_url, language, notifications_enabled, visual_effects_enabled, theme')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
    } else if (data) {
      setProfile({
        username: data.username || '',
        avatar_url: data.avatar_url,
        language: data.language || 'fr',
        notifications_enabled: data.notifications_enabled ?? true,
        visual_effects_enabled: data.visual_effects_enabled ?? true,
        theme: data.theme || 'dark',
      });
    }
    setLoading(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('card-images')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error('Erreur lors du téléchargement de l\'avatar');
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('card-images')
      .getPublicUrl(filePath);

    setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
    toast.success('Avatar mis à jour !');
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        username: profile.username,
        avatar_url: profile.avatar_url,
        language: profile.language,
        notifications_enabled: profile.notifications_enabled,
        visual_effects_enabled: profile.visual_effects_enabled,
        theme: profile.theme,
      })
      .eq('id', user.id);

    setSaving(false);

    if (error) {
      toast.error('Erreur lors de la sauvegarde');
    } else {
      toast.success('Profil sauvegardé !');
    }
  };

  const changePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    if (passwords.new.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setChangingPassword(true);

    const { error } = await supabase.auth.updateUser({
      password: passwords.new,
    });

    setChangingPassword(false);

    if (error) {
      toast.error('Erreur lors du changement de mot de passe');
    } else {
      toast.success('Mot de passe modifié !');
      setPasswords({ current: '', new: '', confirm: '' });
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'from-amber-400 to-yellow-600';
      case 'epic': return 'from-purple-400 to-purple-600';
      case 'rare': return 'from-blue-400 to-blue-600';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  const getRarityLabel = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'Légendaire';
      case 'epic': return 'Épique';
      case 'rare': return 'Rare';
      default: return 'Commun';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="relative inline-block">
            <Avatar className="w-24 h-24 border-4 border-primary/20">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                {profile.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <label className="absolute bottom-0 right-0 p-2 bg-primary rounded-full cursor-pointer hover:bg-primary/90 transition-colors">
              <Camera className="w-4 h-4 text-primary-foreground" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </label>
          </div>
          <h1 className="text-xl font-bold mt-3 text-foreground">
            {profile.username || user?.email?.split('@')[0] || 'Joueur'}
          </h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="profile" className="flex items-center gap-1.5">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Profil</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Stats</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1.5">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Paramètres</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informations</CardTitle>
                <CardDescription>Modifiez vos informations personnelles</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Pseudo</Label>
                  <Input
                    id="username"
                    value={profile.username || ''}
                    onChange={(e) => setProfile(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Votre pseudo"
                  />
                </div>
                <Button onClick={saveProfile} disabled={saving} className="w-full">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Mot de passe
                </CardTitle>
                <CardDescription>Changez votre mot de passe</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nouveau mot de passe</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={passwords.new}
                    onChange={(e) => setPasswords(prev => ({ ...prev, new: e.target.value }))}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords(prev => ({ ...prev, confirm: e.target.value }))}
                    placeholder="••••••••"
                  />
                </div>
                <Button 
                  onClick={changePassword} 
                  disabled={changingPassword || !passwords.new || !passwords.confirm}
                  variant="outline"
                  className="w-full"
                >
                  {changingPassword ? 'Modification...' : 'Changer le mot de passe'}
                </Button>
              </CardContent>
            </Card>

            <Button onClick={handleLogout} variant="destructive" className="w-full">
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Collection</CardTitle>
                <CardDescription>Votre progression dans la collection</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-6">
                  <span className="text-4xl font-bold text-primary">{cardStats.total}</span>
                  <p className="text-sm text-muted-foreground">cartes possédées</p>
                </div>

                <div className="space-y-4">
                  {(['legendary', 'epic', 'rare', 'common'] as const).map((rarity) => (
                    <div key={rarity} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className={`font-medium bg-gradient-to-r ${getRarityColor(rarity)} bg-clip-text text-transparent`}>
                          {getRarityLabel(rarity)}
                        </span>
                        <span className="text-muted-foreground">{cardStats[rarity]}</span>
                      </div>
                      <Progress 
                        value={cardStats.total > 0 ? (cardStats[rarity] / cardStats.total) * 100 : 0} 
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Préférences</CardTitle>
                <CardDescription>Personnalisez votre expérience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Language */}
                <div className="space-y-2">
                  <Label>Langue</Label>
                  <Select
                    value={profile.language}
                    onValueChange={(value) => setProfile(prev => ({ ...prev, language: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Theme */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Thème</Label>
                    <p className="text-sm text-muted-foreground">
                      {profile.theme === 'dark' ? 'Sombre' : 'Clair'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setProfile(prev => ({ 
                      ...prev, 
                      theme: prev.theme === 'dark' ? 'light' : 'dark' 
                    }))}
                  >
                    {profile.theme === 'dark' ? (
                      <Moon className="w-4 h-4" />
                    ) : (
                      <Sun className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                {/* Notifications */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Recevoir des notifications
                    </p>
                  </div>
                  <Switch
                    checked={profile.notifications_enabled}
                    onCheckedChange={(checked) => 
                      setProfile(prev => ({ ...prev, notifications_enabled: checked }))
                    }
                  />
                </div>

                {/* Visual Effects */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Effets visuels</Label>
                    <p className="text-sm text-muted-foreground">
                      Animations et effets
                    </p>
                  </div>
                  <Switch
                    checked={profile.visual_effects_enabled}
                    onCheckedChange={(checked) => 
                      setProfile(prev => ({ ...prev, visual_effects_enabled: checked }))
                    }
                  />
                </div>

                <Button onClick={saveProfile} disabled={saving} className="w-full">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Sauvegarde...' : 'Sauvegarder les paramètres'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <Navigation />
    </div>
  );
};

export default Profile;
