import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, LogIn, UserPlus, Eye, EyeOff, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
const Lottie = lazy(() => import('lottie-react'));
const flipzLogo = '/flipz-logo-new.png';
import { ForgotPasswordDialog } from '@/components/ForgotPasswordDialog';

const passwordRules = [
  { key: 'minLength', test: (p: string) => p.length >= 8, label: '8 caractères minimum' },
  { key: 'uppercase', test: (p: string) => /[A-Z]/.test(p), label: '1 majuscule' },
  { key: 'lowercase', test: (p: string) => /[a-z]/.test(p), label: '1 minuscule' },
  { key: 'number', test: (p: string) => /[0-9]/.test(p), label: '1 chiffre' },
  { key: 'special', test: (p: string) => /[^A-Za-z0-9]/.test(p), label: '1 caractère spécial' },
];

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 120;

const Auth = () => {
  const [catData, setCatData] = useState<any>(null);

  useEffect(() => {
    import('@/assets/lottie-cat.json').then(m => setCatData(m.default));
  }, []);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
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

  // Lockout countdown timer
  useEffect(() => {
    if (!lockoutUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLockoutUntil(null);
        setFailedAttempts(0);
        setLockoutRemaining(0);
        clearInterval(interval);
      } else {
        setLockoutRemaining(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLockedOut) {
      toast.error(`Trop de tentatives. Réessayez dans ${lockoutRemaining}s.`);
      return;
    }

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
          const newAttempts = failedAttempts + 1;
          setFailedAttempts(newAttempts);
          
          if (newAttempts >= MAX_ATTEMPTS) {
            setLockoutUntil(Date.now() + LOCKOUT_SECONDS * 1000);
            setLockoutRemaining(LOCKOUT_SECONDS);
            toast.error(`Compte temporairement bloqué après ${MAX_ATTEMPTS} tentatives échouées. Réessayez dans ${LOCKOUT_SECONDS}s.`);
          } else {
            const remaining = MAX_ATTEMPTS - newAttempts;
            if (error.message.includes('Invalid login credentials')) {
              toast.error(`${t('auth.invalidCredentials')} (${remaining} essai${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''})`);
            } else {
              toast.error(`${error.message} (${remaining} essai${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''})`);
            }
          }
        } else {
          setFailedAttempts(0);
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
            <img src={flipzLogo} alt="FLIPZ" className="w-full rounded-2xl relative z-10" width={1257} height={510} fetchPriority="high" />
          </div>
          {catData && (
            <div className="w-20 h-20 sm:w-24 sm:h-24 mt-2">
              <Suspense fallback={null}>
                <Lottie animationData={catData} loop />
              </Suspense>
            </div>
          )}
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

          {/* Forgot password link - login only */}
          {isLogin && (
            <div className="text-right -mt-1">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Mot de passe oublié ?
              </button>
            </div>
          )}

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

          {/* Lockout warning */}
          {isLockedOut && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-center">
              <p className="text-sm text-destructive font-medium">
                🔒 Compte bloqué — réessayez dans {lockoutRemaining}s
              </p>
            </div>
          )}

          {/* Remaining attempts warning */}
          {!isLockedOut && isLogin && failedAttempts > 0 && failedAttempts < MAX_ATTEMPTS && (
            <p className="text-xs text-destructive text-center">
              ⚠️ {MAX_ATTEMPTS - failedAttempts} essai{MAX_ATTEMPTS - failedAttempts > 1 ? 's' : ''} restant{MAX_ATTEMPTS - failedAttempts > 1 ? 's' : ''}
            </p>
          )}

          <Button
            type="submit"
            variant="gold"
            className="w-full"
            disabled={isLoading || isLockedOut || (!isLogin && (!allPasswordValid || password !== confirmPassword) && password.length > 0)}
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

      <ForgotPasswordDialog open={showForgotPassword} onOpenChange={setShowForgotPassword} />
    </div>
  );
};

export default Auth;
