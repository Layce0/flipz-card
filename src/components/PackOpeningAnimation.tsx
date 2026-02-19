import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import packSachetImg from '@/assets/pack-sachet.jpeg';

interface PackOpeningAnimationProps {
  isOpen: boolean;
  onComplete: () => void;
}

export const PackOpeningAnimation = ({ isOpen, onComplete }: PackOpeningAnimationProps) => {
  const [tapCount, setTapCount] = useState(0);
  const [isShaking, setIsShaking] = useState(false);
  const [isExploding, setIsExploding] = useState(false);

  const MAX_TAPS = 5;

  const handleTap = useCallback(() => {
    if (isExploding || isShaking) return;

    const newCount = tapCount + 1;
    setTapCount(newCount);
    setIsShaking(true);

    if (newCount >= MAX_TAPS) {
      // Explode after shake
      setTimeout(() => {
        setIsShaking(false);
        setIsExploding(true);
        // Wait for explosion animation then transition
        setTimeout(() => {
          setTapCount(0);
          setIsExploding(false);
          onComplete();
        }, 700);
      }, 400);
    } else {
      setTimeout(() => setIsShaking(false), 400);
    }
  }, [tapCount, isShaking, isExploding, onComplete]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-background/95 flex flex-col items-center justify-center"
      style={{ touchAction: 'none' }}
      onClick={handleTap}
    >
      {/* Glow background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-80 h-80 rounded-full bg-primary/10 blur-3xl animate-pulse" />
      </div>

      {/* Explosion particles */}
      {isExploding && (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 30 }, (_, i) => {
            const angle = (360 / 30) * i;
            const rad = (angle * Math.PI) / 180;
            const speed = 150 + Math.random() * 200;
            const tx = Math.cos(rad) * speed;
            const ty = Math.sin(rad) * speed;
            const size = 4 + Math.random() * 8;
            return (
              <span
                key={i}
                className="absolute rounded-sm left-1/2 top-1/2"
                style={{
                  width: size,
                  height: size * 1.5,
                  backgroundColor: i % 3 === 0 ? 'hsl(280 70% 55%)' : i % 3 === 1 ? 'hsl(45 90% 55%)' : 'hsl(260 40% 45%)',
                  opacity: 0,
                  boxShadow: `0 0 ${size * 2}px ${size}px ${i % 2 === 0 ? 'hsl(280 70% 55% / 0.5)' : 'hsl(45 90% 55% / 0.5)'}`,
                  animation: 'particle-burst 0.7s ease-out forwards',
                  '--tx': `${tx}px`,
                  '--ty': `${ty}px`,
                  '--start-opacity': '1',
                } as React.CSSProperties}
              />
            );
          })}
        </div>
      )}

      {/* Pack sachet */}
      <div className="relative z-10">
        <img
          src={packSachetImg}
          alt="Pack"
          className={cn(
            "w-64 h-auto rounded-lg transition-transform select-none pointer-events-none",
            isShaking && "animate-pack-shake",
            isExploding && "animate-pack-explode",
            !isShaking && !isExploding && "animate-pack-float"
          )}
          style={{
            filter: isExploding 
              ? 'brightness(2)' 
              : `brightness(${1 + tapCount * 0.08})`,
          }}
          draggable={false}
        />

        {/* Intensity cracks / glow based on tap count */}
        {tapCount > 0 && !isExploding && (
          <div
            className="absolute inset-0 rounded-lg pointer-events-none"
            style={{
              boxShadow: `0 0 ${tapCount * 15}px ${tapCount * 5}px hsl(280 70% 55% / ${tapCount * 0.15})`,
            }}
          />
        )}
      </div>

      {/* Progress dots */}
      <div className="flex gap-2 mt-8 z-10">
        {Array.from({ length: MAX_TAPS }, (_, i) => (
          <div
            key={i}
            className={cn(
              "w-3 h-3 rounded-full transition-all duration-300",
              i < tapCount ? "bg-primary scale-110" : "bg-muted"
            )}
          />
        ))}
      </div>

      {/* Tap instruction */}
      {!isExploding && (
        <p className="text-muted-foreground text-sm mt-6 z-10 animate-pulse">
          Tapotez pour ouvrir
        </p>
      )}
    </div>
  );
};
