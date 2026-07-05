import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Play, Coins, Loader2 } from 'lucide-react';
import { useRestoreStreak } from '@/hooks/useWinstreak';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { toast } from 'sonner';

interface StreakLostDialogProps {
  open: boolean;
  onClose: () => void;
  previousStreak: number;
}

/**
 * Discrete, non-commercial modal shown when a user's winstreak resets.
 * Offers two low-key options: watch an ad or restore via a small payment.
 */
export const StreakLostDialog = ({ open, onClose, previousStreak }: StreakLostDialogProps) => {
  const restore = useRestoreStreak();
  const [paying, setPaying] = useState(false);

  const handleAd = async () => {
    try {
      await restore.mutateAsync();
      toast.success('Série restaurée');
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Restauration impossible');
    }
  };

  const handlePay = async () => {
    try {
      setPaying(true);
      const { data, error } = await invokeEdgeFunction('create-streak-restore-checkout', {
        body: {},
      });
      if (error || data?.error || !data?.url) {
        throw new Error(data?.error || 'Paiement indisponible');
      }
      window.location.href = data.url;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Paiement indisponible');
      setPaying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xs rounded-2xl border-border/50 bg-card/95 p-5">
        <DialogHeader className="space-y-1.5 text-left">
          <DialogTitle className="text-base font-display font-medium text-foreground">
            Série interrompue
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Ta série de {previousStreak} jour{previousStreak > 1 ? 's' : ''} a été remise à zéro.
            Tu peux la récupérer si tu le souhaites.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-3 flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="justify-start gap-2 bg-muted/40 hover:bg-muted/60 text-foreground/90 font-normal"
            onClick={handleAd}
            disabled={restore.isPending}
          >
            <Play className="w-3.5 h-3.5" />
            Regarder une pub
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start gap-2 bg-muted/40 hover:bg-muted/60 text-foreground/90 font-normal"
            onClick={handlePay}
            disabled={restore.isPending || paying}
          >
            {paying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Coins className="w-3.5 h-3.5" />}
            Restaurer pour 0,10 €
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="mt-1 text-[11px] text-muted-foreground/70 hover:text-muted-foreground text-center py-1"
          >
            Non merci
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
