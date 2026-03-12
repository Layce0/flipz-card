import { useState, useCallback, useRef } from 'react';
import packSachetImg from '@/assets/pack-sachet.png';
import packTopCapImg from '@/assets/pack-top-cap.png';
import packBottomBodyImg from '@/assets/pack-bottom-body.png';

interface PackOpeningAnimationProps {
  isOpen: boolean;
  onComplete: () => void;
}

const SHAKE_CONFIGS = [
  null,
  { displacement: 10, rotation: 3, duration: 350 },
  { displacement: 22, rotation: 7, duration: 400 },
  { displacement: 36, rotation: 12, duration: 450 },
];

export const PackOpeningAnimation = ({ isOpen, onComplete }: PackOpeningAnimationProps) => {
  const [tapCount, setTapCount] = useState(0);
  const [isTearing, setIsTearing] = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  const MAX_TAPS = 3;

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
    if (isTearing) return;

    const newCount = tapCount + 1;
    setTapCount(newCount);
    triggerShake(Math.min(newCount, MAX_TAPS));

    if (newCount >= MAX_TAPS) {
      setTimeout(() => {
        setIsTearing(true);
        setShowParticles(true);

        setTimeout(() => {
          setTapCount(0);
          setIsTearing(false);
          setShowParticles(false);
          onComplete();
        }, 900);
      }, 250);
    }
  }, [tapCount, isTearing, onComplete, triggerShake]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-background/95"
      style={{ touchAction: 'none', cursor: 'pointer' }}
      onClick={handleTap}
    >
      {/* Particle burst on tear */}
      {showParticles && (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 50 }, (_, i) => {
            const angle = (360 / 50) * i + Math.random() * 20;
            const rad = (angle * Math.PI) / 180;
            const speed = 100 + Math.random() * 300;
            const tx = Math.cos(rad) * speed;
            const ty = Math.sin(rad) * speed;
            const size = 3 + Math.random() * 7;
            const isWhite = i % 4 === 0;
            const color = isWhite
              ? 'hsl(45 90% 80%)'
              : i % 3 === 0
                ? 'hsl(45 95% 55%)'
                : i % 2 === 0
                  ? 'hsl(35 90% 50%)'
                  : 'hsl(280 60% 55%)';
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
                  animation: 'particle-burst 0.7s ease-out forwards',
                  animationDelay: `${Math.random() * 0.1}s`,
                  '--tx': `${tx}px`,
                  '--ty': `${ty}px`,
                  '--start-opacity': '1',
                } as React.CSSProperties}
              />
            );
          })}
        </div>
      )}

      {/* Pack container with tear effect */}
      <div ref={imgRef} className="relative z-10 pointer-events-none">
        {!isTearing ? (
          <img
            src={packSachetImg}
            alt="Pack Flipz"
            className="w-72 h-auto select-none drop-shadow-2xl"
            draggable={false}
          />
        ) : (
          <div className="relative w-72">
            {/* Top cap — flies up */}
            <div
              style={{
                animation: 'tear-top 0.7s ease-in forwards',
              }}
            >
              <img
                src={packTopCapImg}
                alt=""
                className="w-72 h-auto select-none"
                draggable={false}
              />
            </div>

            {/* Bottom body — slides down */}
            <div
              style={{
                animation: 'tear-bottom 0.7s ease-in forwards',
              }}
            >
              <img
                src={packBottomBodyImg}
                alt=""
                className="w-72 h-auto select-none"
                draggable={false}
              />
            </div>

            {/* Cards emerging glow from tear line */}
            <div
              className="absolute left-1/2 w-16 h-24 rounded-lg"
              style={{
                top: '25%',
                transform: 'translate(-50%, -50%)',
                background: 'radial-gradient(ellipse, hsl(45 90% 55% / 0.8) 0%, hsl(45 90% 55% / 0.3) 40%, transparent 70%)',
                animation: 'cards-emerge 0.7s ease-out forwards',
              }}
            />
          </div>
        )}
      </div>

      {/* Tap instruction */}
      {!isTearing && (
        <div className="z-10 mt-8 flex flex-col items-center gap-2 pointer-events-none">
          <p className="text-muted-foreground/60 text-sm tracking-widest uppercase">
            Tapotez pour ouvrir
          </p>
          {/* Tap progress dots */}
          <div className="flex gap-2">
            {Array.from({ length: MAX_TAPS }, (_, i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: i < tapCount
                    ? 'hsl(45 90% 55%)'
                    : 'hsl(240 15% 25%)',
                  boxShadow: i < tapCount ? '0 0 8px hsl(45 90% 55% / 0.6)' : 'none',
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
