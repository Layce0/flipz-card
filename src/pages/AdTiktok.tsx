import React, { useMemo } from 'react';
import cardBackImage from '@/assets/card-back.png';
import { Smartphone, Gamepad2, Pointer, Sparkles, AlertCircle } from 'lucide-react';
import { useAllCards } from '@/hooks/useCards';

const AdTiktok = () => {
  const { data: allCards = [] } = useAllCards();

  const commonCard = useMemo(() => {
    return allCards.find(c => c.rarity === 'common') || {
      title: 'Le Doomer Fatigué',
      rarity: 'common',
      image_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop'
    };
  }, [allCards]);

  const rareCard = useMemo(() => {
    return allCards.find(c => c.rarity === 'rare') || {
      title: 'Le Shibe Sacré',
      rarity: 'rare',
      image_url: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&auto=format&fit=crop'
    };
  }, [allCards]);

  const legendaryCard = useMemo(() => {
    return allCards.find(c => c.rarity === 'legendary') || {
      title: 'Le Roi des Chad',
      rarity: 'legendary',
      image_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop'
    };
  }, [allCards]);

  return (
    <div className="relative min-h-[100dvh] w-full bg-[#020203] overflow-hidden flex items-center justify-center font-display select-none">
      
      <style dangerouslySetInnerHTML={{__html: `
        /* =========================================================
           TIMELINE D'ANIMATION DE SWIPE (15 SECONDES)
           ========================================================= */

        /* Scène Globale */
        .perspective-scene {
          perspective: 1200px;
          transform-style: preserve-3d;
        }

        /* 1. POV / Accroche (0 - 3s) */
        .seq-hook { animation: anim-hook-title 15s ease-out forwards; }
        @keyframes anim-hook-title {
          0% { opacity: 0; transform: translateY(-50px) scale(0.9); }
          3%, 20% { opacity: 1; transform: translateY(0) scale(1); }
          22%, 100% { opacity: 0; transform: translateY(-30px); pointer-events: none; }
        }

        /* 2. Texte de transition Memes (3 - 6.5s) */
        .seq-hunt-title { animation: anim-hunt-title 15s ease-out forwards; }
        @keyframes anim-hunt-title {
          0%, 19% { opacity: 0; transform: translateY(-30px); }
          22%, 42% { opacity: 1; transform: translateY(0); }
          44%, 100% { opacity: 0; transform: translateY(-30px); pointer-events: none; }
        }

        /* 3. Texte Climax Légendaire (6.5 - 11.5s) */
        .seq-legendary-title { animation: anim-legendary-title 15s ease-out forwards; }
        @keyframes anim-legendary-title {
          0%, 41% { opacity: 0; transform: scale(0.8); }
          44%, 73% { opacity: 1; transform: scale(1); }
          76%, 100% { opacity: 0; transform: scale(1.2); pointer-events: none; }
        }

        /* 4. CTA Final (11.5 - 15s) */
        .seq-cta { animation: anim-cta 15s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        @keyframes anim-cta {
          0%, 75% { opacity: 0; transform: scale(0.9) translateY(50px); pointer-events: none; }
          78%, 100% { opacity: 1; transform: scale(1) translateY(0); pointer-events: auto; }
        }

        /* =========================================================
           TIMELINE DES CARTES (SWIPE DECK)
           ========================================================= */

        /* Carte 1 : WOJAK (Common) -> Swipe Gauche à 2.2s */
        .card-1 { animation: anim-card-1 15s cubic-bezier(0.25, 0.8, 0.25, 1) forwards; }
        @keyframes anim-card-1 {
          0% { opacity: 0; transform: translateY(100px) rotate(5deg) scale(0.9); }
          3% { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }
          14% { transform: translateY(0) rotate(-2deg) scale(1.02); } /* Le doigt commence à toucher */
          16%, 100% { opacity: 0; transform: translate(-500px, 50px) rotate(-35deg) scale(0.9); pointer-events: none; } /* Swipe Gauche ! */
        }

        /* Carte 2 : DOGE (Rare) -> Arrive à 2s, Swipe Gauche à 5.2s */
        .card-2 { animation: anim-card-2 15s cubic-bezier(0.25, 0.8, 0.25, 1) forwards; }
        @keyframes anim-card-2 {
          0%, 15% { opacity: 0; transform: translateY(200px) scale(0.8); }
          18% { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }
          32% { transform: translateY(0) rotate(3deg) scale(1.02); }
          34%, 100% { opacity: 0; transform: translate(-500px, 50px) rotate(-35deg) scale(0.9); pointer-events: none; } /* Swipe Gauche ! */
        }

        /* Carte 3 : GIGACHAD (Legendary) -> Arrive à 5s, Swipe Droite à 8.5s puis triomphe */
        .card-3 { animation: anim-card-3 15s cubic-bezier(0.25, 0.8, 0.25, 1) forwards; }
        @keyframes anim-card-3 {
          0%, 33% { opacity: 0; transform: translateY(200px) scale(0.8); }
          36% { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }
          50% { transform: translateY(0) rotate(5deg) scale(1.03); } /* Swipe Droite initié */
          53% { transform: translate(450px, -50px) rotate(25deg) scale(0.95); opacity: 0.8; } /* Envoué à droite ! */
          56% { transform: translate(0, 0) rotate(0deg) scale(1.15); opacity: 1; } /* Retour triomphal au centre */
          73%, 100% { transform: translate(0, -350px) scale(0.2); opacity: 0; pointer-events: none; } /* Envol vers le logo */
        }

        /* Effet d'impact/Victory lors du bon Swipe */
        .victory-flash { animation: anim-victory 15s ease-out forwards; }
        @keyframes anim-victory {
          0%, 55% { opacity: 0; }
          56% { opacity: 1; }
          74% { opacity: 1; }
          75%, 100% { opacity: 0; }
        }

        /* =========================================================
           TIMELINE DU DOIGT (POINTER)
           ========================================================= */
        .hand-pointer { animation: anim-hand 15s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        @keyframes anim-hand {
          /* 0s - 1.2s : Le doigt arrive pour le Wojak */
          0% { opacity: 0; transform: translate(200px, 400px) rotate(-15deg); }
          3% { opacity: 1; transform: translate(50px, 150px) rotate(-15deg); }
          
          /* 1.2s - 1.6s : Swipe de Wojak vers la Gauche */
          8% { transform: translate(50px, 150px) rotate(-15deg) scale(0.85); }
          12% { transform: translate(-200px, 100px) rotate(-35deg) scale(0.85); }
          13% { transform: translate(-200px, 100px) rotate(-35deg) scale(1); opacity: 0; }

          /* 3.2s - 4.6s : Le doigt revient pour Doge */
          20% { opacity: 0; transform: translate(200px, 400px); }
          22% { opacity: 1; transform: translate(50px, 150px) rotate(-15deg); }
          26% { transform: translate(50px, 150px) rotate(-15deg) scale(0.85); }
          30% { transform: translate(-200px, 100px) rotate(-35deg) scale(0.85); }
          31% { transform: translate(-200px, 100px) rotate(-35deg) scale(1); opacity: 0; }

          /* 5.2s - 6.8s : Le doigt vient sur GigaChad */
          38% { opacity: 0; transform: translate(200px, 400px); }
          40% { opacity: 1; transform: translate(50px, 150px) rotate(-15deg); }
          43% { transform: translate(50px, 150px) rotate(-15deg) scale(0.85); }
          
          /* 6.8s - 7.5s : Swipe triomphal vers la DROITE */
          48% { transform: translate(250px, 50px) rotate(15deg) scale(0.85); }
          49% { transform: translate(250px, 50px) rotate(15deg) scale(1); opacity: 0; }

          /* 12s - 15s : Clics des boutons de fin */
          76% { opacity: 0; transform: translate(200px, 400px); }
          79% { opacity: 1; transform: translate(40px, 120px) rotate(-5deg); } /* App Store */
          82% { transform: translate(40px, 120px) rotate(-5deg) scale(0.85); }
          84% { transform: translate(40px, 120px) rotate(-5deg) scale(1); }
          88% { transform: translate(40px, 210px) rotate(-5deg); } /* Google Play */
          91% { transform: translate(40px, 210px) rotate(-5deg) scale(0.85); }
          93%, 100% { transform: translate(40px, 210px) rotate(-5deg) scale(1); }
        }

        /* =========================================================
           BOUTONS & LUEURS PREMIUM FLIPZ
           ========================================================= */
        .premium-btn {
          background: linear-gradient(180deg, rgba(30,30,35,0.9) 0%, rgba(15,15,20,0.9) 100%);
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.2), 0 10px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1);
          backdrop-filter: blur(10px);
        }

        .text-glow {
          text-shadow: 0 0 20px rgba(255,255,255,0.4), 0 0 40px rgba(216, 180, 254, 0.2);
        }

        .text-shimmer {
          background: linear-gradient(90deg, #fff 0%, #fff 40%, #fbbf24 50%, #fff 60%, #fff 100%);
          background-size: 200% auto;
          color: transparent;
          -webkit-background-clip: text;
          animation: shimmer 3s linear infinite;
        }
        @keyframes shimmer { to { background-position: 200% center; } }

        /* Rayons lumineux tournants */
        .light-beams {
          background: conic-gradient(from 0deg, transparent 0%, rgba(216, 180, 254, 0.12) 10%, transparent 20%, transparent 40%, rgba(250, 204, 21, 0.08) 50%, transparent 60%, transparent 80%, rgba(216, 180, 254, 0.12) 90%, transparent 100%);
          animation: spin-beams 20s linear infinite;
        }
        @keyframes spin-beams { 100% { transform: translate(-50%, -50%) rotate(360deg); } }

        /* Flottement de carte fluide */
        @keyframes smooth-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(1deg); }
        }
        .anim-float { animation: smooth-float 4s ease-in-out infinite; }

        /* Clics des boutons de fin */
        .anim-click-1 { animation: btn-click-1 15s ease-in-out forwards; }
        @keyframes btn-click-1 {
          0%, 81.5% { transform: scale(1); filter: brightness(1); }
          82.5% { transform: scale(0.95); filter: brightness(1.4); box-shadow: inset 0 1px 1px rgba(255,255,255,0.4), 0 0 25px rgba(255,255,255,0.3); }
          83.5%, 100% { transform: scale(1); filter: brightness(1); }
        }
        
        .anim-click-2 { animation: btn-click-2 15s ease-in-out forwards; }
        @keyframes btn-click-2 {
          0%, 90.5% { transform: scale(1); filter: brightness(1); }
          91.5% { transform: scale(0.95); filter: brightness(1.4); box-shadow: inset 0 1px 1px rgba(255,255,255,0.4), 0 0 25px rgba(255,255,255,0.3); }
          92.5%, 100% { transform: scale(1); filter: brightness(1); }
        }
      `}} />

      {/* Arrière-plan global */}
      <div className="absolute inset-0 bg-[#020203] bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-purple-950/30 via-[#050508] to-[#010102]" />
      
      {/* Light Beams tournants */}
      <div className="absolute top-[35%] left-1/2 w-[220vw] h-[220vw] light-beams rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 mix-blend-screen" />

      {/* Doigt Pointer de Swipe / Clic */}
      <div className="absolute z-50 pointer-events-none hand-pointer">
        <Pointer className="w-16 h-16 text-white drop-shadow-[0_10px_25px_rgba(0,0,0,0.95)] fill-white -scale-x-100" />
      </div>


      {/* =========================================
          TEXTES DE LA TIMELINE (PLUS ÉPURÉS)
          ========================================= */}
      
      {/* Acte 1 : Hook POV */}
      <div className="absolute top-[12%] left-0 right-0 px-6 z-30 text-center seq-hook">
        <h1 className="text-[2rem] font-bold text-white uppercase tracking-tight text-glow">
          POV: Trouver la carte<br/>
          <span className="text-shimmer">parfaite sur FLIPZ</span>
        </h1>
      </div>

      {/* Acte 2 : Transition Mèmes */}
      <div className="absolute top-[12%] left-0 right-0 px-6 z-30 text-center seq-hunt-title">
        <h2 className="text-[2rem] font-bold text-white uppercase tracking-tight text-glow">
          Swipe pour trier<br/>
          <span className="text-purple-400">tes mèmes...</span>
        </h2>
      </div>

      {/* Acte 3 : Climax Légendaire */}
      <div className="absolute top-[12%] left-0 right-0 px-6 z-30 text-center seq-legendary-title">
        <h2 className="text-[2rem] font-bold text-white uppercase tracking-tight text-glow">
          Attends... ✦<br/>
          <span className="text-shimmer">Le Graal absolu !</span>
        </h2>
      </div>


      {/* =========================================
          SWIPE DECK (LES CARTES AVEC LE VRAI DESIGN FLIPZ - ÉPURÉ)
          ========================================= */}
      <div className="perspective-scene relative w-[230px] h-[310px] flex items-center justify-center z-20">
        
        {/* CARTE 1 : WOJAK (Common) */}
        <div className="card-1 absolute w-full h-full cursor-pointer transition-transform duration-300">
          <div className="absolute -inset-1 rounded-xl opacity-20 blur-sm" style={{ background: 'hsl(220, 10%, 50%)' }} />
          <div className="relative w-full h-full rounded-xl overflow-hidden bg-card border-2 card-shadow flex flex-col justify-between" style={{ borderColor: 'hsl(220, 10%, 50%)' }}>
            <div className="aspect-[3/4] w-full overflow-hidden relative">
              <img 
                src={commonCard.image_url} 
                alt={commonCard.title} 
                className="w-full h-full object-cover opacity-75"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d0c10] via-transparent to-transparent" />
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[#0d0c10] to-transparent">
              <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider mb-1 rarity-common text-white">
                Commun
              </span>
              <h4 className="font-display text-sm text-foreground truncate">{commonCard.title}</h4>
            </div>
          </div>
        </div>

        {/* CARTE 2 : DOGE (Rare) */}
        <div className="card-2 absolute w-full h-full cursor-pointer transition-transform duration-300">
          <div className="absolute -inset-1 rounded-xl opacity-30 blur-sm" style={{ background: 'hsl(210, 80%, 55%)' }} />
          <div className="relative w-full h-full rounded-xl overflow-hidden bg-card border-2 card-shadow flex flex-col justify-between" style={{ borderColor: 'hsl(210, 80%, 55%)' }}>
            <div className="aspect-[3/4] w-full overflow-hidden relative">
              <img 
                src={rareCard.image_url} 
                alt={rareCard.title} 
                className="w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d0c10] via-transparent to-transparent" />
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[#0d0c10] to-transparent">
              <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider mb-1 rarity-rare text-white">
                Rare
              </span>
              <h4 className="font-display text-sm text-foreground truncate">{rareCard.title}</h4>
            </div>
          </div>
        </div>

        {/* CARTE 3 : GIGACHAD (Legendary) */}
        <div className="card-3 absolute w-full h-full cursor-pointer transition-transform duration-300">
          <div className="absolute -inset-1.5 rounded-xl opacity-50 blur-md animate-pulse" style={{ background: 'hsl(45, 95%, 55%)' }} />
          <div className="relative w-full h-full rounded-xl overflow-hidden bg-card border-2 card-shadow flex flex-col justify-between" style={{ borderColor: 'hsl(45, 95%, 55%)' }}>
            <div className="aspect-[3/4] w-full overflow-hidden relative">
              <img 
                src={legendaryCard.image_url} 
                alt={legendaryCard.title} 
                className="w-full h-full object-cover opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d0c10] via-transparent to-transparent" />
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[#0d0c10] to-transparent">
              <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider mb-1 rarity-legendary text-slate-950 font-bold">
                Légendaire
              </span>
              <h4 className="font-display text-sm text-foreground truncate text-glow">{legendaryCard.title}</h4>
            </div>
            
            <div className="shimmer absolute inset-0 pointer-events-none" />
          </div>
        </div>

      </div>


      {/* =========================================
          EFFET DE CELEBRATION (SWIPE REUSSI - ÉPURÉ)
          ========================================= */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30 victory-flash">
        <div className="absolute inset-0 bg-yellow-400/10 backdrop-blur-[2px] mix-blend-screen" />
        <div className="absolute top-[22%] text-center px-4">
          <span className="text-yellow-400 text-glow text-[2rem] font-bold uppercase tracking-widest block mb-2 animate-bounce">
            ✦ LÉGENDAIRE DEBLOQUÉE ✦
          </span>
          <span className="text-white/60 text-xs tracking-wider">AJOUTÉE À TA COLLECTION</span>
        </div>
        <div className="absolute w-[80vw] h-[80vw] rounded-full bg-yellow-400/15 blur-[120px] animate-ping" />
      </div>


      {/* =========================================
          ACTE 4 : L'ECRAN DE FIN (CTA)
          ========================================= */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 z-40 seq-cta">
        
        <div className="relative mb-8">
          <div className="absolute -inset-24 bg-primary/30 blur-[100px] rounded-full animate-pulse" />
          <img 
            src="/flipz-logo-new.png" 
            alt="FLIPZ" 
            className="w-[18rem] object-contain relative z-10 drop-shadow-[0_20px_50px_rgba(0,0,0,0.95)]"
          />
        </div>

        <h2 className="text-[2.2rem] font-black text-white uppercase text-center leading-[1.1] tracking-tight drop-shadow-[0_0_20px_rgba(0,0,0,0.8)] mb-10">
          Trouve tes mèmes<br/>
          <span className="text-shimmer">favoris !</span>
        </h2>

        {/* Boutons verticalisés pour TikTok */}
        <div className="flex flex-col gap-5">
          
          <div className="anim-click-1 premium-btn flex items-center justify-center gap-5 px-8 py-4 rounded-[1.3rem] w-[270px]">
            <Smartphone className="w-7 h-7 text-white" />
            <span className="text-lg text-white font-black uppercase tracking-wider">App Store</span>
          </div>
          
          <div className="anim-click-2 premium-btn flex items-center justify-center gap-5 px-8 py-4 rounded-[1.3rem] w-[270px]">
            <Gamepad2 className="w-7 h-7 text-white" />
            <span className="text-lg text-white font-black uppercase tracking-wider">Google Play</span>
          </div>
        </div>

      </div>
      
    </div>
  );
};

export default AdTiktok;
