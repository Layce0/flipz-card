import React from 'react';
import { cn } from '@/lib/utils';
import cloverBaseImg from '@/assets/boost-luck.png';
import packBoostImg from '@/assets/boost-pack.png';

interface PotionIconProps {
  type: 'boost_luck' | 'boost_pack' | string;
  multiplier?: number;
  config?: Record<string, any>;
  className?: string;
  size?: number;
}

/**
 * Clover Luck Boost Icon with dynamic multiplier badge
 */
export const LuckPotionBottle: React.FC<{ size?: number; multiplier?: number; className?: string }> = ({ 
  size = 64, 
  multiplier = 2,
  className 
}) => {
  const multText = `x${multiplier}`.replace('.', ',');

  return (
    <div 
      className={cn("relative flex items-center justify-center select-none", className)}
      style={{ width: size, height: size }}
    >
      <img
        src={cloverBaseImg}
        alt="Boost Luck"
        className="w-full h-full object-contain filter drop-shadow-[0_0_12px_rgba(74,222,128,0.55)] transform hover:scale-105 transition-transform"
        draggable={false}
      />
      {/* Badge showing the exact multiplier */}
      <div 
        className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md font-black tracking-tighter text-white bg-black/85 border border-white/60 shadow-[0_2px_8px_rgba(0,0,0,0.8)] leading-none select-none"
        style={{
          fontSize: Math.max(9, Math.round(size * 0.22)),
          textShadow: '0 0 4px #000, 0 1px 2px #000',
        }}
      >
        {multText}
      </div>
    </div>
  );
};

/**
 * Cards / Pack Boost Icon with custom card pouch artwork and bonus badge
 */
export const PackPotionBottle: React.FC<{ size?: number; config?: Record<string, any>; className?: string }> = ({ 
  size = 64, 
  config,
  className 
}) => {
  let badgeText = '';
  if (config?.bonus) {
    badgeText = `+${config.bonus}`;
  } else if (config?.multiplier) {
    badgeText = `x${config.multiplier}`.replace('.', ',');
  }

  return (
    <div 
      className={cn("relative flex items-center justify-center select-none", className)}
      style={{ width: size, height: size }}
    >
      <img
        src={packBoostImg}
        alt="Boost Pack"
        className="w-full h-full object-contain filter drop-shadow-[0_0_12px_rgba(168,85,247,0.6)] transform hover:scale-105 transition-transform"
        draggable={false}
      />
      {badgeText && (
        <div 
          className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md font-black tracking-tighter text-white bg-purple-950/90 border border-purple-400 shadow-[0_2px_8px_rgba(0,0,0,0.8)] leading-none select-none"
          style={{
            fontSize: Math.max(9, Math.round(size * 0.22)),
            textShadow: '0 0 4px #000, 0 1px 2px #000',
          }}
        >
          {badgeText}
        </div>
      )}
    </div>
  );
};

export const PotionBottle: React.FC<PotionIconProps> = ({ type, config, multiplier, size = 56, className }) => {
  if (type === 'boost_luck') {
    const mult = multiplier || config?.multiplier || 2;
    return <LuckPotionBottle size={size} multiplier={mult} className={className} />;
  }
  return <PackPotionBottle size={size} config={config} className={className} />;
};
