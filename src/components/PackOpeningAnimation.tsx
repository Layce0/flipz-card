import { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import packSachetImg from '@/assets/pack-sachet.png';

interface PackOpeningAnimationProps {
  isOpen: boolean;
  onComplete: () => void;
}

const SHAKE_CONFIGS = [
  null, // index 0 unused
  { displacement: 6, rotation: 2, duration: 400 },
  { displacement: 12, rotation: 4, duration: 450 },
  { displacement: 18, rotation: 6, duration: 500 },
  { displacement: 24, rotation: 8, duration: 550 },
  { displacement: 30, rotation: 10, duration: 600 },
];

export const PackOpeningAnimation = ({ isOpen, onComplete }: PackOpeningAnimationProps) => {
  const [tapCount, setTapCount] = useState(0);
  const [isExploding, setIsExploding] = useState(false);
  const [locked, setLocked] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const MAX_TAPS = 5;

  const triggerShake = useCallback((level: number) => {
    const el = imgRef.current;
    if (!el) return;

    const config = SHAKE_CONFIGS[level];
    if (!config) return;

    const { displacement: d, rotation: r, duration } = config;
    const steps = [
      { transform: 'translateX(0) rotate(0deg)', offset: 0 },
      { transform: `translateX(-${d}px) rotate(-${r}deg)`, offset: 0.1 },
      { transform: `translateX(${d}px) rotate(${r}deg)`, offset: 0.2 },
      { transform: `translateX(-${d * 0.85}px) rotate(-${r * 0.8}deg)`, offset: 0.3 },
      { transform: `translateX(${d * 0.85}px) rotate(${r * 0.8}deg)`, offset: 0.4 },
      { transform: `translateX(-${d * 0.6}px) rotate(-${r * 0.5}deg)`, offset: 0.55 },
      { transform: `translateX(${d * 0.6}px) rotate(${r * 0.5}deg)`, offset: 0.7 },
      { transform: `translateX(-${d * 0.3}px) rotate(-${r * 0.2}deg)`, offset: 0.85 },
      { transform: 'translateX(0) rotate(0deg)', offset: 1 },
    ];

    el.animate(steps, { duration, easing: 'ease-in-out' });
  }, []);

  const handleTap = useCallback(() => {
    if (isExploding || locked) return;

    const newCount = tapCount + 1;
    setTapCount(newCount);
    setLocked(true);

    if (newCount >= MAX_TAPS) {
      triggerShake(newCount);
      setTimeout(() => {
        setIsExploding(true);
        // Animate the explode
        const el = imgRef.current;
        if (el) {
          el.animate([
            { transform: 'scale(1)', opacity: 1 },
            { transform: 'scale(1.5)', opacity: 0.7 },
            { transform: 'scale(2.5)', opacity: 0 },
          ], { duration: 450, easing: 'ease-out', fill: 'forwards' });
        }
        setTimeout(() => {
          setTapCount(0);
          setIsExploding(false);
          setLocked(false);
          onComplete();
        }, 550);
      }, 500);
    } else {
      triggerShake(newCount);
      setTimeout(() => setLocked(false), 500);
    }
  }, [tapCount, locked, isExploding, onComplete, triggerShake]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-background/95"
      style={{ touchAction: 'none', cursor: 'pointer' }}
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
      <div className="relative z-10 pointer-events-none">
        <img
          ref={imgRef}
          src={packSachetImg}
          alt="Pack Flipz"
          className="w-72 h-auto select-none drop-shadow-2xl"
          draggable={false}
        />
      </div>

      {/* Tap instruction */}
      {!isExploding && (
        <p className="text-muted-foreground/60 text-sm mt-8 z-10 tracking-widest uppercase pointer-events-none">
          Tapotez pour ouvrir
        </p>
      )}
    </div>
  );
};
