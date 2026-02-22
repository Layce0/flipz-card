import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, LogIn, UserPlus, Eye, EyeOff, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import Lottie from 'lottie-react';
import flipzLogo from '@/assets/flipz-logo-new.jpeg';
import catAnimation from '@/assets/lottie-cat.json';

const passwordRules = [
  { key: 'minLength', test: (p: string) => p.length >= 8, label: '8 caractères minimum' },
  { key: 'uppercase', test: (p: string) => /[A-Z]/.test(p), label: '1 majuscule' },
  { key: 'lowercase', test: (p: string) => /[a-z]/.test(p), label: '1 minuscule' },
  { key: 'number', test: (p: string) => /[0-9]/.test(p), label: '1 chiffre' },
  { key: 'special', test: (p: string) => /[^A-Za-z0-9]/.test(p), label: '1 caractère spécial' },
];

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const authSchema = z.object({
    email: z.string().email(t('auth.invalidEmail')),
    password: z.string().min(6, t('auth.passwordTooShort')),
  });

  const passwordChecks = useMemo(() =>
    passwordRules.map(r => ({ ...r, pass: r.test(password) })),
    [password]
  );
  const allPasswordValid = passwordChecks.every(c => c.pass);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const validation = authSchema.safeParse({ email, password });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      setIsLoading(false);
      return;
    }

    if (!isLogin && !allPasswordValid) {
      toast.error('Le mot de passe ne respecte pas tous les critères de sécurité.');
      setIsLoading(false);
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas.');
      setIsLoading(false);
      return;
    }

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error(t('auth.invalidCredentials'));
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success(t('auth.loginSuccess'));
          navigate('/');
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error(t('auth.emailAlreadyUsed'));
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success(t('auth.signupSuccess'));
          navigate('/');
        }
      }
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header with logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative w-full">
            <div className="absolute -inset-4 bg-gradient-radial from-primary/30 via-primary/10 to-transparent blur-xl rounded-full" />
            <img src={flipzLogo} alt="FLIPZ" className="w-full rounded-2xl relative z-10" />
          </div>
          <div className="w-20 h-20 sm:w-24 sm:h-24 mt-2">
            <Lottie animationData={catAnimation} loop />
          </div>
        </div>
        <div className="text-center mb-6">
          <p className="text-muted-foreground text-sm">
            {isLogin ? t('auth.loginSubtitle') : t('auth.signupSubtitle')}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                className="bg-card border-border pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-card border-border pl-10 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
          </div>

          {/* Confirm password - signup only */}
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-card border-border pl-10"
                  required
                />
              </div>
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <X className="w-3.5 h-3.5" /> Les mots de passe ne correspondent pas
                </p>
              )}
            </div>
          )}
          </div>

          {/* Password strength indicator - signup only */}
          {!isLogin && password.length > 0 && (
            <div className="space-y-1.5 p-3 rounded-lg bg-card/60 border border-border">
              {passwordChecks.map(c => (
                <div key={c.key} className="flex items-center gap-2 text-xs">
                  {c.pass ? (
                    <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-destructive shrink-0" />
                  )}
                  <span className={c.pass ? 'text-green-500' : 'text-muted-foreground'}>
                    {c.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          <Button
            type="submit"
            variant="gold"
            className="w-full"
            disabled={isLoading || (!isLogin && (!allPasswordValid || password !== confirmPassword) && password.length > 0)}
          >
            {isLoading ? (
              <span className="animate-pulse">{t('common.loading')}</span>
            ) : isLogin ? (
              <>
                <LogIn className="w-4 h-4" />
                {t('auth.loginButton')}
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                {t('auth.signupButton')}
              </>
            )}
          </Button>
        </form>

        {/* Toggle */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-primary/80 hover:text-primary font-bold underline underline-offset-4 transition-colors"
          >
            {isLogin ? t('auth.noAccount') : t('auth.hasAccount')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
