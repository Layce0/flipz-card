import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Clock, 
  Pencil, 
  Trash2, 
  Sparkles, 
  Volume2, 
  Zap,
  Eye,
  Loader2
} from 'lucide-react';
import { GameEvent } from '@/types/event';
import { useDeleteEvent } from '@/hooks/useEvents';
import { EventLiveControls } from './EventLiveControls';
import { EventDistributionDialog } from './EventDistributionDialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
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

interface EventsListProps {
  events: GameEvent[];
  isLoading: boolean;
  onEdit: (event: GameEvent) => void;
  onPreview: (event: GameEvent) => void;
  onViewTimeline: (event: GameEvent) => void;
}

export const EventsList = ({ events, isLoading, onEdit, onPreview, onViewTimeline }: EventsListProps) => {
  const deleteEvent = useDeleteEvent();
  const [eventToDelete, setEventToDelete] = useState<GameEvent | null>(null);
  const [distributionEvent, setDistributionEvent] = useState<GameEvent | null>(null);

  const handleDelete = async () => {
    if (!eventToDelete) return;
    
    try {
      await deleteEvent.mutateAsync(eventToDelete.id);
      toast.success('Événement supprimé');
      setEventToDelete(null);
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const getEventStatus = (event: GameEvent) => {
    const now = new Date();
    const start = new Date(event.start_at);
    const end = new Date(event.end_at);
    
    if (event.is_draft) return { label: 'Brouillon', color: 'bg-muted text-muted-foreground' };
    if (!event.is_active) return { label: 'Désactivé', color: 'bg-destructive/20 text-destructive' };
    if (now < start) return { label: 'Planifié', color: 'bg-blue-500/20 text-blue-400' };
    if (now > end) return { label: 'Terminé', color: 'bg-muted text-muted-foreground' };
    return { label: 'En cours', color: 'bg-green-500/20 text-green-400' };
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Aucun événement créé
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {events.map((event) => {
          const status = getEventStatus(event);
          const hasEffects = event.glow_enabled || event.flash_enabled || event.confetti_enabled;
          const hasAudio = event.music_url || event.sound_effect_url;
          const hasBoosts = event.global_multiplier > 1 || Object.values(event.rarity_boosts || {}).some(v => v > 1);

          return (
            <div 
              key={event.id}
              className={cn(
                "p-4 rounded-xl bg-card border transition-all",
                event.is_active && !event.is_draft 
                  ? "border-primary/50 shadow-[0_0_15px_rgba(234,179,8,0.15)]" 
                  : "border-border"
              )}
            >
              {/* Live controls row */}
              <div className="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-border">
                <EventLiveControls 
                  event={event} 
                  onDistribute={() => setDistributionEvent(event)}
                />
                <div className="flex items-center gap-1">
                  {event.type === 'short' && (
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => onViewTimeline(event)}
                      title="Timeline"
                    >
                      <Clock className="w-4 h-4" />
                    </Button>
                  )}
                  
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => onPreview(event)}
                    title="Prévisualiser"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => onEdit(event)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => setEventToDelete(event)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Event info */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-display text-foreground truncate">{event.name}</h3>
                    <Badge variant="outline" className={status.color}>
                      {status.label}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {event.type === 'short' ? 'Court' : 'Long'}
                    </Badge>
                  </div>
                  
                  {event.description && (
                    <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                      {event.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(event.start_at), 'dd MMM HH:mm', { locale: fr })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(event.end_at), 'dd MMM HH:mm', { locale: fr })}
                    </span>
                    {hasEffects && (
                      <span className="flex items-center gap-1 text-primary">
                        <Sparkles className="w-3 h-3" />
                        Effets
                      </span>
                    )}
                    {hasAudio && (
                      <span className="flex items-center gap-1 text-primary">
                        <Volume2 className="w-3 h-3" />
                        Audio
                      </span>
                    )}
                    {hasBoosts && (
                      <span className="flex items-center gap-1 text-primary">
                        <Zap className="w-3 h-3" />
                        Boosts
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!eventToDelete} onOpenChange={() => setEventToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'événement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'événement "{eventToDelete?.name}" sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteEvent.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Supprimer'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Distribution dialog */}
      {distributionEvent && (
        <EventDistributionDialog
          event={distributionEvent}
          open={!!distributionEvent}
          onOpenChange={(open) => !open && setDistributionEvent(null)}
        />
      )}
    </>
  );
};
