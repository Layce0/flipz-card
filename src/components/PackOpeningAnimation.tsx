import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSfx } from '@/hooks/useSfx';

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

// Component removed to keep the opening clean

export const PackOpeningAnimation = ({ isOpen, onComplete, packType = 'free', packId }: PackOpeningAnimationProps) => {
  const { play } = useSfx();
  const getImageUrl = () => {
    let base = 'pack-sachet';
    
    // Tous les packs standards utilisent l'animation de base (le sachet)
    if (packType === 'standard' || packType === 'free') {
      base = 'pack-sachet';
    } else if (packType === 'ultra') {
      base = 'pack-ultra';
    } else if (packType === 'lucky') {
      base = 'pack-lucky';
    }
    
    return new URL(`../assets/${base}.png`, import.meta.url).href;
  };

  const mainImg = getImageUrl();
  
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

  // Reset state when a new pack is opened
  useEffect(() => {
    if (isOpen) {
      setTapCount(0);
      setIsTearing(false);
    }
  }, [isOpen]);

  // Shake logic
  const triggerShake = useCallback(() => {
    if (!packRef.current) return;
    const intensity = tapCount * 2;
    packRef.current.animate([
      { transform: 'translate(0,0) rotate(0deg)' },
      { transform: `translate(-${intensity}px, ${intensity}px) rotate(-1deg)` },
      { transform: `translate(${intensity}px, -${intensity}px) rotate(1deg)` },
      { transform: `translate(-${intensity/2}px, -${intensity/2}px) rotate(0deg)` },
      { transform: 'translate(0,0) rotate(0deg)' }
    ], { duration: 300, easing: 'ease-out' });
  }, [tapCount]);

  const handleTap = useCallback(() => {
    if (isTearing) return;

    const newCount = tapCount + 1;
    setTapCount(newCount);
    
    if (newCount < 3) {
      play('packTap');
      triggerShake();
    } else {
      // Climax
      play('packTear');
      setIsTearing(true);
      setTimeout(() => {
        onComplete();
      }, 800); // Snappy reveal before the pieces fully disappear
    }
  }, [tapCount, isTearing, onComplete, triggerShake, play]);

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

      <div ref={packRef} className="relative z-20 pointer-events-none flex items-center justify-center">
        {!isTearing ? (
          <div className="relative">
            {/* Energy Aura building up */}
            <div 
              className="absolute inset-0 rounded-full transition-all duration-300"
              style={{
                background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
                filter: 'blur(30px)',
                opacity: tapCount * 0.3,
                transform: `scale(${1 + tapCount * 0.2})`,
              }}
            />
            <img
              src={mainImg}
              alt="Pack"
              className="w-80 h-auto select-none relative z-10 transition-transform duration-300"
              style={{
                filter: `drop-shadow(0 10px 25px rgba(0,0,0,0.8))`,
                transform: `scale(${1 + tapCount * 0.05})`,
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
            Appuyez pour ouvrir
          </p>
          <div className="flex gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: i < tapCount ? 'white' : 'rgba(255,255,255,0.1)',
                  boxShadow: i < tapCount ? `0 0 10px white, 0 0 20px ${glowColor}` : 'none',
                  transform: i < tapCount ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
