import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Sparkles, Gift } from 'lucide-react';
import { GameEvent } from '@/types/event';
import { RARITY_CONFIG } from '@/types/card';
import { cn } from '@/lib/utils';

interface EventPreviewDialogProps {
  event: GameEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EventPreviewDialog = ({ event, open, onOpenChange }: EventPreviewDialogProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!open) {
      setIsPlaying(false);
      setShowConfetti(false);
      setShowFlash(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  }, [open]);

  if (!event) return null;

  const handlePlay = () => {
    setIsPlaying(true);
    
    // Trigger effects
    if (event.flash_enabled) {
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 500);
    }
    
    if (event.confetti_enabled) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }

    // Play audio
    if (event.music_url && audioRef.current) {
      audioRef.current.muted = isMuted;
      audioRef.current.play().catch(console.error);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setShowConfetti(false);
    setShowFlash(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Prévisualisation: {event.name}
          </DialogTitle>
        </DialogHeader>

        {/* Flash overlay */}
        {showFlash && (
          <div className="absolute inset-0 bg-white z-50 animate-pulse pointer-events-none" />
        )}

        {/* Confetti */}
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 animate-bounce"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-10%`,
                  backgroundColor: ['#EAB308', '#A855F7', '#3B82F6', '#22C55E', '#EF4444'][Math.floor(Math.random() * 5)],
                  animation: `fall ${2 + Math.random() * 2}s linear forwards`,
                  animationDelay: `${Math.random() * 0.5}s`,
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            ))}
          </div>
        )}

        <div className="space-y-6 relative">
          {/* Preview area */}
          <div 
            className={cn(
              "relative rounded-xl overflow-hidden bg-gradient-to-br from-card to-background p-6 transition-all duration-500",
              event.glow_enabled && isPlaying && "shadow-[0_0_50px_rgba(234,179,8,0.4)]"
            )}
          >
            {/* Simulated shop preview */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Gift className="w-6 h-6 text-primary" />
                <h3 className="font-display text-lg text-foreground">Boutique</h3>
                {isPlaying && (
                  <Badge className="bg-primary/20 text-primary animate-pulse">
                    Événement actif !
                  </Badge>
                )}
              </div>

              {/* Probability preview */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Probabilités avec boosts:</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(RARITY_CONFIG).map(([key, config]) => {
                    const boost = event.rarity_boosts?.[key] || 1;
                    const baseRate = config.dropRate;
                    const boostedRate = baseRate * boost * (event.global_multiplier || 1);

                    return (
                      <div 
                        key={key}
                        className={cn(
                          "p-2 rounded-lg border transition-all",
                          isPlaying && boost > 1 ? "border-primary bg-primary/10" : "border-border bg-card"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span 
                            className={cn("text-xs font-semibold uppercase", config.bgClass, "px-1.5 py-0.5 rounded")}
                            style={{ color: key === 'legendary' ? 'hsl(240, 20%, 6%)' : 'white' }}
                          >
                            {config.label}
                          </span>
                          <span className="text-sm font-mono">
                            {isPlaying ? (
                              <span className="text-primary">{boostedRate.toFixed(1)}%</span>
                            ) : (
                              <span className="text-muted-foreground">{baseRate}%</span>
                            )}
                          </span>
                        </div>
                        {isPlaying && boost > 1 && (
                          <div className="text-xs text-primary mt-1">
                            ×{boost} boost actif
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bonus cards */}
              {event.bonus_cards > 0 && isPlaying && (
                <div className="p-3 rounded-lg bg-primary/20 border border-primary/50">
                  <p className="text-sm text-primary font-medium">
                    🎁 +{event.bonus_cards} carte{event.bonus_cards > 1 ? 's' : ''} bonus par pack !
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            <Button 
              variant="outline" 
              size="icon"
              onClick={toggleMute}
              disabled={!event.music_url}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>

            {!isPlaying ? (
              <Button variant="gold" onClick={handlePlay}>
                <Play className="w-4 h-4 mr-2" />
                Lancer la prévisualisation
              </Button>
            ) : (
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Réinitialiser
              </Button>
            )}
          </div>

          {/* Effect indicators */}
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <span className={cn(event.glow_enabled && "text-primary")}>
              ✨ Glow: {event.glow_enabled ? 'Oui' : 'Non'}
            </span>
            <span className={cn(event.flash_enabled && "text-primary")}>
              ⚡ Flash: {event.flash_enabled ? 'Oui' : 'Non'}
            </span>
            <span className={cn(event.confetti_enabled && "text-primary")}>
              🎊 Confettis: {event.confetti_enabled ? 'Oui' : 'Non'}
            </span>
          </div>
        </div>

        {/* Hidden audio element */}
        {event.music_url && (
          <audio ref={audioRef} src={event.music_url} loop />
        )}

        <style>{`
          @keyframes fall {
            to {
              transform: translateY(500px) rotate(720deg);
              opacity: 0;
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
};
