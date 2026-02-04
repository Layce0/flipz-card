import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Play, 
  Square, 
  Zap, 
  Users, 
  Gift,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { GameEvent } from '@/types/event';
import { useToggleEventActive } from '@/hooks/useEvents';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EventLiveControlsProps {
  event: GameEvent;
  onDistribute?: () => void;
}

export const EventLiveControls = ({ event, onDistribute }: EventLiveControlsProps) => {
  const toggleActive = useToggleEventActive();
  const [confirmAction, setConfirmAction] = useState<'start' | 'stop' | null>(null);

  const isCurrentlyActive = event.is_active && !event.is_draft;
  const now = new Date();
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);
  const isWithinTimeRange = now >= start && now <= end;

  const handleLaunch = async () => {
    try {
      await toggleActive.mutateAsync({ id: event.id, is_active: true });
      toast.success('🚀 Événement lancé!', {
        description: 'Tous les utilisateurs peuvent maintenant voir les effets.',
      });
      setConfirmAction(null);
    } catch (error) {
      toast.error('Erreur lors du lancement');
    }
  };

  const handleStop = async () => {
    try {
      await toggleActive.mutateAsync({ id: event.id, is_active: false });
      toast.info('Événement arrêté', {
        description: 'Les effets ont été désactivés pour tous les utilisateurs.',
      });
      setConfirmAction(null);
    } catch (error) {
      toast.error('Erreur lors de l\'arrêt');
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Live status indicator */}
        {isCurrentlyActive && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/20 border border-green-500/40">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-green-400">LIVE</span>
          </div>
        )}

        {/* Quick toggle */}
        <Switch
          checked={event.is_active}
          onCheckedChange={(checked) => {
            if (checked) {
              setConfirmAction('start');
            } else {
              setConfirmAction('stop');
            }
          }}
          disabled={toggleActive.isPending}
          className="data-[state=checked]:bg-green-500"
        />

        {/* Launch/Stop buttons */}
        {!isCurrentlyActive ? (
          <Button 
            size="sm" 
            variant="default"
            className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
            onClick={() => setConfirmAction('start')}
            disabled={toggleActive.isPending}
          >
            {toggleActive.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Lancer
          </Button>
        ) : (
          <Button 
            size="sm" 
            variant="destructive"
            className="gap-1.5"
            onClick={() => setConfirmAction('stop')}
            disabled={toggleActive.isPending}
          >
            {toggleActive.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            Stopper
          </Button>
        )}

        {/* Distribute button */}
        {isCurrentlyActive && onDistribute && (
          <Button 
            size="sm" 
            variant="outline"
            className="gap-1.5 border-primary/50 text-primary hover:bg-primary/10"
            onClick={onDistribute}
          >
            <Gift className="w-4 h-4" />
            Distribuer
          </Button>
        )}
      </div>

      {/* Warning if outside time range */}
      {!isWithinTimeRange && event.is_active && (
        <div className="flex items-center gap-1 text-xs text-yellow-400 mt-1">
          <AlertTriangle className="w-3 h-3" />
          <span>L'événement est actif mais hors de la plage horaire définie</span>
        </div>
      )}

      {/* Confirmation dialogs */}
      <AlertDialog open={confirmAction === 'start'} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Play className="w-5 h-5 text-green-500" />
              Lancer l'événement ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              L'événement "<strong>{event.name}</strong>" sera immédiatement visible par tous les utilisateurs.
              Tous les effets visuels et boosts seront activés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleLaunch}
              className="bg-green-600 hover:bg-green-700"
            >
              {toggleActive.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Lancer l'événement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmAction === 'stop'} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Square className="w-5 h-5 text-destructive" />
              Stopper l'événement ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              L'événement "<strong>{event.name}</strong>" sera immédiatement désactivé pour tous les utilisateurs.
              Les effets visuels et boosts seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleStop}
              className="bg-destructive hover:bg-destructive/90"
            >
              {toggleActive.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Square className="w-4 h-4 mr-2" />
              )}
              Stopper l'événement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
