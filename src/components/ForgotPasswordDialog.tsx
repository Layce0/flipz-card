import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ForgotPasswordDialog = ({ open, onOpenChange }: ForgotPasswordDialogProps) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast.error(error.message);
      } else {
        setSent(true);
      }
    } catch {
      toast.error('Une erreur est survenue.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setSent(false);
      setEmail('');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Mot de passe oublié</DialogTitle>
          <DialogDescription>
            {sent
              ? 'Un email de réinitialisation a été envoyé si ce compte existe.'
              : 'Entre ton adresse email pour recevoir un lien de réinitialisation.'}
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-center">
              <p className="text-sm text-primary font-medium">
                📧 Vérifie ta boîte mail (et tes spams)
              </p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => handleClose(false)}>
              Retour à la connexion
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  className="bg-card border-border pl-10"
                  required
                />
              </div>
            </div>
            <Button type="submit" variant="gold" className="w-full" disabled={isLoading || !email}>
              {isLoading ? <span className="animate-pulse">Envoi...</span> : 'Envoyer le lien'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
