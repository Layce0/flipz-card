import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { User, Settings, BarChart3, LogOut, Camera, Lock, Save } from 'lucide-react';
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
}

const Profile = () => {
  const { user, signOut } = useAuth();
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('card-images')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error(t('profile.avatarError'));
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('card-images')
      .getPublicUrl(filePath);

    setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
    toast.success(t('profile.avatarSuccess'));
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
      // Save language to localStorage before reload
      localStorage.setItem('app-language', profile.language);
      
      if (languageChanged) {
        // Reload the app to apply language change globally
        window.location.reload();
      } else {
        toast.success(t('profile.saveSuccess'));
      }
    }
  };

  const changePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      toast.error(t('profile.password.mismatch'));
      return;
    }

    if (passwords.new.length < 6) {
      toast.error(t('profile.password.tooShort'));
      return;
    }

    setChangingPassword(true);

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
              <span className="hidden sm:inline">{t('profile.tabs.profile')}</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">{t('profile.tabs.stats')}</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1.5">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">{t('profile.tabs.settings')}</span>
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

          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('stats.title')}</CardTitle>
                <CardDescription>{t('stats.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-6">
                  <span className="text-4xl font-bold text-primary">{cardStats.total}</span>
                  <p className="text-sm text-muted-foreground">{t('stats.cardsOwned')}</p>
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

                <Button onClick={saveProfile} disabled={saving} className="w-full">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? t('common.saving') : t('settings.saveSettings')}
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
