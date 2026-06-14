import React, { useMemo } from 'react';
import cardBackImage from '@/assets/card-back.png';
import { Download, Star, Trophy, Sparkles, Gamepad2, Smartphone, Pointer } from 'lucide-react';

const AdStory = () => {
  const gridCards = useMemo(() => {
    const cards = [];
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        cards.push({
          id: `${row}-${col}`,
          left: `${(col * 16) - 5}%`,
          top: `${(row * 20) - 10}%`,
          delay: `${(row + col) * 0.15}s`,
        });
      }
    }
    return cards;
  }, []);

  return (
    <div className="relative min-h-screen w-full bg-[#020203] overflow-hidden flex items-center justify-center font-display">
      
      <style dangerouslySetInnerHTML={{__html: `
        /* =========================================================
           TIMELINE CSS (Durée Totale : 22 secondes)
           Actes enchaînés avec des courbes d'accélération fluides
           ========================================================= */

        /* ACTE 1 : Le Hook */
        .seq-hook { animation: anim-hook 22s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        @keyframes anim-hook {
          0% { opacity: 0; transform: scale(1.1); }
          2%, 18% { opacity: 1; transform: scale(1); }
          22%, 100% { opacity: 0; transform: scale(0.9) translateZ(-500px); pointer-events: none; }
        }

        /* ACTE 2 : La Grille (Waterfall) */
        .seq-grid { animation: anim-grid 22s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        @keyframes anim-grid {
          0%, 18% { opacity: 0; transform: translateY(100px) scale(1.1); }
          22% { opacity: 1; transform: translateY(0) scale(1); }
          48% { opacity: 1; transform: translateY(-50px) scale(1); }
          52%, 100% { opacity: 0; transform: translateY(-150px) scale(0.9); pointer-events: none; }
        }

        /* ACTE 3 : Le Climax */
        .seq-climax { animation: anim-climax 22s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        @keyframes anim-climax {
          0%, 48% { opacity: 0; transform: translateY(150px) scale(0.7); }
          52%, 72% { opacity: 1; transform: translateY(0) scale(1); }
          78%, 100% { opacity: 0; transform: scale(1.5); pointer-events: none; }
        }

        /* ACTE 4 : Le CTA */
        .seq-cta { animation: anim-cta 22s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        @keyframes anim-cta {
          0%, 75% { opacity: 0; transform: scale(0.8) translateY(30px); pointer-events: none; }
          78%, 100% { opacity: 1; transform: scale(1) translateY(0); pointer-events: auto; }
        }

        /* ACTE 4 : Animation de la Main (Curseur) */
        .seq-hand { animation: anim-hand 22s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        @keyframes anim-hand {
          0%, 83% { opacity: 0; transform: translate(150px, 150px) rotate(-15deg); pointer-events: none; }
          84% { opacity: 1; transform: translate(150px, 150px) rotate(-15deg); }
          86% { opacity: 1; transform: translate(20px, 10px) rotate(0deg); } /* Arrive sur App Store */
          87% { opacity: 1; transform: translate(20px, 10px) rotate(0deg) scale(0.85); } /* Clic ! */
          88% { opacity: 1; transform: translate(20px, 10px) rotate(0deg) scale(1); } /* Relâche */
          91% { opacity: 1; transform: translate(320px, 10px) rotate(0deg); } /* Se déplace vers Google Play */
          92% { opacity: 1; transform: translate(320px, 10px) rotate(0deg) scale(0.85); } /* Clic ! */
          93%, 100% { opacity: 1; transform: translate(320px, 10px) rotate(0deg) scale(1); } /* Reste là */
        }

        /* Animation des Boutons cliqués par la main */
        .anim-click-1 { animation: btn-click-1 22s ease-in-out forwards; }
        @keyframes btn-click-1 {
          0%, 86.5% { transform: scale(1); filter: brightness(1); }
          87% { transform: scale(0.95); filter: brightness(1.5); box-shadow: inset 0 1px 1px rgba(255,255,255,0.4), 0 0 20px rgba(255,255,255,0.5); }
          88%, 100% { transform: scale(1); filter: brightness(1); }
        }
        
        .anim-click-2 { animation: btn-click-2 22s ease-in-out forwards; }
        @keyframes btn-click-2 {
          0%, 91.5% { transform: scale(1); filter: brightness(1); }
          92% { transform: scale(0.95); filter: brightness(1.5); box-shadow: inset 0 1px 1px rgba(255,255,255,0.4), 0 0 20px rgba(255,255,255,0.5); }
          93%, 100% { transform: scale(1); filter: brightness(1); }
        }

        /* =========================================================
           EFFETS SPECIAUX ET POLISH
           ========================================================= */
           
        .perspective-scene {
          perspective: 1000px;
          transform-style: preserve-3d;
        }

        /* Flip de carte fluide et majestueux pour le Hook */
        @keyframes fluid-spin {
          0% { transform: translateY(0px) rotateY(0deg) rotateZ(-3deg) scale(1); }
          50% { transform: translateY(-25px) rotateY(180deg) rotateZ(3deg) scale(1.05); }
          100% { transform: translateY(0px) rotateY(360deg) rotateZ(-3deg) scale(1); }
        }
        .anim-fluid-spin { animation: fluid-spin 5s ease-in-out infinite; }

        /* Waterfall fluide pour la grille de l'Acte 2 */
        @keyframes waterfall {
          0% { transform: translateY(0) rotateX(20deg); }
          100% { transform: translateY(-30%) rotateX(20deg); }
        }
        .anim-waterfall { animation: waterfall 15s linear infinite; }

        /* Rayons lumineux tournants en fond */
        .light-beams {
          background: conic-gradient(from 0deg, transparent 0%, rgba(216, 180, 254, 0.15) 10%, transparent 20%, transparent 40%, rgba(250, 204, 21, 0.1) 50%, transparent 60%, transparent 80%, rgba(216, 180, 254, 0.15) 90%, transparent 100%);
          animation: spin-beams 20s linear infinite;
        }
        @keyframes spin-beams { 100% { transform: translate(-50%, -50%) rotate(360deg); } }

        /* Boutons Premium Apple/Google */
        .premium-btn {
          background: linear-gradient(180deg, rgba(30,30,35,0.9) 0%, rgba(15,15,20,0.9) 100%);
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.2), 0 10px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1);
          backdrop-filter: blur(10px);
        }

        .text-shimmer {
          background: linear-gradient(90deg, #fff 0%, #fff 40%, #fde047 50%, #fff 60%, #fff 100%);
          background-size: 200% auto;
          color: transparent;
          -webkit-background-clip: text;
          animation: shimmer 3s linear infinite;
        }
        @keyframes shimmer { to { background-position: 200% center; } }
      `}} />

      {/* Arrière-plan global */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-purple-900/30 via-[#050508] to-[#010102]" />
      
      {/* Light Beams en fond (Tournent en permanence) */}
      <div className="absolute top-[30%] left-1/2 w-[200vw] h-[200vw] light-beams rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 mix-blend-screen" />


      {/* =========================================
          ACTE 1 : LE HOOK (0 à 5s)
          ========================================= */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 z-20 seq-hook">
        <div className="perspective-scene w-full flex flex-col items-center justify-center">
          
          {/* Lueur derrière la carte */}
          <div className="absolute w-64 h-64 bg-primary/30 blur-[80px] rounded-full animate-pulse" style={{ transform: 'translateZ(-200px)' }} />

          {/* Carte qui se retourne */}
          <div className="relative w-[220px] h-[310px] rounded-[1.2rem] shadow-[0_30px_60px_rgba(0,0,0,0.8),_0_0_40px_rgba(216,180,254,0.3)] border border-white/20 transform-style-3d anim-fluid-spin mb-12">
            <img src={cardBackImage} alt="" className="w-full h-full object-cover absolute inset-0 rounded-[1.2rem]" />
            <div className="absolute inset-0 bg-gradient-to-tr from-black/80 to-purple-900/40 rounded-[1.2rem] ring-1 ring-inset ring-white/10">
            </div>
          </div>
          
          <h1 className="text-[3.5rem] md:text-[5rem] font-black text-white uppercase text-center leading-[1] tracking-tight drop-shadow-[0_0_30px_rgba(0,0,0,0.8)]">
            As-tu de la chance<br/>
            <span className="text-shimmer">aujourd'hui ?</span>
          </h1>
        </div>
      </div>


      {/* =========================================
          ACTE 2 : LA DÉMONSTRATION / GRILLE (5 à 12s)
          ========================================= */}
      <div className="absolute inset-0 perspective-scene w-full h-full z-10 seq-grid">
        
        {/* Mur de cartes ordonné (Waterfall) */}
        <div className="absolute inset-[-50%] w-[200%] h-[200%] anim-waterfall">
          {gridCards.map((c) => (
            <div 
              key={c.id} 
              className="absolute w-[120px] h-[170px] rounded-xl overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.8)] border border-white/10"
              style={{
                left: c.left,
                top: c.top,
              }}
            >
              <img src={cardBackImage} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-purple-900/30 to-black/80" />
              {/* Reflet glossy */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0" />
            </div>
          ))}
        </div>
        
        {/* Texte Acte 2 au dessus de la grille */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-[4px]">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-900/80 to-black/80 px-8 py-3 rounded-full mb-6 border border-purple-500/30 shadow-[0_0_30px_rgba(216,180,254,0.2)]">
            <Trophy className="w-6 h-6 text-yellow-400 animate-pulse" />
            <span className="text-lg font-bold text-white uppercase tracking-widest">Une collection immense</span>
            <Trophy className="w-6 h-6 text-yellow-400 animate-pulse" />
          </div>
          <h2 className="text-[4rem] md:text-[6rem] font-black text-white uppercase text-center leading-[0.95] tracking-tight text-glow">
            COLLECTIONNE<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-purple-300 to-purple-600">PLUS DE 150 CARTES</span>
          </h2>
        </div>
      </div>


      {/* =========================================
          ACTE 3 : LE CLIMAX (12 à 17s)
          ========================================= */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 z-30 seq-climax">
        <h2 className="absolute top-[10%] text-[3rem] md:text-[4rem] font-black text-white uppercase text-center tracking-tight text-glow leading-none">
          Arriveras-tu à obtenir<br/>
          <span className="text-shimmer">les Légendaires ?</span>
        </h2>

        <div className="perspective-scene relative w-[340px] h-[480px] rounded-[1.5rem] mt-16">
          
          {/* Grosse lueur jaune derrière */}
          <div className="absolute inset-[-50px] bg-yellow-500/30 blur-[80px] animate-pulse rounded-full" style={{ transform: 'translateZ(-200px)' }} />
          
          <div className="relative w-full h-full rounded-[1.5rem] overflow-hidden shadow-[0_40px_120px_rgba(250,204,21,0.6)] border-[3px] border-yellow-400/80 main-card-float bg-black">
            <img src={cardBackImage} alt="Legendary" className="w-full h-full object-cover absolute inset-0" />
            
            {/* Effet Légendaire Premium */}
            <div className="absolute inset-0 legendary-sweep opacity-100 mix-blend-screen" />
            <div className="absolute inset-0 bg-gradient-to-t from-yellow-900/80 via-yellow-900/20 to-transparent" />
          </div>
        </div>
      </div>


      {/* =========================================
          ACTE 4 : L'APPEL À L'ACTION / CTA (17 à 22s)
          ========================================= */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 z-40 seq-cta">
        
        <div className="relative mb-16">
          {/* Lueur divine derrière le logo */}
          <div className="absolute -inset-24 bg-primary/40 blur-[100px] rounded-[100%] animate-pulse" />
          <div className="absolute -inset-10 bg-white/10 blur-[40px] rounded-full" />
          <img 
            src="/flipz-logo-new.png" 
            alt="FLIPZ" 
            className="w-[28rem] object-contain relative z-10 drop-shadow-[0_20px_50px_rgba(0,0,0,0.9)]"
          />
        </div>

        <h2 className="text-[3rem] font-black text-white uppercase text-center leading-[1.1] tracking-tight drop-shadow-[0_0_30px_rgba(0,0,0,0.8)] mb-16">
          Télécharge le jeu <br/>
          <span className="text-shimmer">Gratuitement !</span>
        </h2>

        {/* Faux Boutons Premium & Animation de la main */}
        <div className="relative flex flex-row gap-8 scale-90 md:scale-100">
          
          {/* La petite main animée */}
          <div className="absolute top-[30%] left-0 z-50 seq-hand">
            <Pointer className="w-16 h-16 text-white drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)] fill-white -scale-x-100" />
          </div>

          {/* Bouton style App Store */}
          <div className="anim-click-1 premium-btn flex items-center gap-5 px-8 py-4 rounded-[1.5rem] w-[260px]">
            <Smartphone className="w-10 h-10 text-white" />
            <div className="flex flex-col">
              <span className="text-[12px] text-white/60 uppercase font-black tracking-widest">Disponible sur</span>
              <span className="text-2xl text-white font-black leading-none mt-1">App Store</span>
            </div>
          </div>
          {/* Bouton style Google Play */}
          <div className="anim-click-2 premium-btn flex items-center gap-5 px-8 py-4 rounded-[1.5rem] w-[260px]">
            <Gamepad2 className="w-10 h-10 text-white" />
            <div className="flex flex-col">
              <span className="text-[12px] text-white/60 uppercase font-black tracking-widest">Disponible sur</span>
              <span className="text-2xl text-white font-black leading-none mt-1">Google Play</span>
            </div>
          </div>
        </div>

      </div>
      
    </div>
  );
};

export default AdStory;
