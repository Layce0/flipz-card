import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Eye, EyeOff, Check, X } from 'lucide-react';
import { toast } from 'sonner';
const flipzLogo = `${import.meta.env.BASE_URL}flipz-logo-new.png`;

const passwordRules = [
  { key: 'minLength', test: (p: string) => p.length >= 8, label: '8 caractères minimum' },
  { key: 'uppercase', test: (p: string) => /[A-Z]/.test(p), label: '1 majuscule' },
  { key: 'lowercase', test: (p: string) => /[a-z]/.test(p), label: '1 minuscule' },
  { key: 'number', test: (p: string) => /[0-9]/.test(p), label: '1 chiffre' },
  { key: 'special', test: (p: string) => /[^A-Za-z0-9]/.test(p), label: '1 caractère spécial' },
];

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();

  const passwordChecks = passwordRules.map(r => ({ ...r, pass: r.test(password) }));
  const allPasswordValid = passwordChecks.every(c => c.pass);

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    // Also check URL hash for recovery type
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!allPasswordValid) {
      toast.error('Le mot de passe ne respecte pas tous les critères.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Mot de passe mis à jour avec succès !');
        navigate('/');
      }
    } catch {
      toast.error('Une erreur est survenue.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <img src={flipzLogo} alt="FLIPZ" className="w-40 mx-auto rounded-2xl" />
          <p className="text-muted-foreground text-sm">
            Vérification du lien de réinitialisation...
          </p>
          <p className="text-xs text-muted-foreground">
            Si rien ne se passe, le lien est peut-être expiré.{' '}
            <button onClick={() => navigate('/auth')} className="text-primary underline">
              Retour à la connexion
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src={flipzLogo} alt="FLIPZ" className="w-40 rounded-2xl" />
        </div>
        <h1 className="text-xl font-display text-center mb-2">Nouveau mot de passe</h1>
        <p className="text-muted-foreground text-sm text-center mb-6">
          Choisis un nouveau mot de passe sécurisé pour ton compte.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nouveau mot de passe</Label>
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
          </div>

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

          {password.length > 0 && (
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
            disabled={isLoading || !allPasswordValid || password !== confirmPassword}
          >
            {isLoading ? (
              <span className="animate-pulse">Mise à jour...</span>
            ) : (
              'Changer le mot de passe'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
