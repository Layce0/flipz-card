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
        }, 900);
      }, 500);
    } else {
      setTimeout(() => setIsShaking(false), 500);
    }
  }, [tapCount, isShaking, isExploding, onComplete]);

  if (!isOpen) return null;

  // Intensity scales with taps
  const intensity = tapCount / MAX_TAPS;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden"
      style={{ touchAction: 'none', background: `radial-gradient(ellipse at center, hsl(270 60% ${8 + intensity * 12}%) 0%, hsl(240 20% 6%) 100%)` }}
      onClick={handleTap}
    >
      {/* Animated background rays */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="absolute top-1/2 left-1/2 origin-bottom-left"
            style={{
              width: '200vmax',
              height: '3px',
              background: `linear-gradient(90deg, transparent, hsl(280 70% 55% / ${0.05 + intensity * 0.15}), transparent)`,
              transform: `rotate(${i * 30}deg)`,
              animation: `pack-ray-spin ${8 - intensity * 3}s linear infinite`,
            }}
          />
        ))}
      </div>

      {/* Pulsing glow behind pack */}
      <div
        className="absolute pointer-events-none transition-all duration-300"
        style={{
          width: `${250 + intensity * 150}px`,
          height: `${250 + intensity * 150}px`,
          borderRadius: '50%',
          background: `radial-gradient(circle, hsl(280 80% 60% / ${0.15 + intensity * 0.4}) 0%, hsl(45 90% 55% / ${intensity * 0.2}) 40%, transparent 70%)`,
          filter: `blur(${30 + intensity * 20}px)`,
          animation: 'pack-glow-pulse 1.5s ease-in-out infinite',
        }}
      />

      {/* Orbiting sparks */}
      {tapCount > 0 && (
        <div className="absolute pointer-events-none" style={{ width: 300, height: 300 }}>
          {Array.from({ length: tapCount * 4 }, (_, i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full"
              style={{
                background: i % 2 === 0 ? 'hsl(45 90% 65%)' : 'hsl(280 80% 70%)',
                boxShadow: `0 0 8px 2px ${i % 2 === 0 ? 'hsl(45 90% 55% / 0.8)' : 'hsl(280 70% 55% / 0.8)'}`,
                top: '50%',
                left: '50%',
                animation: `pack-orbit ${1.5 + i * 0.2}s linear infinite`,
                animationDelay: `${i * 0.15}s`,
                '--orbit-radius': `${100 + i * 8}px`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}

      {/* Explosion particles */}
      {isExploding && (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 50 }, (_, i) => {
            const angle = (360 / 50) * i + Math.random() * 20;
            const rad = (angle * Math.PI) / 180;
            const speed = 120 + Math.random() * 300;
            const tx = Math.cos(rad) * speed;
            const ty = Math.sin(rad) * speed;
            const size = 3 + Math.random() * 10;
            const colors = [
              'hsl(280 70% 55%)', 'hsl(45 90% 55%)', 'hsl(260 50% 65%)',
              'hsl(300 60% 50%)', 'hsl(45 100% 70%)', 'hsl(270 80% 70%)',
            ];
            return (
              <span
                key={i}
                className="absolute left-1/2 top-1/2"
                style={{
                  width: size,
                  height: size,
                  borderRadius: i % 3 === 0 ? '50%' : i % 3 === 1 ? '2px' : '50%',
                  backgroundColor: colors[i % colors.length],
                  opacity: 0,
                  boxShadow: `0 0 ${size * 3}px ${size}px ${colors[i % colors.length]}`,
                  animation: 'particle-burst 0.8s ease-out forwards',
                  animationDelay: `${Math.random() * 0.15}s`,
                  '--tx': `${tx}px`,
                  '--ty': `${ty}px`,
                  '--start-opacity': '1',
                } as React.CSSProperties}
              />
            );
          })}
          {/* Flash */}
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle at center, hsl(45 100% 85% / 0.9) 0%, transparent 60%)',
              animation: 'pack-flash 0.6s ease-out forwards',
            }}
          />
        </div>
      )}

      {/* Pack sachet */}
      <div className="relative z-10">
        <img
          src={packSachetImg}
          alt="Pack Flipz"
          className={cn(
            "w-72 h-auto select-none pointer-events-none drop-shadow-2xl",
            isShaking && "animate-pack-shake-intense",
            isExploding && "animate-pack-explode",
            !isShaking && !isExploding && "animate-pack-float"
          )}
          style={{
            filter: isExploding
              ? 'brightness(3) saturate(0.5)'
              : `brightness(${1 + intensity * 0.2}) saturate(${1 + intensity * 0.3})`,
            transition: 'filter 0.3s',
          }}
          draggable={false}
        />

        {/* Energy ring around pack */}
        {tapCount > 1 && !isExploding && (
          <div
            className="absolute inset-[-20px] rounded-3xl pointer-events-none"
            style={{
              border: `2px solid hsl(280 70% 55% / ${intensity * 0.6})`,
              boxShadow: `0 0 ${intensity * 40}px ${intensity * 15}px hsl(280 70% 55% / ${intensity * 0.3}), inset 0 0 ${intensity * 20}px hsl(45 90% 55% / ${intensity * 0.15})`,
              animation: 'pack-ring-pulse 0.8s ease-in-out infinite',
            }}
          />
        )}
      </div>

      {/* Progress dots */}
      <div className="flex gap-3 mt-10 z-10">
        {Array.from({ length: MAX_TAPS }, (_, i) => (
          <div
            key={i}
            className={cn(
              "w-3.5 h-3.5 rounded-full transition-all duration-300 border",
              i < tapCount
                ? "bg-primary border-primary scale-125 shadow-[0_0_10px_hsl(45_90%_55%/0.6)]"
                : "bg-muted/30 border-muted-foreground/20"
            )}
          />
        ))}
      </div>

      {/* Tap instruction */}
      {!isExploding && (
        <p
          className="text-muted-foreground/70 text-sm mt-6 z-10 tracking-widest uppercase"
          style={{ animation: 'pack-text-pulse 2s ease-in-out infinite' }}
        >
          Tapotez pour ouvrir
        </p>
      )}
    </div>
  );
};
