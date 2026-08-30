import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSfx } from '@/hooks/useSfx';

import packSachetImg from '@/assets/pack-sachet.png';
import packLuckyImg from '@/assets/pack-lucky.png';
import packUltraImg from '@/assets/pack-ultra.png';
import packBoosterImg from '@/assets/pack-booster.png';

export type PackAnimationType = 'standard' | 'lucky' | 'ultra' | 'free';

interface PackOpeningAnimationProps {
  isOpen: boolean;
  onComplete: () => void;
  packType?: PackAnimationType;
  packId?: string;
}

const GLOW_COLORS: Record<string, string> = {
  free: 'hsl(210 100% 60%)',
  standard: 'hsl(210 100% 60%)',
  lucky: 'hsl(145 80% 50%)',
  ultra: 'hsl(280 90% 65%)',
};

export const PackOpeningAnimation = ({ isOpen, onComplete, packType = 'free', packId }: PackOpeningAnimationProps) => {
  const { play } = useSfx();

  const mainImg = useMemo(() => {
    if (packType === 'ultra') return packUltraImg;
    if (packType === 'lucky') return packLuckyImg;
    return packSachetImg;
  }, [packType]);
  
  const [tapCount, setTapCount] = useState(0);
  const [isTearing, setIsTearing] = useState(false);
  const packRef = useRef<HTMLDivElement>(null);

  const glowColor = GLOW_COLORS[packType] || GLOW_COLORS.free;

  const ambientParticles = useMemo(() => {
    return Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      width: Math.random() * 3 + 1,
      height: Math.random() * 3 + 1,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      duration: 10 + Math.random() * 10,
      delay: -(Math.random() * 10),
    }));
  }, []);

  // Burst particles generated once per opening
  const burstParticles = useRef(
    Array.from({ length: 36 }).map(() => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 120 + Math.random() * 260;
      return {
        bx: Math.cos(angle) * dist,
        by: Math.sin(angle) * dist,
        size: 3 + Math.random() * 7,
        delay: Math.random() * 0.15,
      };
    })
  ).current;

  // Reset state when a new pack is opened
  useEffect(() => {
    if (isOpen) {
      setTapCount(0);
      setIsTearing(false);
    }
  }, [isOpen]);

  const vibrate = useCallback((pattern: number | number[]) => {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* haptics unsupported */
    }
  }, []);

  // Shake logic
  const triggerShake = useCallback(() => {
    if (!packRef.current) return;
    const intensity = tapCount * 3 + 2;
    packRef.current.animate(
      [
        { transform: 'translate(0,0) rotate(0deg) scale(1)' },
        { transform: `translate(-${intensity}px, ${intensity}px) rotate(-2deg) scale(1.04)` },
        { transform: `translate(${intensity}px, -${intensity}px) rotate(2deg) scale(0.99)` },
        { transform: `translate(-${intensity / 2}px, -${intensity / 2}px) rotate(-1deg) scale(1.02)` },
        { transform: 'translate(0,0) rotate(0deg) scale(1)' },
      ],
      { duration: 380, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
    );
  }, [tapCount]);

  const handleTap = useCallback(() => {
    if (isTearing) return;

    const newCount = tapCount + 1;
    setTapCount(newCount);

    if (newCount < 3) {
      play('packTap');
      vibrate(newCount === 1 ? 25 : 45);
      triggerShake();
    } else {
      // Climax
      play('packTear');
      vibrate([0, 40, 60, 120]);
      setIsTearing(true);
      setTimeout(() => {
        onComplete();
      }, 950);
    }
  }, [tapCount, isTearing, onComplete, triggerShake, play, vibrate]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden premium-bg"
      style={{ touchAction: 'none', cursor: 'pointer' }}
      onClick={handleTap}
    >
      {/* Floating ambient particles (always on) */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-30">
        {ambientParticles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full bg-white"
            style={{
              width: p.width,
              height: p.height,
              left: p.left,
              top: p.top,
              animation: `ambient-drift ${p.duration}s linear infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Rising background glow with each tap */}
      <div
        className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${glowColor} 0%, transparent 55%)`,
          opacity: tapCount * 0.12,
        }}
      />

      {/* Climax: full screen flash + light burst */}
      {isTearing && (
        <>
          <div
            className="absolute inset-0 z-30 pointer-events-none pack-screen-flash"
            style={{ background: `radial-gradient(circle at 50% 50%, white 0%, ${glowColor} 40%, transparent 75%)` }}
          />
          <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
            <div
              className="rounded-full premium-core-light"
              style={{ background: `radial-gradient(circle, white 0%, ${glowColor} 45%, transparent 70%)` }}
            />
          </div>
          {/* Particle explosion */}
          <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center">
            {burstParticles.map((p, i) => (
              <div
                key={i}
                className="absolute rounded-full pack-burst-particle"
                style={
                  {
                    width: p.size,
                    height: p.size,
                    background: i % 3 === 0 ? 'white' : glowColor,
                    boxShadow: `0 0 12px ${glowColor}`,
                    animationDelay: `${p.delay}s`,
                    ['--bx' as string]: `${p.bx}px`,
                    ['--by' as string]: `${p.by}px`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        </>
      )}

      <div ref={packRef} className="relative z-20 pointer-events-none flex items-center justify-center">
        {!isTearing ? (
          <div className={`relative ${tapCount >= 2 ? 'pack-pre-tear-shake' : ''}`}>
            {/* Energy Aura building up */}
            <div
              className="absolute inset-0 rounded-full transition-all duration-300"
              style={{
                background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
                filter: 'blur(30px)',
                opacity: tapCount * 0.4,
                transform: `scale(${1 + tapCount * 0.25})`,
              }}
            />
            <img
              src={mainImg}
              alt="Pack"
              className="w-80 h-auto select-none relative z-10 transition-transform duration-300"
              style={{
                filter: `drop-shadow(0 10px 25px rgba(0,0,0,0.8)) drop-shadow(0 0 ${tapCount * 14}px ${glowColor})`,
                transform: `scale(${1 + tapCount * 0.06})`,
              }}
              draggable={false}
            />
          </div>
        ) : (
          <div className="relative w-80 flex flex-col items-center justify-center">

            {/* Top slice flying off */}
            <div 
              className="w-80 absolute top-0 z-10 premium-tear-top"
              style={{
                clipPath: 'polygon(0% 0%, 100% 0%, 100% 18%, 95% 15%, 90% 19%, 85% 14%, 80% 18%, 75% 15%, 70% 19%, 65% 14%, 60% 18%, 55% 15%, 50% 19%, 45% 14%, 40% 18%, 35% 15%, 30% 19%, 25% 14%, 20% 18%, 15% 15%, 10% 19%, 5% 14%, 0% 18%)',
                filter: 'drop-shadow(0 10px 25px rgba(0,0,0,0.8))'
              }}
            >
              <img src={mainImg} alt="" className="w-full h-auto select-none" draggable={false} />
            </div>

            {/* Bottom slice dropping down */}
            <div 
              className="w-80 absolute top-0 z-10 premium-tear-bottom"
              style={{
                clipPath: 'polygon(0% 18%, 5% 14%, 10% 19%, 15% 15%, 20% 18%, 25% 14%, 30% 19%, 35% 15%, 40% 18%, 45% 14%, 50% 19%, 55% 15%, 60% 18%, 65% 14%, 70% 19%, 75% 15%, 80% 18%, 85% 14%, 90% 19%, 95% 15%, 100% 18%, 100% 100%, 0% 100%)',
                filter: 'drop-shadow(0 10px 25px rgba(0,0,0,0.8))'
              }}
            >
              <img src={mainImg} alt="" className="w-full h-auto select-none" draggable={false} />
            </div>
            
            {/* To keep layout spacing */}
            <img src={mainImg} alt="" className="w-80 h-auto opacity-0" />
          </div>
        )}
      </div>

      {/* Tap indicator */}
      {!isTearing && (
        <div className="z-20 mt-16 flex flex-col items-center gap-4 pointer-events-none">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-white/50 animate-pulse">
            {tapCount === 0 ? 'Appuyez pour ouvrir' : tapCount === 1 ? 'Encore...' : 'Presque !'}
          </p>
          <div className="flex gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: i < tapCount ? 'white' : 'rgba(255,255,255,0.1)',
                  boxShadow: i < tapCount ? `0 0 10px white, 0 0 20px ${glowColor}` : 'none',
                  transform: i < tapCount ? 'scale(1.3)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
