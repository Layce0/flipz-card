import { memo } from 'react';

/**
 * Luck Boost Icon — Golden 4-leaf clover with animated pulse aura.
 * Used in ActiveBoostsOverlay and WinstreakDialog.
 */
export const LuckBoostIcon = memo(({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
    {/* Pulse aura behind the icon */}
    <div
      className="absolute inset-[-30%] rounded-full"
      style={{
        background: 'radial-gradient(circle, hsl(45 95% 60% / 0.5) 0%, hsl(45 95% 60% / 0) 70%)',
        animation: 'boost-icon-pulse 2s ease-in-out infinite',
      }}
    />
    <svg
      viewBox="0 0 48 48"
      fill="none"
      width={size}
      height={size}
      className="relative z-10 drop-shadow-[0_0_6px_hsl(45_95%_55%_/_0.8)]"
    >
      {/* Clover leaves */}
      <path
        d="M24 22C24 22 18 16 18 12C18 8 21 6 24 10C27 6 30 8 30 12C30 16 24 22 24 22Z"
        fill="url(#luck-grad-top)"
        stroke="hsl(45 100% 70%)"
        strokeWidth="0.8"
      />
      <path
        d="M26 24C26 24 32 18 36 18C40 18 42 21 38 24C42 27 40 30 36 30C32 30 26 24 26 24Z"
        fill="url(#luck-grad-right)"
        stroke="hsl(45 100% 70%)"
        strokeWidth="0.8"
      />
      <path
        d="M24 26C24 26 30 32 30 36C30 40 27 42 24 38C21 42 18 40 18 36C18 32 24 26 24 26Z"
        fill="url(#luck-grad-bottom)"
        stroke="hsl(45 100% 70%)"
        strokeWidth="0.8"
      />
      <path
        d="M22 24C22 24 16 30 12 30C8 30 6 27 10 24C6 21 8 18 12 18C16 18 22 24 22 24Z"
        fill="url(#luck-grad-left)"
        stroke="hsl(45 100% 70%)"
        strokeWidth="0.8"
      />
      {/* Center dot */}
      <circle cx="24" cy="24" r="2.5" fill="hsl(45 100% 75%)" />
      {/* Stem */}
      <path
        d="M24 28C24 28 25 34 27 38"
        stroke="hsl(45 80% 45%)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Sparkle accents */}
      <circle cx="15" cy="11" r="1" fill="hsl(45 100% 85%)" opacity="0.7">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <circle cx="37" cy="14" r="0.8" fill="hsl(45 100% 85%)" opacity="0.5">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="2.2s" repeatCount="indefinite" />
      </circle>
      <circle cx="35" cy="37" r="0.7" fill="hsl(45 100% 85%)" opacity="0.6">
        <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
      </circle>
      {/* Gradients */}
      <defs>
        <linearGradient id="luck-grad-top" x1="24" y1="6" x2="24" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="hsl(50 100% 70%)" />
          <stop offset="100%" stopColor="hsl(40 90% 50%)" />
        </linearGradient>
        <linearGradient id="luck-grad-right" x1="42" y1="24" x2="26" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="hsl(50 100% 70%)" />
          <stop offset="100%" stopColor="hsl(40 90% 50%)" />
        </linearGradient>
        <linearGradient id="luck-grad-bottom" x1="24" y1="42" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="hsl(50 100% 70%)" />
          <stop offset="100%" stopColor="hsl(40 90% 50%)" />
        </linearGradient>
        <linearGradient id="luck-grad-left" x1="6" y1="24" x2="22" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="hsl(50 100% 70%)" />
          <stop offset="100%" stopColor="hsl(40 90% 50%)" />
        </linearGradient>
      </defs>
    </svg>
  </div>
));

LuckBoostIcon.displayName = 'LuckBoostIcon';

/**
 * Pack Boost Icon — Stacked cards with animated shimmer "+" symbols.
 * Used in ActiveBoostsOverlay and WinstreakDialog.
 */
export const PackBoostIcon = memo(({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
    {/* Pulse aura behind the icon */}
    <div
      className="absolute inset-[-30%] rounded-full"
      style={{
        background: 'radial-gradient(circle, hsl(260 70% 60% / 0.45) 0%, hsl(260 70% 60% / 0) 70%)',
        animation: 'boost-icon-pulse 2s ease-in-out infinite 0.5s',
      }}
    />
    <svg
      viewBox="0 0 48 48"
      fill="none"
      width={size}
      height={size}
      className="relative z-10 drop-shadow-[0_0_6px_hsl(260_70%_60%_/_0.8)]"
    >
      {/* Back card (tilted left) */}
      <rect
        x="8" y="10" width="22" height="30" rx="3"
        fill="url(#pack-grad-back)"
        stroke="hsl(260 60% 70%)"
        strokeWidth="0.8"
        transform="rotate(-8 19 25)"
        opacity="0.7"
      />
      {/* Middle card (tilted right) */}
      <rect
        x="18" y="8" width="22" height="30" rx="3"
        fill="url(#pack-grad-mid)"
        stroke="hsl(260 60% 75%)"
        strokeWidth="0.8"
        transform="rotate(5 29 23)"
        opacity="0.85"
      />
      {/* Front card */}
      <rect
        x="13" y="9" width="22" height="30" rx="3"
        fill="url(#pack-grad-front)"
        stroke="hsl(260 80% 80%)"
        strokeWidth="1"
      />
      {/* Card pattern lines on front card */}
      <line x1="17" y1="16" x2="31" y2="16" stroke="hsl(260 50% 70% / 0.3)" strokeWidth="0.8" />
      <line x1="17" y1="20" x2="31" y2="20" stroke="hsl(260 50% 70% / 0.3)" strokeWidth="0.8" />
      <line x1="17" y1="24" x2="27" y2="24" stroke="hsl(260 50% 70% / 0.3)" strokeWidth="0.8" />
      {/* "+" symbol on front card */}
      <g>
        <line x1="24" y1="28" x2="24" y2="36" stroke="hsl(45 100% 70%)" strokeWidth="2.5" strokeLinecap="round">
          <animate attributeName="opacity" values="0.6;1;0.6" dur="1.5s" repeatCount="indefinite" />
        </line>
        <line x1="20" y1="32" x2="28" y2="32" stroke="hsl(45 100% 70%)" strokeWidth="2.5" strokeLinecap="round">
          <animate attributeName="opacity" values="0.6;1;0.6" dur="1.5s" repeatCount="indefinite" />
        </line>
      </g>
      {/* Sparkle accents */}
      <circle cx="35" cy="10" r="1.2" fill="hsl(45 100% 80%)">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
        <animate attributeName="r" values="0.8;1.4;0.8" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="10" cy="38" r="0.9" fill="hsl(280 80% 80%)">
        <animate attributeName="opacity" values="0.4;1;0.4" dur="1.7s" repeatCount="indefinite" />
      </circle>
      {/* Gradients */}
      <defs>
        <linearGradient id="pack-grad-back" x1="19" y1="10" x2="19" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="hsl(260 50% 30%)" />
          <stop offset="100%" stopColor="hsl(270 40% 20%)" />
        </linearGradient>
        <linearGradient id="pack-grad-mid" x1="29" y1="8" x2="29" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="hsl(260 55% 35%)" />
          <stop offset="100%" stopColor="hsl(270 45% 25%)" />
        </linearGradient>
        <linearGradient id="pack-grad-front" x1="24" y1="9" x2="24" y2="39" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="hsl(260 60% 40%)" />
          <stop offset="100%" stopColor="hsl(270 50% 28%)" />
        </linearGradient>
      </defs>
    </svg>
  </div>
));

PackBoostIcon.displayName = 'PackBoostIcon';
