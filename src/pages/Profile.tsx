import { useState, useEffect, useRef } from 'react';
import { useSfx } from '@/hooks/useSfx';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useUserCardStats } from '@/hooks/useCards';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { User, Settings, BarChart3, LogOut, Camera as CameraIcon, Lock, Save, GraduationCap, Info, FileText, AlertTriangle, Volume2, VolumeX, Shield, Package, Users } from 'lucide-react';
import { ProfileInventory } from '@/components/inventory/ProfileInventory';
import { ProfileFriends } from '@/components/inventory/ProfileFriends';
import { toast } from 'sonner';

const LANGUAGES = [
  { code: 'fr', name: 'Français' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
];

interface ProfileData {
  username: string | null;
  avatar_url: string | null;
  language: string;
}

const Profile = () => {
  const { user, signOut, isAdmin, isModerator } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { data: cardStats = { total: 0, common: 0, rare: 0, epic: 0, legendary: 0 } } = useUserCardStats(user?.id);
  const [profile, setProfile] = useState<ProfileData>({
    username: '',
    avatar_url: null,
    language: 'fr',
  });
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toggleMute, getMuted, play } = useSfx();
  const [sfxMuted, setSfxMuted] = useState(() => getMuted());
  const [sfxVolume, setSfxVolume] = useState<number>(() => {
    try { return parseFloat(localStorage.getItem('flipz_sfx_volume') || '1'); } catch { return 1; }
  });
  const [hideAdmin, setHideAdmin] = useState(() => localStorage.getItem('flipz_hide_admin') === 'true');

  const handleToggleAdmin = () => {
    const next = !hideAdmin;
    setHideAdmin(next);
    localStorage.setItem('flipz_hide_admin', String(next));
    window.dispatchEvent(new CustomEvent('flipz:admin-visibility-changed'));
  };

  const handleToggleMute = () => {
    const next = toggleMute();
    setSfxMuted(next);
    if (!next) play('navClick', sfxVolume);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setSfxVolume(v);
    try { localStorage.setItem('flipz_sfx_volume', String(v)); } catch {}
    if (!sfxMuted) play('navClick', v);
  };

  /** Convert a data-URL to a File for Supabase upload */
  const dataUrlToFile = (dataUrl: string, filename: string): File => {
    const [header, base64] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], filename, { type: mime });
  };

  /** Upload a File to Supabase and update avatar_url state */
  const uploadAvatarFile = async (file: File) => {
    if (!user) return;
    const fileExt = file.name.split('.').pop() || 'jpg';
    const filePath = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error(t('profile.avatarError'));
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
    toast.success(t('profile.avatarSuccess'));
  };

  /** Tapping the camera icon — use native Camera plugin on iOS/Android */
  const handleAvatarPick = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const photo = await CapCamera.getPhoto({
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Prompt,
          quality: 80,
          width: 512,
          height: 512,
          allowEditing: true,
        });
        if (photo.dataUrl) {
          const file = dataUrlToFile(photo.dataUrl, 'avatar.jpg');
          await uploadAvatarFile(file);
        }
      } catch (err: any) {
        // User cancelled — ignore
        if (err?.message?.includes('cancel') || err?.message?.includes('Cancel')) return;
        console.error('Camera error:', err);
        toast.error(t('profile.avatarError'));
      }
    } else {
      // Web fallback: trigger the hidden file input
      fileInputRef.current?.click();
    }
  };

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
      .select('username, avatar_url, language')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
    } else if (data) {
      const lang = data.language || 'fr';
      setProfile({
        username: data.username || '',
        avatar_url: data.avatar_url,
        language: lang,
      });
      // Apply saved language
      i18n.changeLanguage(lang);
    }
    setLoading(false);
  };

  /** Web fallback: handle file input change */
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadAvatarFile(file);
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);

    const previousLanguage = i18n.language;
    const languageChanged = previousLanguage !== profile.language;

    const { error } = await supabase
      .from('profiles')
      .update({
        username: profile.username,
        avatar_url: profile.avatar_url,
        language: profile.language,
      })
      .eq('id', user.id);

    setSaving(false);

    if (error) {
      toast.error(t('profile.saveError'));
    } else {
      // Save language to localStorage and apply via i18n (no reload needed)
      localStorage.setItem('app-language', profile.language);
      
      if (languageChanged) {
        const { default: i18n } = await import('@/i18n');
        await i18n.changeLanguage(profile.language);
      }
      toast.success(t('profile.saveSuccess'));
    }
  };

  const changePassword = async () => {
    if (!passwords.current) {
      toast.error(t('profile.password.currentRequired', 'Current password is required'));
      return;
    }

    if (passwords.new !== passwords.confirm) {
      toast.error(t('profile.password.mismatch'));
      return;
    }

    if (passwords.new.length < 6) {
      toast.error(t('profile.password.tooShort'));
      return;
    }

    setChangingPassword(true);

    // Verify current password by re-authenticating
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user!.email!,
      password: passwords.current,
    });

    if (signInError) {
      setChangingPassword(false);
      toast.error(t('profile.password.currentIncorrect', 'Current password is incorrect'));
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: passwords.new,
    });

    setChangingPassword(false);

    if (error) {
      toast.error(t('profile.password.error'));
    } else {
      toast.success(t('profile.password.success'));
      setPasswords({ current: '', new: '', confirm: '' });
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-user-account', {
        body: { action: 'delete_self' }
      });
      if (error || data?.error) {
        toast.error(t('profile.deleteError', 'Erreur lors de la suppression du compte.'));
      } else {
        toast.success(t('profile.deleteSuccess', 'Votre compte a été supprimé.'));
        await signOut();
        navigate('/');
      }
    } catch (err) {
      toast.error(t('profile.deleteError', 'Erreur lors de la suppression du compte.'));
    } finally {
      setDeletingAccount(false);
    }
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
    return t(`rarity.${rarity}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container max-w-xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="relative inline-block">
            <Avatar className="w-24 h-24 border-4 border-primary/20">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                {profile.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <button type="button" onClick={handleAvatarPick} className="absolute bottom-0 right-0 p-2 bg-primary rounded-full cursor-pointer hover:bg-primary/90 transition-colors">
              <CameraIcon className="w-4 h-4 text-primary-foreground" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <h1 className="text-xl font-bold mt-3 text-foreground">
            {profile.username || user?.email?.split('@')[0] || 'Joueur'}
          </h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-4 p-1 h-auto bg-muted/60">
            <TabsTrigger value="profile" className="flex items-center justify-center gap-1 py-2 text-xs">
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('profile.tabs.profile', 'Profil')}</span>
            </TabsTrigger>
            <TabsTrigger value="inventory" className="flex items-center justify-center gap-1 py-2 text-xs">
              <Package className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Inventaire</span>
            </TabsTrigger>
            <TabsTrigger value="friends" className="flex items-center justify-center gap-1 py-2 text-xs">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Amis</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center justify-center gap-1 py-2 text-xs">
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('profile.tabs.stats', 'Stats')}</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center justify-center gap-1 py-2 text-xs">
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('profile.tabs.settings', 'Options')}</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('profile.info.title')}</CardTitle>
                <CardDescription>{t('profile.info.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">{t('profile.info.username')}</Label>
                  <Input
                    id="username"
                    value={profile.username || ''}
                    onChange={(e) => setProfile(prev => ({ ...prev, username: e.target.value }))}
                    placeholder={t('profile.info.usernamePlaceholder')}
                  />
                </div>
                <Button onClick={saveProfile} disabled={saving} className="w-full">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? t('common.saving') : t('common.save')}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  {t('profile.password.title')}
                </CardTitle>
                <CardDescription>{t('profile.password.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">{t('profile.password.current', 'Current password')}</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={passwords.current}
                    onChange={(e) => setPasswords(prev => ({ ...prev, current: e.target.value }))}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">{t('profile.password.new')}</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={passwords.new}
                    onChange={(e) => setPasswords(prev => ({ ...prev, new: e.target.value }))}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">{t('profile.password.confirm')}</Label>
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
                  {changingPassword ? t('profile.password.changing') : t('profile.password.change')}
                </Button>
              </CardContent>
            </Card>

            <Button onClick={handleLogout} variant="destructive" className="w-full">
              <LogOut className="w-4 h-4 mr-2" />
              {t('profile.logout')}
            </Button>
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="space-y-4">
            <ProfileInventory />
          </TabsContent>

          {/* Friends Tab */}
          <TabsContent value="friends" className="space-y-4">
            <ProfileFriends />
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('stats.title')}</CardTitle>
                <CardDescription>{t('stats.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-6">
                  <span className="text-4xl font-bold text-primary">{cardStats.total.toLocaleString()}</span>
                  <p className="text-sm text-muted-foreground">{t('stats.cardsOwned')}</p>
                </div>

                <div className="space-y-4">
                  {(['legendary', 'epic', 'rare', 'common'] as const).map((rarity) => (
                    <div key={rarity} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className={`font-medium bg-gradient-to-r ${getRarityColor(rarity)} bg-clip-text text-transparent`}>
                          {getRarityLabel(rarity)}
                        </span>
                        <span className="text-muted-foreground">{cardStats[rarity].toLocaleString()}</span>
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
                <CardTitle className="text-lg">{t('settings.title')}</CardTitle>
                <CardDescription>{t('settings.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Language */}
                <div className="space-y-2">
                  <Label>{t('settings.language')}</Label>
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

                {/* SFX */}
                <div className="space-y-3">
                  <Label>Effets sonores (SFX)</Label>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50">
                    <div className="flex items-center gap-3">
                      {sfxMuted
                        ? <VolumeX className="w-5 h-5 text-muted-foreground" />
                        : <Volume2 className="w-5 h-5 text-primary" />
                      }
                      <div>
                        <p className="text-sm font-medium">{sfxMuted ? 'Sons désactivés' : 'Sons activés'}</p>
                        <p className="text-xs text-muted-foreground">Effets sonores en jeu</p>
                      </div>
                    </div>
                    <button
                      id="sfx-toggle"
                      onClick={handleToggleMute}
                      className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        sfxMuted ? 'bg-muted-foreground/30' : 'bg-primary'
                      }`}
                      aria-label="Toggle SFX"
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                        sfxMuted ? 'translate-x-0' : 'translate-x-6'
                      }`} />
                    </button>
                  </div>

                  {!sfxMuted && (
                    <div className="flex items-center gap-3 px-1">
                      <VolumeX className="w-4 h-4 text-muted-foreground shrink-0" />
                      <input
                        id="sfx-volume"
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={sfxVolume}
                        onChange={handleVolumeChange}
                        className="flex-1 h-2 rounded-full accent-primary cursor-pointer"
                        aria-label="Volume SFX"
                      />
                      <Volume2 className="w-4 h-4 text-primary shrink-0" />
                    </div>
                  )}
                </div>

                {/* Replay tutorial */}
                <div className="space-y-2">
                  <Label>{t('settings.tutorial', 'Tutoriel')}</Label>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      localStorage.removeItem('flipz_onboarding_done');
                      navigate('/');
                      setTimeout(() => window.dispatchEvent(new CustomEvent('flipz:replay-tutorial')), 100);
                    }}
                  >
                    <GraduationCap className="w-4 h-4 mr-2" />
                    {t('settings.replayTutorial', 'Revoir le tutoriel')}
                  </Button>
                </div>

                {(isAdmin || isModerator) && (
                  <div className="space-y-2">
                    <Label>Onglet Modérateur / Admin</Label>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50">
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{hideAdmin ? 'Onglet masqué' : 'Onglet visible'}</p>
                          <p className="text-xs text-muted-foreground">Afficher ou masquer l'onglet modérateur dans la barre de navigation</p>
                        </div>
                      </div>
                      <button
                        onClick={handleToggleAdmin}
                        className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          hideAdmin ? 'bg-muted-foreground/30' : 'bg-primary'
                        }`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                          hideAdmin ? 'translate-x-0' : 'translate-x-6'
                        }`} />
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>{t('settings.privacy', 'Légal')}</Label>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      // Ouvrir la politique de confidentialité
                      window.open('https://layce0.github.io/flipz-app/#privacy', '_blank');
                    }}
                  >
                    <Info className="w-4 h-4 mr-2" />
                    {t('settings.privacyPolicy', 'Politique de confidentialité')}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      // Ouvrir les conditions d'utilisation
                      window.open('https://layce0.github.io/flipz-app/#terms', '_blank');
                    }}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    {t('settings.terms', 'Conditions d\'utilisation')}
                  </Button>
                </div>

                {/* Signaler une publicité */}
                <div className="space-y-2">
                  <Label>{t('settings.support', 'Support')}</Label>
                  <Button
                    variant="outline"
                    className="w-full text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                    onClick={() => {
                      window.open('mailto:wintak.group@gmail.com?subject=Signalement%20de%20publicit%C3%A9%20inappropri%C3%A9e', '_self');
                    }}
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    {t('settings.reportAd', 'Signaler une publicité inappropriée')}
                  </Button>
                </div>

                <Button onClick={saveProfile} disabled={saving} className="w-full">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? t('common.saving') : t('settings.saveSettings')}
                </Button>
                
                {/* Delete Account Section */}
                <div className="pt-6 mt-6 border-t border-border">
                  <h3 className="text-destructive font-semibold mb-2">{t('profile.dangerZone', 'Zone de danger')}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('profile.deleteWarning', 'Une fois votre compte supprimé, il n\'y a pas de retour en arrière possible. Soyez certain.')}
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full" disabled={deletingAccount}>
                        {deletingAccount ? t('common.loading', 'Chargement...') : t('profile.deleteAccount', 'Supprimer mon compte')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('profile.deleteConfirmTitle', 'Êtes-vous absolument sûr ?')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('profile.deleteConfirmDesc', 'Cette action ne peut pas être annulée. Cela supprimera définitivement votre compte et effacera vos données de nos serveurs.')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel', 'Annuler')}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          {t('profile.deleteAccount', 'Supprimer')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
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
