import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import packSachetImg from '@/assets/pack-sachet.png';

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
      setTimeout(() => {
        setIsShaking(false);
        setIsExploding(true);
        setTimeout(() => {
          setTapCount(0);
          setIsExploding(false);
          onComplete();
        }, 600);
      }, 300);
    } else {
      setTimeout(() => setIsShaking(false), 300);
    }
  }, [tapCount, isShaking, isExploding, onComplete]);

  if (!isOpen) return null;

  const shakeClass = isShaking
    ? `animate-pack-shake-${Math.min(tapCount, MAX_TAPS)}`
    : '';

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-background/95"
      style={{ touchAction: 'none' }}
      onClick={handleTap}
    >
      {/* Explosion particles */}
      {isExploding && (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 60 }, (_, i) => {
            const angle = (360 / 60) * i + Math.random() * 15;
            const rad = (angle * Math.PI) / 180;
            const speed = 150 + Math.random() * 350;
            const tx = Math.cos(rad) * speed;
            const ty = Math.sin(rad) * speed;
            const size = 3 + Math.random() * 8;
            const isWhite = i % 3 === 0;
            const color = isWhite
              ? 'hsl(0 0% 95%)'
              : i % 2 === 0
                ? 'hsl(300 70% 65%)'
                : 'hsl(270 60% 60%)';
            return (
              <span
                key={i}
                className="absolute left-1/2 top-1/2 rounded-full"
                style={{
                  width: size,
                  height: size,
                  backgroundColor: color,
                  boxShadow: `0 0 ${size * 2}px ${color}`,
                  opacity: 0,
                  animation: 'particle-burst 0.5s ease-out forwards',
                  animationDelay: `${Math.random() * 0.08}s`,
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
          alt="Pack Flipz"
          className={cn(
            "w-72 h-auto select-none pointer-events-none drop-shadow-2xl",
            shakeClass,
            isExploding && "animate-pack-explode-fast"
          )}
          draggable={false}
        />
      </div>

      {/* Tap instruction */}
      {!isExploding && (
        <p className="text-muted-foreground/60 text-sm mt-8 z-10 tracking-widest uppercase">
          Tapotez pour ouvrir
        </p>
      )}
    </div>
  );
};
