import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Loader2, GripHorizontal } from 'lucide-react';
import { GameEvent, EventTimelineSegment, SEGMENT_TYPE_CONFIG } from '@/types/event';
import { useEventSegments, useCreateSegment, useUpdateSegment, useDeleteSegment } from '@/hooks/useEvents';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EventTimelineEditorProps {
  event: GameEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EventTimelineEditor = ({ event, open, onOpenChange }: EventTimelineEditorProps) => {
  const { data: segments = [], isLoading } = useEventSegments(event?.id || '');
  const createSegment = useCreateSegment();
  const updateSegment = useUpdateSegment();
  const deleteSegment = useDeleteSegment();

  const [newSegment, setNewSegment] = useState({
    segment_type: 'visual' as 'music' | 'visual' | 'free_pack',
    start_offset_seconds: 0,
    duration_seconds: 60,
  });

  const [dragging, setDragging] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  if (!event) return null;

  const totalDuration = (event.duration_minutes || 30) * 60;

  const handleAddSegment = async () => {
    try {
      await createSegment.mutateAsync({
        event_id: event.id,
        segment_type: newSegment.segment_type,
        start_offset_seconds: newSegment.start_offset_seconds,
        duration_seconds: newSegment.duration_seconds,
        config: {},
      });
      toast.success('Segment ajouté');
    } catch (error) {
      toast.error('Erreur lors de l\'ajout');
    }
  };

  const handleDeleteSegment = async (segmentId: string) => {
    try {
      await deleteSegment.mutateAsync({ id: segmentId, event_id: event.id });
      toast.success('Segment supprimé');
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleDragStart = (segmentId: string) => {
    setDragging(segmentId);
  };

  const handleDragEnd = async (e: React.MouseEvent, segment: EventTimelineSegment) => {
    if (!timelineRef.current || !dragging) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newOffset = Math.round(percentage * totalDuration);

    try {
      await updateSegment.mutateAsync({
        id: segment.id,
        event_id: event.id,
        start_offset_seconds: newOffset,
      });
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }

    setDragging(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSegmentStatus = (segment: EventTimelineSegment) => {
    // For preview purposes, we calculate based on event timing
    const now = new Date();
    const eventStart = new Date(event.start_at);
    const elapsedSeconds = (now.getTime() - eventStart.getTime()) / 1000;

    if (elapsedSeconds < segment.start_offset_seconds) return 'upcoming';
    if (elapsedSeconds > segment.start_offset_seconds + segment.duration_seconds) return 'completed';
    return 'active';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display">
            Timeline: {event.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Timeline visualization */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0:00</span>
              <span>{formatTime(totalDuration / 2)}</span>
              <span>{formatTime(totalDuration)}</span>
            </div>
            
            <div 
              ref={timelineRef}
              className="relative h-24 bg-card rounded-lg border border-border overflow-hidden"
            >
              {/* Time markers */}
              <div className="absolute inset-0 flex">
                {[...Array(10)].map((_, i) => (
                  <div 
                    key={i} 
                    className="flex-1 border-r border-border/30 last:border-r-0"
                  />
                ))}
              </div>

              {/* Segments */}
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                segments.map((segment) => {
                  const config = SEGMENT_TYPE_CONFIG[segment.segment_type];
                  const left = (segment.start_offset_seconds / totalDuration) * 100;
                  const width = (segment.duration_seconds / totalDuration) * 100;
                  const status = getSegmentStatus(segment);

                  return (
                    <div
                      key={segment.id}
                      className={cn(
                        "absolute top-2 bottom-2 rounded-lg cursor-grab active:cursor-grabbing transition-all flex items-center justify-center gap-1",
                        status === 'active' && "ring-2 ring-primary shadow-lg",
                        status === 'completed' && "opacity-50",
                        dragging === segment.id && "opacity-75 scale-105"
                      )}
                      style={{
                        left: `${left}%`,
                        width: `${Math.max(width, 5)}%`,
                        backgroundColor: config.color,
                      }}
                      onMouseDown={() => handleDragStart(segment.id)}
                      onMouseUp={(e) => handleDragEnd(e, segment)}
                    >
                      <GripHorizontal className="w-4 h-4 text-white/80" />
                      <span className="text-white text-xs font-medium truncate px-1">
                        {config.icon} {config.label}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-white/80 hover:text-white hover:bg-white/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSegment(segment.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Add segment form */}
          <div className="p-4 rounded-lg bg-muted/50 space-y-4">
            <h3 className="font-semibold text-foreground">Ajouter un segment</h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select 
                  value={newSegment.segment_type}
                  onValueChange={(value: 'music' | 'visual' | 'free_pack') => 
                    setNewSegment({ ...newSegment, segment_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEGMENT_TYPE_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.icon} {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Début (secondes)</Label>
                <Input
                  type="number"
                  min={0}
                  max={totalDuration}
                  value={newSegment.start_offset_seconds}
                  onChange={(e) => setNewSegment({ ...newSegment, start_offset_seconds: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label>Durée (secondes)</Label>
                <Input
                  type="number"
                  min={1}
                  max={totalDuration}
                  value={newSegment.duration_seconds}
                  onChange={(e) => setNewSegment({ ...newSegment, duration_seconds: parseInt(e.target.value) || 60 })}
                />
              </div>
            </div>

            <Button 
              onClick={handleAddSegment}
              disabled={createSegment.isPending}
              className="w-full"
            >
              {createSegment.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter le segment
                </>
              )}
            </Button>
          </div>

          {/* Legend */}
          <div className="flex gap-4 justify-center text-xs">
            {Object.entries(SEGMENT_TYPE_CONFIG).map(([key, config]) => (
              <div key={key} className="flex items-center gap-1">
                <div 
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: config.color }}
                />
                <span className="text-muted-foreground">{config.label}</span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
