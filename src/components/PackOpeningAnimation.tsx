import { useState, useCallback, useRef, useEffect } from 'react';
import packSachetImg from '@/assets/pack-sachet.png';
import packSachetTopImg from '@/assets/pack-sachet-top.png';
import packSachetBottomImg from '@/assets/pack-sachet-bottom.png';
import packUltraImg from '@/assets/pack-ultra.png';
import packUltraTopImg from '@/assets/pack-ultra-top.png';
import packUltraBottomImg from '@/assets/pack-ultra-bottom.png';
import packLuckyImg from '@/assets/pack-lucky.png';
import packLuckyTopImg from '@/assets/pack-lucky-top.png';
import packLuckyBottomImg from '@/assets/pack-lucky-bottom.png';

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
  const getImageUrl = (suffix: string = '') => {
    let base = 'pack-sachet';
    if (packId) {
      base = `pack-${packId.replace('_', '-')}`;
    } else if (packType) {
      if (packType === 'ultra') base = 'pack-ultra';
      else if (packType === 'lucky') base = 'pack-lucky';
      else base = 'pack-sachet';
    }
    return new URL(`../assets/${base}${suffix}.png`, import.meta.url).href;
  };

  const sachetImg = getImageUrl('');
  const topImg = getImageUrl('-top');
  const bottomImg = getImageUrl('-bottom');
  
  const [tapCount, setTapCount] = useState(0);
  const [isTearing, setIsTearing] = useState(false);
  const packRef = useRef<HTMLDivElement>(null);
  
  const glowColor = GLOW_COLORS[packType] || GLOW_COLORS.free;

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
      triggerShake();
    } else {
      // Climax
      setIsTearing(true);
      setTimeout(() => {
        onComplete();
      }, 800); // Snappy reveal before the pieces fully disappear
    }
  }, [tapCount, isTearing, onComplete, triggerShake]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden premium-bg"
      style={{ touchAction: 'none', cursor: 'pointer' }}
      onClick={handleTap}
    >
      {/* Floating ambient particles (always on) */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-30">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 3 + 1,
              height: Math.random() * 3 + 1,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `ambient-drift ${10 + Math.random() * 10}s linear infinite`,
              animationDelay: `-${Math.random() * 10}s`,
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
              src={sachetImg}
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
            <div className="w-80 absolute top-0 z-10 premium-tear-top">
              <img src={topImg} alt="" className="w-full h-auto select-none" draggable={false} />
            </div>

            {/* Bottom slice dropping down */}
            <div className="w-80 absolute top-0 z-10 premium-tear-bottom">
              <img src={bottomImg} alt="" className="w-full h-auto select-none" draggable={false} />
            </div>
            
            {/* To keep layout spacing */}
            <img src={sachetImg} alt="" className="w-80 h-auto opacity-0" />
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
