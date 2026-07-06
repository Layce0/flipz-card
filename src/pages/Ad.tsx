import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { 
  Sparkles, Clock, Star, Gift, Smartphone, Gamepad2, 
  Volume2, VolumeX, RotateCcw, Trophy, ArrowDown, ChevronRight, Pointer, Flame
} from 'lucide-react';

// Imports d'actifs locaux
import packUltraImg from '@/assets/pack-ultra.png';
import packUltraTopCapImg from '@/assets/pack-ultra-top-cap.png';
import packUltraBottomBodyImg from '@/assets/pack-ultra-bottom-body.png';
import cardBackImage from '@/assets/card-back.png';

interface Card {
  id: number;
  title: string;
  rarity: 'common' | 'rare' | 'legendary';
  image: string;
  description: string;
  flipped: boolean;
  revealed: boolean;
}

// Composant de Ticker défilant de tirages fictifs
const LiveTicker = () => {
  const TickerContent = () => (
    <>
      <span className="flex items-center gap-1.5"><span className="text-red-500 animate-pulse">🔥</span> @layce a obtenu <strong className="text-yellow-400 font-black">GigaChad Suprême</strong> (Légendaire) !</span>
      <span className="text-white/20">•</span>
      <span className="flex items-center gap-1.5"><span className="text-blue-400">✨</span> Sophie a tiré <strong className="text-blue-400 font-semibold">Le Shibe Béni</strong> (Rare) !</span>
      <span className="text-white/20">•</span>
      <span className="flex items-center gap-1.5"><span className="text-zinc-400">⚡️</span> User922 a débloqué <span className="text-zinc-300">Le Wojak Fatigué</span> (Commun) !</span>
      <span className="text-white/20">•</span>
      <span className="flex items-center gap-1.5"><span className="text-red-500 animate-pulse">🔥</span> Alex a obtenu <strong className="text-yellow-400 font-black">GigaChad Suprême</strong> (Légendaire) !</span>
      <span className="text-white/20">•</span>
      <span className="flex items-center gap-1.5"><span className="text-blue-400">✨</span> Thomas a tiré <strong className="text-blue-400 font-semibold">Le Shibe Béni</strong> (Rare) !</span>
      <span className="text-white/20">•</span>
    </>
  );

  return (
    <div className="absolute top-0 left-0 right-0 z-40 bg-black/60 backdrop-blur-md border-b border-white/5 py-2.5 overflow-hidden select-none">
      <div className="flex whitespace-nowrap gap-8 text-[10px] sm:text-xs font-bold uppercase tracking-[0.15em] text-white/90">
        <div className="flex gap-8 shrink-0 animate-[ticker_25s_linear_infinite]">
          <TickerContent />
        </div>
        <div className="flex gap-8 shrink-0 animate-[ticker_25s_linear_infinite]" aria-hidden="true">
          <TickerContent />
        </div>
      </div>
    </div>
  );
};

// Composant Canvas performant pour les étincelles d'ouverture et d'ambiance
const ParticleCanvas = ({ 
  active, 
  triggerExplosion, 
  emitterX, 
  emitterY, 
  onExplosionDone 
}: { 
  active: boolean; 
  triggerExplosion: boolean; 
  emitterX: number; 
  emitterY: number;
  onExplosionDone?: () => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<any[]>([]);
  const animationRef = useRef<number | null>(null);

  // Fonction pour faire jaillir l'explosion d'étincelles or
  const spawnExplosion = useCallback((x: number, y: number) => {
    const count = 120;
    const colors = [
      '#FFD700', // Gold
      '#F0E68C', // Khaki
      '#DAA520', // Goldenrod
      '#FFF8DC', // Cornsilk
      '#FF8C00', // Dark Orange
      '#FFFFFF'  // White spark
    ];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 9;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.5, // Force de poussée vers le haut
        size: 2 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: 0.01 + Math.random() * 0.02,
        gravity: 0.16,
        friction: 0.98,
        spin: Math.random() * Math.PI,
        spinSpeed: -0.1 + Math.random() * 0.2
      });
    }
  }, []);

  // Étoiles d'ambiance qui montent lentement
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const colors = ['#FFD700', '#DAA520', '#FF8C00', '#D8B4FE'];
      particlesRef.current.push({
        x: Math.random() * canvas.width,
        y: canvas.height + 10,
        vx: -0.4 + Math.random() * 0.8,
        vy: -0.8 - Math.random() * 1.5,
        size: 1 + Math.random() * 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.4 + Math.random() * 0.6,
        decay: 0.001 + Math.random() * 0.003,
        gravity: -0.005, // S'élève
        friction: 0.99,
        spin: 0,
        spinSpeed: 0,
        wiggle: Math.random() * 10,
        wiggleSpeed: 0.01 + Math.random() * 0.02
      });
    }, 60);
    return () => clearInterval(interval);
  }, [active]);

  // Déclencher l'explosion
  useEffect(() => {
    if (triggerExplosion) {
      spawnExplosion(emitterX, emitterY);
      if (onExplosionDone) {
        setTimeout(onExplosionDone, 800);
      }
    }
  }, [triggerExplosion, emitterX, emitterY, spawnExplosion, onExplosionDone]);

  // Boucle de rendu Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const particles = particlesRef.current;
      
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vx *= p.friction;
        p.vy *= p.friction;
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        
        if (p.wiggle !== undefined) {
          p.wiggle += p.wiggleSpeed;
          p.x += Math.sin(p.wiggle) * 0.4;
        }

        p.spin += p.spinSpeed;
        p.alpha -= p.decay;

        if (p.alpha <= 0 || p.y < -10 || p.y > canvas.height + 20 || p.x < -10 || p.x > canvas.width + 10) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = p.size * 2;
        ctx.shadowColor = p.color;
        
        ctx.translate(p.x, p.y);
        if (p.spin !== 0) {
          ctx.rotate(p.spin);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.restore();
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none z-30" />;
};

const Ad = () => {
  const [mounted, setMounted] = useState(false);
  const [stage, setStage] = useState<'booster' | 'cards' | 'climax' | 'dashboard'>('booster');
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // NOUVEAU : Mode promo vidéo automatisé (VRAI par défaut pour la capture vidéo)
  const [promoMode, setPromoMode] = useState(true);
  const [handPos, setHandPos] = useState({ x: '50%', y: '65%', opacity: 0, scale: 1.1 });
  const promoTimeoutsRef = useRef<number[]>([]);

  // États pour le booster pack
  const [packTaps, setPackTaps] = useState(0);
  const [packShaking, setPackShaking] = useState(false);
  const [packTorn, setPackTorn] = useState(false);
  
  // États pour l'explosion et la position de déchirure
  const [triggerExplosion, setTriggerExplosion] = useState(false);
  const [explosionCoords, setExplosionCoords] = useState({ x: 0, y: 0 });

  // Deck de 3 cartes pré-configurées pour la publicité jouable
  const [cards, setCards] = useState<Card[]>([
    {
      id: 1,
      title: "Le Wojak Fatigué",
      rarity: "common",
      image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop",
      description: "A passé la nuit blanche à développer sa collection de cartes sur Flipz.",
      flipped: false,
      revealed: false
    },
    {
      id: 3, // Placé au centre
      title: "GigaChad Suprême",
      rarity: "legendary",
      image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop",
      description: "Ne refuse jamais un défi quotidien. Son charisme est légendaire.",
      flipped: false,
      revealed: false
    },
    {
      id: 2,
      title: "Le Shibe Béni",
      rarity: "rare",
      image: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&auto=format&fit=crop",
      description: "Apporte la chance absolue, de grands rires et des croquettes.",
      flipped: false,
      revealed: false
    }
  ]);

  const [cardsEmerging, setCardsEmerging] = useState(false);
  const [legendaryRevealed, setLegendaryRevealed] = useState(false);
  const [whiteFlash, setWhiteFlash] = useState(false);
  const [shockwaveActive, setShockwaveActive] = useState(false);
  const [shockwaveCoords, setShockwaveCoords] = useState({ x: 0, y: 0 });
  const [showGoldRain, setShowGoldRain] = useState(false);
  
  // Tableau de bord final
  const [claimTriggered, setClaimTriggered] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const boosterRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Initialisation ou reprise du contexte audio lors d'un geste utilisateur
  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  // Synthétiseur d'effets sonores Web Audio API en temps réel
  const playSynthSound = useCallback((type: 'tick' | 'tear' | 'common' | 'rare' | 'legendary') => {
    if (!soundEnabled) return;
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    const now = ctx.currentTime;
    
    if (type === 'tick') {
      // Un click sec et percutant
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(now + 0.08);
    } 
    else if (type === 'tear') {
      // Bruit de déchirement de sachet synthétisé via du bruit blanc filtré
      const bufferSize = ctx.sampleRate * 0.5;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(200, now + 0.45);
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      noise.start();
      noise.stop(now + 0.45);

      // Sous-basses d'impact pour accompagner le bruit blanc
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(140, now);
      sub.frequency.exponentialRampToValueAtTime(50, now + 0.35);
      subGain.gain.setValueAtTime(0.25, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      sub.connect(subGain);
      subGain.connect(ctx.destination);
      sub.start();
      sub.stop(now + 0.35);
    } 
    else if (type === 'common') {
      // Arpège ascendant court
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);
        gain.gain.setValueAtTime(0.05 / notes.length, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.25);
      });
    } 
    else if (type === 'rare') {
      // Accord cristallin brillant avec vibrato
      const notes = [440.00, 554.37, 659.25, 880.00]; // A4, C#5, E5, A5
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        
        gain.gain.setValueAtTime(0.07 / notes.length, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.5);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.5);
      });
    } 
    else if (type === 'legendary') {
      // Bass Drop cinématographique lourd + Fanfare Sawtooth triomphale
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(90, now);
      sub.frequency.exponentialRampToValueAtTime(30, now + 1.8);
      subGain.gain.setValueAtTime(0.35, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
      sub.connect(subGain);
      subGain.connect(ctx.destination);
      sub.start();
      sub.stop(now + 1.8);

      const notes = [196.00, 293.66, 392.00, 493.88, 587.33, 783.99, 987.77]; // Accord G Maj divin
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        
        // Balayage de filtre lowpass pour un effet cinématographique chaud
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, now);
        filter.frequency.exponentialRampToValueAtTime(320, now + 2.0);
        
        gain.gain.setValueAtTime(0.15 / notes.length, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(now + 2.0);
      });
    }
  }, [soundEnabled]);

  // Démarrage initial
  useEffect(() => {
    setMounted(true);
  }, []);

  // Clic sur le Booster Pack (Étape 1)
  const handlePackTap = (e?: React.MouseEvent) => {
    if (packTorn) return;
    
    initAudio();
    const newTaps = packTaps + 1;
    setPackTaps(newTaps);
    
    // Position de l'explosion d'étincelles
    if (boosterRef.current) {
      const rect = boosterRef.current.getBoundingClientRect();
      setExplosionCoords({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height * 0.3 // Centre de déchirure théorique
      });
    }

    if (newTaps < 3) {
      // Petite secousse de booster
      setPackShaking(true);
      playSynthSound('tick');
      setTimeout(() => setPackShaking(false), 300);
    } else {
      // Déchirement final du booster !
      setPackTorn(true);
      playSynthSound('tear');
      setTriggerExplosion(true);
      
      // Emergence des cartes après déchirement
      setTimeout(() => {
        setCardsEmerging(true);
        setStage('cards');
      }, 700);
    }
  };

  // Révélation d'une carte (Étape 2 / 3)
  const handleCardFlip = (cardId: number, e?: React.MouseEvent) => {
    // Empêcher de retourner la légendaire en premier pour créer du suspense !
    const legendaryCard = cards.find(c => c.rarity === 'legendary');
    const unrevealedOthers = cards.filter(c => c.rarity !== 'legendary' && !c.flipped);
    
    if (cardId === legendaryCard?.id && unrevealedOthers.length > 0) {
      if (e) {
        const cardEl = e.currentTarget as HTMLDivElement;
        cardEl.classList.add('animate-pack-shake');
        playSynthSound('tick');
        setTimeout(() => cardEl.classList.remove('animate-pack-shake'), 400);
      }
      return;
    }

    setCards(prev => prev.map(c => {
      if (c.id === cardId && !c.flipped) {
        // Sons de révélation spécifiques
        if (c.rarity === 'common') {
          playSynthSound('common');
        } else if (c.rarity === 'rare') {
          playSynthSound('rare');
        } else if (c.rarity === 'legendary') {
          // CLIMAX LÉGENDAIRE !
          triggerLegendaryReveal(e);
        }
        return { ...c, flipped: true, revealed: true };
      }
      return c;
    }));
  };

  // Climax de la carte légendaire (Étape 3)
  const triggerLegendaryReveal = (e?: React.MouseEvent) => {
    if (e) {
      const rect = e.currentTarget.getBoundingClientRect();
      setShockwaveCoords({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      });
    } else {
      setShockwaveCoords({
        x: window.innerWidth / 2,
        y: window.innerHeight * 0.48
      });
    }

    setWhiteFlash(true);
    setShockwaveActive(true);
    playSynthSound('legendary');
    
    setTimeout(() => {
      setWhiteFlash(false);
      setLegendaryRevealed(true);
      setShowGoldRain(true);
    }, 150);

    setTimeout(() => {
      setShockwaveActive(false);
    }, 1000);
  };

  // Magnifique inclinaison 3D au survol de souris
  const handleMouseMoveCard = (e: React.MouseEvent<HTMLDivElement>) => {
    if (promoMode) return; // Désactiver l'inclinaison de souris manuelle en mode promo auto
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = -(y - centerY) / 6; // Axe X inversé
    const rotateY = (x - centerX) / 6;
    
    card.style.setProperty('--rx', `${rotateX}deg`);
    card.style.setProperty('--ry', `${rotateY}deg`);
    card.style.setProperty('--glare-x', `${(x / rect.width) * 100}%`);
    card.style.setProperty('--glare-y', `${(y / rect.height) * 100}%`);
    card.style.setProperty('--tz', '30px');
  };

  const handleMouseLeaveCard = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
    card.style.setProperty('--glare-x', '50%');
    card.style.setProperty('--glare-y', '50%');
    card.style.setProperty('--tz', '0px');
  };

  // Clic sur "Ajouter à la Collection" (Transition finale)
  const handleClaim = () => {
    setClaimTriggered(true);
    playSynthSound('rare');
    
    setTimeout(() => {
      setStage('dashboard');
    }, 1200);
  };

  // Relance du tirage
  const handleRestart = () => {
    setPackTaps(0);
    setPackTorn(false);
    setCardsEmerging(false);
    setLegendaryRevealed(false);
    setShowGoldRain(false);
    setClaimTriggered(false);
    setCards(prev => prev.map(c => ({ ...c, flipped: false, revealed: false })));
    setStage('booster');
  };

  // SEQUENCE DE DÉMONSTRATION AUTOMATIQUE (MODE PROMO VIDÉO INFINE)
  const startPromoMode = useCallback(() => {
    // Nettoyer les timeouts existants
    promoTimeoutsRef.current.forEach(t => clearTimeout(t));
    promoTimeoutsRef.current = [];

    handleRestart();

    const addTimeout = (fn: () => void, delay: number) => {
      const id = window.setTimeout(fn, delay);
      promoTimeoutsRef.current.push(id);
    };

    // Position initiale de la main sur l'écran
    setHandPos({ x: '50%', y: '65%', opacity: 0, scale: 1.1 });
    addTimeout(() => {
      setHandPos(prev => ({ ...prev, opacity: 1 }));
    }, 500);

    // TAP 1 sur Booster Pack (1.3s)
    addTimeout(() => {
      setHandPos({ x: '54%', y: '58%', opacity: 1, scale: 0.8 }); // Contraction clic
      setPackTaps(1);
      setPackShaking(true);
      playSynthSound('tick');
      setTimeout(() => setPackShaking(false), 300);
    }, 1300);

    addTimeout(() => {
      setHandPos(prev => ({ ...prev, scale: 1.1 })); // Relâchement
    }, 1500);

    // TAP 2 sur Booster Pack (2.1s)
    addTimeout(() => {
      setHandPos({ x: '53%', y: '60%', opacity: 1, scale: 0.8 });
      setPackTaps(2);
      setPackShaking(true);
      playSynthSound('tick');
      setTimeout(() => setPackShaking(false), 300);
    }, 2100);

    addTimeout(() => {
      setHandPos(prev => ({ ...prev, scale: 1.1 }));
    }, 2300);

    // TAP 3 - DÉCHIREMENT DU BOOSTER (2.9s)
    addTimeout(() => {
      setHandPos({ x: '55%', y: '56%', opacity: 1, scale: 0.8 });
      
      if (boosterRef.current) {
        const rect = boosterRef.current.getBoundingClientRect();
        setExplosionCoords({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height * 0.3
        });
      }

      setPackTaps(3);
      setPackTorn(true);
      playSynthSound('tear');
      setTriggerExplosion(true);
      
      setTimeout(() => {
        setCardsEmerging(true);
        setStage('cards');
      }, 700);
    }, 2900);

    // Disparaître la main pendant l'envol des cartes
    addTimeout(() => {
      setHandPos(prev => ({ ...prev, opacity: 0 }));
    }, 3100);

    // GLISSER SUR CARTE 1 : Wojak Commun (Gauche)
    addTimeout(() => {
      // Wojak se situe vers left: 28%, top: 52%
      setHandPos({ x: '29%', y: '54%', opacity: 1, scale: 1.1 });
    }, 4500);

    // Cliquer Wojak (5.3s)
    addTimeout(() => {
      setHandPos({ x: '29%', y: '54%', opacity: 1, scale: 0.8 });
      setCards(prev => prev.map(c => c.id === 1 ? { ...c, flipped: true, revealed: true } : c));
      playSynthSound('common');
    }, 5300);

    addTimeout(() => {
      setHandPos(prev => ({ ...prev, scale: 1.1 }));
    }, 5500);

    // GLISSER SUR CARTE 2 : Shiba Rare (Droite)
    addTimeout(() => {
      // Shiba se situe vers left: 71%, top: 52%
      setHandPos({ x: '71%', y: '54%', opacity: 1, scale: 1.1 });
    }, 6600);

    // Cliquer Shiba (7.4s)
    addTimeout(() => {
      setHandPos({ x: '71%', y: '54%', opacity: 1, scale: 0.8 });
      setCards(prev => prev.map(c => c.id === 2 ? { ...c, flipped: true, revealed: true } : c));
      playSynthSound('rare');
    }, 7400);

    addTimeout(() => {
      setHandPos(prev => ({ ...prev, scale: 1.1 }));
    }, 7600);

    // GLISSER SUR CARTE 3 : GigaChad Légendaire (Centre)
    addTimeout(() => {
      // GigaChad se situe vers left: 50%, top: 48%
      setHandPos({ x: '50%', y: '48%', opacity: 1, scale: 1.1 });
    }, 8600);

    // Cliquer GigaChad - LE SHOCKWAVE CLIMAX ! (9.4s)
    addTimeout(() => {
      setHandPos({ x: '50%', y: '48%', opacity: 1, scale: 0.8 });
      setCards(prev => prev.map(c => c.id === 3 ? { ...c, flipped: true, revealed: true } : c));
      triggerLegendaryReveal();
    }, 9400);

    addTimeout(() => {
      setHandPos(prev => ({ ...prev, scale: 1.1 }));
    }, 9600);

    // GLISSER SUR LE BOUTON D'AJOUT "Tout Ajouter"
    addTimeout(() => {
      setHandPos({ x: '50%', y: '84%', opacity: 1, scale: 1.1 });
    }, 11500);

    // Cliquer "Tout Ajouter" (12.3s)
    addTimeout(() => {
      setHandPos({ x: '50%', y: '84%', opacity: 1, scale: 0.8 });
      setClaimTriggered(true);
      playSynthSound('rare');
      
      setTimeout(() => {
        setStage('dashboard');
      }, 1200);
    }, 12300);

    addTimeout(() => {
      setHandPos(prev => ({ ...prev, scale: 1.1 }));
    }, 12500);

    // GLISSER SUR LE BOUTON D'INSTALLATION APP STORE
    addTimeout(() => {
      setHandPos({ x: '50%', y: '63%', opacity: 1, scale: 1.1 });
    }, 14500);

    // Clic de démonstration de téléchargement
    addTimeout(() => {
      setHandPos({ x: '50%', y: '63%', opacity: 1, scale: 0.85 });
    }, 15300);

    addTimeout(() => {
      setHandPos({ x: '50%', y: '63%', opacity: 1, scale: 1.1 });
    }, 15600);

    // GLISSER SUR GOOGLE PLAY
    addTimeout(() => {
      setHandPos({ x: '50%', y: '72%', opacity: 1, scale: 1.1 });
    }, 17000);

    // Clic de démonstration Google Play
    addTimeout(() => {
      setHandPos({ x: '50%', y: '72%', opacity: 1, scale: 0.85 });
    }, 17800);

    addTimeout(() => {
      setHandPos({ x: '50%', y: '72%', opacity: 1, scale: 1.1 });
    }, 18100);

    // BOUCLE INFINIE : Relancer la séquence promo après 4 secondes d'exposition finale
    addTimeout(() => {
      startPromoMode();
    }, 22000);

  }, [cards, playSynthSound]);

  // Démarrer ou arrêter la séquence automatique selon promoMode
  useEffect(() => {
    if (promoMode) {
      startPromoMode();
    } else {
      // Annuler tous les timeouts
      promoTimeoutsRef.current.forEach(t => clearTimeout(t));
      promoTimeoutsRef.current = [];
      handleRestart();
    }
    return () => {
      promoTimeoutsRef.current.forEach(t => clearTimeout(t));
    };
  }, [promoMode, startPromoMode]);

  // Séparer les cartes pour un rendu ordonné (Gauche, Centre Légendaire, Droite)
  const sortedCards = useMemo(() => {
    // Ordre visuel : Wojak (1), GigaChad (3), Shibe (2)
    return [cards[0], cards[1], cards[2]];
  }, [cards]);

  const allFlipped = cards.every(c => c.flipped);

  // Déterminer intelligemment la prochaine carte à retourner (seulement en mode manuel)
  const nextCardIdToFlip = useMemo(() => {
    if (promoMode) return null;
    if (!cards[0].flipped) return cards[0].id;
    if (!cards[2].flipped) return cards[2].id;
    if (!cards[1].flipped) return cards[1].id;
    return null;
  }, [cards, promoMode]);

  return (
    <div className="relative min-h-screen w-full bg-[#050508] overflow-hidden flex flex-col justify-between font-display text-white select-none">
      
      {/* CSS d'animations personnalisées premium */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes spin-slow {
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes pack-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(1.5deg); }
        }
        .anim-pack-float {
          animation: pack-float 5s ease-in-out infinite;
        }
        .shake-light {
          animation: shake-light-keyframes 0.25s ease-in-out;
        }
        .shake-medium {
          animation: shake-medium-keyframes 0.3s ease-in-out;
        }
        @keyframes shake-light-keyframes {
          0%, 100% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(-2deg) scale(1.02); }
          75% { transform: rotate(2deg) scale(1.02); }
        }
        @keyframes shake-medium-keyframes {
          0%, 100% { transform: rotate(0deg) scale(1.04); }
          20% { transform: rotate(-4deg) scale(1.05) translateX(-3px); }
          40% { transform: rotate(4deg) scale(1.05) translateX(3px); }
          60% { transform: rotate(-2deg) scale(1.05) translateX(-2px); }
          80% { transform: rotate(2deg) scale(1.05) translateX(2px); }
        }
        @keyframes tear-top-fly {
          0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
          30% { transform: translateY(-30px) rotate(-3deg) scale(1.02); opacity: 1; }
          100% { transform: translateY(-240px) rotate(-15deg) scale(0.85); opacity: 0; }
        }
        @keyframes tear-bottom-sink {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          30% { transform: translateY(20px) scale(1.01); opacity: 1; }
          100% { transform: translateY(180px) scale(0.9); opacity: 0; }
        }
        .animate-tear-top {
          animation: tear-top-fly 1.1s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
        }
        .animate-tear-bottom {
          animation: tear-bottom-sink 1.1s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
        }
        .flip-card {
          perspective: 1200px;
          transform-style: preserve-3d;
        }
        .flip-card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          text-align: center;
          transition: transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          transform-style: preserve-3d;
        }
        .flip-card-inner.flipped {
          transform: rotateY(180deg);
        }
        .flip-card-front, .flip-card-back {
          position: absolute;
          width: 100%;
          height: 100%;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          border-radius: 1.2rem;
          overflow: hidden;
        }
        .flip-card-back {
          transform: rotateY(180deg);
        }
        .card-glare {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at var(--glare-x, 50%) var(--glare-y, 50%), rgba(255,255,255,0.2) 0%, transparent 60%);
          mix-blend-mode: overlay;
          pointer-events: none;
          z-index: 5;
        }
        .card-3d-hover {
          transform: perspective(1000px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) translateZ(var(--tz, 0px));
          transition: transform 0.15s ease-out, box-shadow 0.3s ease;
        }
        @keyframes legendary-hologram {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .legendary-hologram-effect::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,215,0,0) 20%, rgba(255,255,255,0.25) 45%, rgba(255,215,0,0.3) 50%, rgba(255,255,255,0.25) 55%, rgba(255,215,0,0) 80%);
          background-size: 250% 250%;
          mix-blend-mode: color-dodge;
          pointer-events: none;
          z-index: 4;
          animation: legendary-hologram 4s ease infinite;
        }
        @keyframes flash-out-anim {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        .animate-white-flash {
          animation: flash-out-anim 0.7s cubic-bezier(0.1, 0.9, 0.2, 1) forwards;
        }
        @keyframes expand-shockwave {
          0% { transform: translate(-50%, -50%) scale(0.1); opacity: 1; border-width: 8px; }
          50% { opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(3.5); opacity: 0; border-width: 0px; }
        }
        .animate-shockwave {
          animation: expand-shockwave 1.1s cubic-bezier(0.1, 0.8, 0.25, 1) forwards;
        }
        @keyframes emerge-cards-flow {
          0% { transform: translateY(120px) scale(0.6); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .animate-cards-emergence {
          animation: emerge-cards-flow 0.9s cubic-bezier(0.2, 0.8, 0.2, 1.15) forwards;
        }
        @keyframes collect-cards-anim {
          0% { transform: scale(1) translateY(0); opacity: 1; filter: blur(0); }
          50% { transform: scale(0.6) translateY(-100px); opacity: 0.8; filter: blur(1px); }
          100% { transform: scale(0) translateY(-300px); opacity: 0; filter: blur(4px); }
        }
        .animate-claim-fly {
          animation: collect-cards-anim 1.1s cubic-bezier(0.7, 0, 0.3, 1) forwards;
        }
        .premium-btn-shadow {
          box-shadow: 0 0 25px rgba(250, 204, 21, 0.2), inset 0 1px 1px rgba(255,255,255,0.3);
        }
        .btn-chrome-glint {
          position: relative;
          overflow: hidden;
        }
        .btn-chrome-glint::after {
          content: '';
          position: absolute;
          top: 0;
          left: -120%;
          width: 50%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
          transform: skewX(-20deg);
          animation: chrome-glint-sweep 4s ease infinite;
        }
        @keyframes chrome-glint-sweep {
          0% { left: -120%; }
          15%, 100% { left: 160%; }
        }
        @keyframes text-glow-pulse {
          0%, 100% { text-shadow: 0 0 10px rgba(250, 204, 21, 0.4), 0 0 20px rgba(250, 204, 21, 0.2); }
          50% { text-shadow: 0 0 25px rgba(250, 204, 21, 0.8), 0 0 45px rgba(250, 204, 21, 0.4); }
        }
        .legendary-text-pulse {
          animation: text-glow-pulse 2s ease-in-out infinite;
        }
        
        /* Animation de la main de tutoriel (utilisé seulement en manuel) */
        @keyframes hand-tap-keyframes {
          0%, 100% { transform: scale(1) translate(0, 0) rotate(0deg); }
          50% { transform: scale(0.8) translate(-6px, -6px) rotate(-5deg); }
        }
        .animate-hand-tap {
          animation: hand-tap-keyframes 1s ease-in-out infinite;
        }
      `}} />

      {/* Rendu des étincelles 60 FPS du Canvas */}
      <ParticleCanvas 
        active={legendaryRevealed} 
        triggerExplosion={triggerExplosion} 
        emitterX={explosionCoords.x} 
        emitterY={explosionCoords.y}
        onExplosionDone={() => setTriggerExplosion(false)}
      />

      {/* 🖐️ MAIN DE TUTORIEL ABSOLUTE (MODE PROMO AUTOMATISÉ) */}
      {promoMode && (
        <div 
          className="fixed pointer-events-none z-[100]"
          style={{ 
            left: handPos.x, 
            top: handPos.y, 
            opacity: handPos.opacity,
            transform: `translate(-50%, -50%) scale(${handPos.scale})`,
            transition: 'left 750ms ease-in-out, top 750ms ease-in-out, opacity 500ms ease-in-out, transform 200ms ease-in-out'
          }}
        >
          <Pointer className="w-12 h-12 text-white fill-white drop-shadow-[0_8px_20px_rgba(0,0,0,0.6)] -scale-x-100" />
        </div>
      )}

      {/* Flash Blanc du Climax Légendaire */}
      {whiteFlash && (
        <div className="fixed inset-0 bg-white z-[90] pointer-events-none animate-white-flash" />
      )}

      {/* Onde de Choc Circulaire */}
      {shockwaveActive && (
        <div 
          className="fixed z-50 rounded-full border-4 border-yellow-400 pointer-events-none animate-shockwave"
          style={{
            left: `${shockwaveCoords.x}px`,
            top: `${shockwaveCoords.y}px`,
            width: '100px',
            height: '100px'
          }}
        />
      )}

      {/* Arrière-plan profond et Beams de lumière */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/15 via-[#050508] to-[#010103] pointer-events-none" />
      <div className="absolute top-[40%] left-1/2 w-[160vw] h-[160vw] rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 mix-blend-screen opacity-10 bg-[conic-gradient(from_0deg,transparent_0%,rgba(250,204,21,0.06)_10%,transparent_20%,transparent_40%,rgba(216,180,254,0.04)_50%,transparent_60%,transparent_80%,rgba(250,204,21,0.06)_90%,transparent_100%)] animate-[spin-slow_24s_linear_infinite]" />

      {/* Barre de Tirages de la Communauté (Live Ticker) */}
      <LiveTicker />

      {/* En-tête : Logo Centré, Winstreak Badge (VRAIS DESIGNS FLIPZ) */}
      <header className="relative z-40 w-full flex items-center justify-between px-6 pt-16 sm:pt-20 pb-4">
        
        {/* NOUVEAU : Toggle de mode Démo Vidéo vs Mode Manuel */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setPromoMode(prev => !prev)}
            className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all duration-300 border shadow-lg ${
              promoMode 
                ? 'bg-red-600/90 text-white border-red-500 animate-pulse' 
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
          >
            {promoMode ? '🎥 Mode Vidéo' : '🎮 Mode Manuel'}
          </button>
        </div>

        {/* Logo Flipz */}
        <div className="flex-1 flex justify-center">
          <img 
            src="/flipz-logo-new.png" 
            alt="FLIPZ" 
            className="w-24 sm:w-32 object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] cursor-pointer"
            onClick={handleRestart}
          />
        </div>

        {/* NOUVEAU : Vrai design Flame Winstreak de l'application Flipz */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-500/25 via-amber-500/20 to-orange-500/25 border border-orange-400/50 backdrop-blur-md">
            <Flame className="w-4 h-4 text-orange-400 fill-orange-400" />
            <span className="text-sm font-bold text-orange-200 font-mono">7</span>
          </div>

          {/* Contrôle Sonore */}
          <button 
            onClick={() => setSoundEnabled(prev => !prev)}
            className="flex items-center justify-center p-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors shadow-lg active:scale-95"
            title={soundEnabled ? "Couper le son" : "Activer le son"}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
            ) : (
              <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-white/50" />
            )}
          </button>
        </div>
      </header>

      {/* =========================================
          STAGE 1 : LE BOOSTER PACK TACTILE
          ========================================= */}
      {stage === 'booster' && (
        <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-30">
          
          {/* NOUVEAU : VRAI DESIGN FLIPZ - Badge de Timer Clic disponible */}
          <div className="relative flex items-center gap-2 bg-[#12111a]/80 px-5 py-2 rounded-full mb-6 border border-[#a855f7]/30 shadow-[0_0_15px_rgba(168,85,247,0.2)] text-[10px] sm:text-xs font-bold tracking-wide">
            <Clock className="w-4 h-4 text-[#a855f7]" />
            <span className="text-zinc-300">Tirage quotidien disponible !</span>
          </div>

          <div className="text-center space-y-3 mb-10 max-w-sm sm:max-w-md">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full shadow-[0_4px_20px_rgba(250,204,21,0.1)]">
              <Gift className="w-3.5 h-3.5 text-yellow-400 animate-bounce" />
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-yellow-400/90">Pack Quotidien Gratuit</span>
            </div>
            
            <h2 className="text-2xl sm:text-4xl font-black uppercase leading-tight tracking-tight drop-shadow-lg text-white">
              Prêt pour ton
              <br />
              <span className="text-gradient-gold drop-shadow-[0_0_15px_rgba(250,204,21,0.2)]">Tirage Divin ?</span>
            </h2>
            <p className="text-[11px] sm:text-xs text-zinc-400 font-medium tracking-wide">
              Appuie 3 fois sur le sachet ultra-rare pour déchirer le booster !
            </p>
          </div>

          {/* booster pack 3D */}
          <div 
            ref={boosterRef}
            onClick={() => handlePackTap()}
            className={`relative w-56 sm:w-64 cursor-pointer select-none transition-all duration-300 ${
              packShaking ? (packTaps === 1 ? 'shake-light' : 'shake-medium') : 'anim-pack-float'
            } active:scale-95`}
          >
            {/* Socle d'énergie lumineuse sous le booster */}
            <div className="absolute bottom-[-15px] left-1/2 -translate-x-1/2 w-44 sm:w-52 h-6 bg-yellow-500/20 rounded-full blur-xl animate-pulse" />

            {!packTorn ? (
              <>
                <img 
                  src={packUltraImg} 
                  alt="Booster Ultra Flipz" 
                  className="w-full h-auto object-contain drop-shadow-[0_20px_45px_rgba(0,0,0,0.8)]"
                  draggable={false}
                />
                
                {/* 🖐️ MAIN DE TUTORIEL SUR LE SOUFFLET (Affichée uniquement en mode manuel pour guider) */}
                {!promoMode && (
                  <div className="absolute top-[60%] left-[65%] pointer-events-none z-40 animate-hand-tap">
                    <Pointer className="w-12 h-12 text-white fill-white drop-shadow-[0_8px_15px_rgba(0,0,0,0.6)] -scale-x-100" />
                  </div>
                )}
              </>
            ) : (
              <div className="relative w-full">
                {/* Partie Haute - S'envole */}
                <div className="animate-tear-top">
                  <img 
                    src={packUltraTopCapImg} 
                    alt="" 
                    className="w-full h-auto object-contain"
                    draggable={false}
                  />
                </div>
                {/* Partie Basse - Tombe */}
                <div className="animate-tear-bottom absolute inset-0">
                  <img 
                    src={packUltraBottomBodyImg} 
                    alt="" 
                    className="w-full h-auto object-contain"
                    draggable={false}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Indicateur de tapotements restants */}
          <div className="mt-12 flex flex-col items-center gap-3">
            <div className="flex gap-2.5">
              {[1, 2, 3].map((step) => (
                <div 
                  key={step} 
                  className={`w-3.5 h-3.5 rounded-full border border-yellow-500/30 transition-all duration-500 ${
                    packTaps >= step 
                      ? 'bg-gradient-to-r from-yellow-500 to-amber-500 shadow-[0_0_12px_rgba(250,204,21,0.6)] scale-110' 
                      : 'bg-black/40'
                  }`}
                />
              ))}
            </div>
            
            <div className="flex items-center gap-1.5 animate-pulse text-zinc-500 font-bold uppercase tracking-[0.2em] text-[9px] sm:text-[10px]">
              <ArrowDown className="w-3.5 h-3.5 text-yellow-500/80" />
              <span>TAPOTEZ POUR DÉCHIRER</span>
            </div>
          </div>

        </main>
      )}

      {/* =========================================
          STAGE 2 & 3 : L'ARC DES CARTES ET LE CLIMAX
          ========================================= */}
      {stage === 'cards' && (
        <main className="flex-1 flex flex-col items-center justify-center p-4 relative z-30">
          
          {/* Slogans et instructions d'état */}
          <div className="text-center space-y-2 mb-8 sm:mb-10 max-w-sm animate-cards-emergence">
            {allFlipped ? (
              <>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-500/20 border border-yellow-500/40 rounded-full shadow-[0_0_20px_rgba(250,204,21,0.2)]">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-yellow-400 legendary-text-pulse">Tirage Absolu !</span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-black uppercase leading-tight tracking-tight drop-shadow-lg text-white mt-1">
                  Tu as débloqué un
                  <br />
                  <span className="text-gradient-gold legendary-text-pulse">Mème Divin !</span>
                </h2>
              </>
            ) : (
              <>
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500 flex items-center justify-center gap-1.5">
                  ✦ Révèle ta fortune ✦
                </span>
                <h2 className="text-xl sm:text-3xl font-black uppercase leading-tight tracking-tight text-white mt-1">
                  Découvre tes cartes
                </h2>
                <p className="text-[10px] sm:text-xs text-zinc-400 font-medium">
                  Retourne d'abord les cartes <strong className="text-zinc-300 font-bold">Communes</strong> et <strong className="text-blue-400 font-bold">Rares</strong> !
                </p>
              </>
            )}
          </div>

          {/* Deck de cartes en 3D */}
          <div 
            className={`flex items-center justify-center gap-3 sm:gap-6 w-full max-w-lg px-2 min-h-[220px] sm:min-h-[290px] ${
              claimTriggered ? 'animate-claim-fly' : 'animate-cards-emergence'
            }`}
          >
            {sortedCards.map((card, idx) => {
              const isLegendary = card.rarity === 'legendary';
              const isRare = card.rarity === 'rare';
              
              // Verrouiller la légendaire si les autres ne sont pas retournées
              const unrevealedOthers = cards.filter(c => c.rarity !== 'legendary' && !c.flipped);
              const isLocked = isLegendary && unrevealedOthers.length > 0;
              
              // Déterminer si cette carte est la recommandation actuelle à ouvrir (mode manuel uniquement)
              const isNext = card.id === nextCardIdToFlip;

              return (
                <div 
                  key={card.id}
                  onMouseMove={handleMouseMoveCard}
                  onMouseLeave={handleMouseLeaveCard}
                  onClick={(e) => handleCardFlip(card.id, e)}
                  className={`flip-card w-[100px] sm:w-[155px] md:w-[170px] h-[145px] sm:h-[225px] md:h-[245px] cursor-pointer card-3d-hover relative ${
                    isLegendary ? 'z-20 scale-105 sm:scale-110' : 'z-10'
                  }`}
                  style={{
                    '--tz': '0px',
                    transform: isLegendary 
                      ? 'perspective(1200px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) translateZ(var(--tz, 0px)) scale(1.1)' 
                      : idx === 0 
                        ? 'perspective(1200px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) translateZ(var(--tz, 0px)) rotateZ(-3deg)'
                        : 'perspective(1200px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) translateZ(var(--tz, 0px)) rotateZ(3deg)'
                  } as React.CSSProperties}
                >
                  <div className={`flip-card-inner ${card.flipped ? 'flipped' : ''}`}>
                    
                    {/* Face Cachée (Dos de la carte) */}
                    <div className="flip-card-front relative shadow-2xl bg-zinc-950 border border-white/10 flex flex-col justify-between">
                      <img 
                        src={cardBackImage} 
                        alt="Dos Flipz" 
                        className="w-full h-full object-cover" 
                        draggable={false}
                      />
                      
                      {/* Lueur sur l'arête dorsale légendaire */}
                      {isLegendary && (
                        <div className="absolute inset-0 bg-yellow-500/10 mix-blend-screen pointer-events-none ring-2 ring-inset ring-yellow-400/40 rounded-2xl" />
                      )}

                      {/* Effet légendaire glissant au dos */}
                      {isLegendary && <div className="absolute inset-0 legendary-sweep opacity-60 rounded-2xl" />}

                      {/* Point d'interrogation / Icône de verrouillage */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 backdrop-blur-[0.5px]">
                        {isLocked ? (
                          <div className="flex flex-col items-center gap-1">
                            <Clock className="w-5 h-5 sm:w-8 sm:h-8 text-yellow-400/80 animate-pulse" />
                            <span className="text-[7px] sm:text-[9px] font-black uppercase text-yellow-400/80 tracking-widest text-center px-1">En attente</span>
                          </div>
                        ) : (
                          <span className={`text-4xl sm:text-6xl font-black ${isLegendary ? 'text-yellow-400 [text-shadow:0_0_20px_rgba(250,204,21,0.6)]' : 'text-white/60'} leading-none mt-[-5px]`}>?</span>
                        )}
                      </div>

                      {/* 🖐️ MAIN DE TUTORIEL DYNAMIQUE (Affichée uniquement en mode manuel pour guider) */}
                      {!promoMode && isNext && !card.flipped && (
                        <div className="absolute top-[55%] left-[60%] pointer-events-none z-40 animate-hand-tap">
                          <Pointer className="w-10 h-10 text-white fill-white drop-shadow-[0_6px_12px_rgba(0,0,0,0.6)] -scale-x-100" />
                        </div>
                      )}
                    </div>

                    {/* Face Révélée (Mème de la carte) */}
                    <div className={`flip-card-back relative bg-[#09090b] shadow-2xl flex flex-col justify-between p-2 sm:p-3 border-2 ${
                      isLegendary 
                        ? 'border-yellow-400/90 ring-4 ring-yellow-400/20 shadow-[0_0_35px_rgba(250,204,21,0.5)] legendary-hologram-effect' 
                        : isRare 
                          ? 'border-blue-500/80 ring-2 ring-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.3)]' 
                          : 'border-zinc-700'
                    }`}>
                      
                      {/* Image du mème */}
                      <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden border border-white/5">
                        <img 
                          src={card.image} 
                          alt={card.title} 
                          className="w-full h-full object-cover" 
                          draggable={false}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-transparent to-transparent" />
                      </div>

                      {/* Informations de la carte */}
                      <div className="flex-1 flex flex-col justify-between pt-1.5 sm:pt-3">
                        <div className="text-left">
                          <span className={`inline-block px-1.5 sm:px-2 py-0.5 rounded-full text-[6.5px] sm:text-[9px] font-black uppercase tracking-wider mb-1 ${
                            isLegendary 
                              ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-950 font-black shadow-[0_2px_10px_rgba(250,204,21,0.4)]' 
                              : isRare 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-zinc-600 text-white'
                          }`}>
                            {isLegendary ? 'Légendaire' : isRare ? 'Rare' : 'Commun'}
                          </span>
                          <h4 className={`text-[8.5px] sm:text-xs md:text-sm font-black text-white leading-tight truncate ${isLegendary ? 'text-yellow-400' : ''}`}>
                            {card.title}
                          </h4>
                        </div>
                        
                        <p className="text-[7.5px] sm:text-[9.5px] text-zinc-400 font-medium leading-normal italic text-left line-clamp-2 hidden sm:block">
                          "{card.description}"
                        </p>
                      </div>

                      {/* Effet spéculaire dynamiquement modifié par JS au survol */}
                      <div className="card-glare" />
                    </div>

                  </div>
                </div>
              );
            })}
          </div>

          {/* Bouton de Réclamation final (Apparaît une fois tout révélé) */}
          <div className="h-20 flex items-center justify-center mt-10">
            {allFlipped && (
              <div className="relative">
                <button 
                  onClick={handleClaim}
                  className="btn-chrome-glint premium-btn-shadow flex items-center gap-2.5 px-10 py-4 bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-950 font-black uppercase text-xs sm:text-sm tracking-widest rounded-full hover:scale-105 active:scale-95 transition-all duration-300"
                >
                  <span>Tout Ajouter à la Collection</span>
                  <ChevronRight className="w-4 h-4 text-slate-950 stroke-[3px]" />
                </button>

                {/* 🖐️ MAIN DE TUTORIEL SUR LE BOUTON CLAIM (Affichée uniquement en mode manuel pour guider) */}
                {!promoMode && (
                  <div className="absolute top-[60%] left-[85%] pointer-events-none z-40 animate-hand-tap">
                    <Pointer className="w-10 h-10 text-white fill-white drop-shadow-[0_6px_10px_rgba(0,0,0,0.6)] -scale-x-100" />
                  </div>
                )}
              </div>
            )}
          </div>

        </main>
      )}

      {/* =========================================
          STAGE 4 : LE TABLEAU DE BORD DE CONVERSION (CTA)
          ========================================= */}
      {stage === 'dashboard' && (
        <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-30 animate-cards-emergence">
          
          {/* Lueur arrière-plan */}
          <div className="absolute -inset-10 bg-yellow-500/5 blur-[120px] rounded-full pointer-events-none" />

          {/* Badge Streak de succès */}
          <div className="inline-flex items-center gap-2 bg-[#0d0c15]/90 border border-yellow-500/20 px-5 py-2.5 rounded-full mb-8 shadow-xl max-w-[85%] timer-glow-border">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <div className="flex flex-col text-left">
              <span className="text-[8px] sm:text-[9px] text-zinc-400 uppercase tracking-widest font-black leading-none">Gain d'Aura Actuel</span>
              <span className="text-sm font-black text-white leading-none mt-1">+1 200 AURA</span>
            </div>
            <div className="w-px h-6 bg-white/10 mx-2" />
            <div className="flex flex-col text-left">
              <span className="text-[8px] sm:text-[9px] text-zinc-400 uppercase tracking-widest font-black leading-none">Série Active</span>
              <span className="text-sm font-black text-yellow-400 leading-none mt-1">7 JOURS !</span>
            </div>
          </div>

          {/* Logo et Slogans majeurs */}
          <div className="text-center space-y-4 max-w-sm sm:max-w-md mb-12">
            <h2 className="text-3xl sm:text-5xl font-black uppercase leading-none tracking-tight drop-shadow-2xl text-white">
              Ta collection
              <br />
              <span className="text-gradient-gold legendary-text-pulse">est complète !</span>
            </h2>
            <p className="text-[11px] sm:text-xs text-zinc-400 tracking-wide font-medium leading-relaxed">
              Télécharge Flipz pour continuer à retourner des cartes gratuites toutes les 12h et collectionner plus de 150 mèmes uniques !
            </p>
          </div>

          {/* Faux Boutons Magasins Premium Apple/Google */}
          <div className="flex flex-col gap-4 w-full max-w-[270px]">
            
            {/* Bouton App Store */}
            <a 
              href="https://apps.apple.com" 
              target="_blank" 
              rel="noreferrer"
              className="btn-chrome-glint flex items-center justify-center gap-4 bg-gradient-to-b from-zinc-800 to-zinc-950 border border-white/10 px-8 py-3.5 rounded-2xl w-full hover:scale-105 active:scale-95 transition-all duration-300 shadow-xl relative"
            >
              <Smartphone className="w-7 h-7 text-white" />
              <div className="flex flex-col text-left">
                <span className="text-[8px] text-white/50 uppercase tracking-widest font-bold leading-none">Disponible sur</span>
                <span className="text-base text-white font-black leading-none mt-1">App Store</span>
              </div>
              
              {/* 🖐️ MAIN DE TUTORIEL SUR LE BOUTON STORE PRINCIPAL (Affichée uniquement en manuel) */}
              {!promoMode && (
                <div className="absolute top-[60%] left-[80%] pointer-events-none z-40 animate-hand-tap">
                  <Pointer className="w-10 h-10 text-white fill-white drop-shadow-[0_6px_10px_rgba(0,0,0,0.6)] -scale-x-100" />
                </div>
              )}
            </a>
            
            {/* Bouton Google Play */}
            {Capacitor.getPlatform() !== 'ios' && (
              <a 
                href="https://play.google.com" 
                target="_blank" 
                rel="noreferrer"
                className="btn-chrome-glint flex items-center justify-center gap-4 bg-gradient-to-b from-zinc-800 to-zinc-950 border border-white/10 px-8 py-3.5 rounded-2xl w-full hover:scale-105 active:scale-95 transition-all duration-300 shadow-xl"
              >
                <Gamepad2 className="w-7 h-7 text-white" />
                <div className="flex flex-col text-left">
                  <span className="text-[8px] text-white/50 uppercase tracking-widest font-bold leading-none">Disponible sur</span>
                  <span className="text-base text-white font-black leading-none mt-1">Google Play</span>
                </div>
              </a>
            )}

          </div>

          {/* Option de Redémarrage (Bouton Replay discret) */}
          <button 
            onClick={handleRestart}
            className="mt-10 flex items-center gap-2 text-zinc-500 hover:text-white font-bold uppercase tracking-wider text-[10px] sm:text-xs transition-colors py-2 px-4 rounded-full bg-white/5 hover:bg-white/10 border border-white/5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Recommencer le tirage</span>
          </button>

        </main>
      )}

      {/* Pied de page : Crédits d'ad et Timer de collection */}
      <footer className="relative z-40 w-full text-center py-6 px-4 bg-gradient-to-t from-black/80 to-transparent flex flex-col sm:flex-row sm:items-center sm:justify-between max-w-lg mx-auto text-zinc-500 text-[10px] font-semibold tracking-wider">
        <span>&copy; {new Date().getFullYear()} FLIPZ ADVERTISING LAB. PROMO VIDEO EDITION.</span>
        <span className="mt-1.5 sm:mt-0 flex items-center justify-center gap-1 text-yellow-500/80">
          <Sparkles className="w-3 h-3" /> JEU 100% GRATUIT
        </span>
      </footer>

    </div>
  );
};

export default Ad;
