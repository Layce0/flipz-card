import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, CalendarDays, Loader2 } from 'lucide-react';
import { GameEvent } from '@/types/event';
import { useAllEvents, useCreateEvent, useUpdateEvent } from '@/hooks/useEvents';
import { EventFormDialog } from './EventFormDialog';
import { EventsList } from './EventsList';
import { EventTimelineEditor } from './EventTimelineEditor';
import { EventPreviewDialog } from './EventPreviewDialog';
import { toast } from 'sonner';

export const EventsPanel = () => {
  const { data: events = [], isLoading } = useAllEvents();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<GameEvent | null>(null);
  const [timelineEvent, setTimelineEvent] = useState<GameEvent | null>(null);
  const [previewEvent, setPreviewEvent] = useState<GameEvent | null>(null);

  const handleSaveEvent = async (eventData: Omit<GameEvent, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (editingEvent) {
        await updateEvent.mutateAsync({ id: editingEvent.id, ...eventData });
        toast.success('Événement modifié');
      } else {
        await createEvent.mutateAsync(eventData);
        toast.success('Événement créé');
      }
      setEditingEvent(null);
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
      throw error;
    }
  };

  const handleEdit = (event: GameEvent) => {
    setEditingEvent(event);
    setFormOpen(true);
  };

  const handleNewEvent = () => {
    setEditingEvent(null);
    setFormOpen(true);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-foreground flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          Gestion des événements
        </h2>
        <Button onClick={handleNewEvent} variant="gold" size="sm">
          <Plus className="w-4 h-4 mr-1" />
          Nouvel événement
        </Button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-card border border-border">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-xl font-display text-foreground">{events.length}</p>
        </div>
        <div className="p-3 rounded-lg bg-card border border-primary/30">
          <p className="text-xs text-muted-foreground">Actifs</p>
          <p className="text-xl font-display text-primary">
            {events.filter(e => e.is_active && !e.is_draft).length}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-card border border-border">
          <p className="text-xs text-muted-foreground">Brouillons</p>
          <p className="text-xl font-display text-muted-foreground">
            {events.filter(e => e.is_draft).length}
          </p>
        </div>
      </div>

      {/* Events list */}
      <EventsList 
        events={events}
        isLoading={isLoading}
        onEdit={handleEdit}
        onPreview={(event) => setPreviewEvent(event)}
        onViewTimeline={(event) => setTimelineEvent(event)}
      />

      {/* Dialogs */}
      <EventFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingEvent(null);
        }}
        event={editingEvent}
        onSave={handleSaveEvent}
        isLoading={createEvent.isPending || updateEvent.isPending}
      />

      <EventTimelineEditor
        event={timelineEvent}
        open={!!timelineEvent}
        onOpenChange={(open) => !open && setTimelineEvent(null)}
      />

      <EventPreviewDialog
        event={previewEvent}
        open={!!previewEvent}
        onOpenChange={(open) => !open && setPreviewEvent(null)}
      />
    </section>
  );
};
