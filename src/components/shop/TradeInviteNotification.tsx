import React from 'react';
import { useTradeInvite } from '@/hooks/useTradeInvite';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Handshake, X, Check } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export const TradeInviteNotification: React.FC = () => {
  const { incomingInvite, acceptInvite, declineInvite } = useTradeInvite();
  const navigate = useNavigate();
  const location = useLocation();

  if (!incomingInvite) return null;

  const handleAccept = () => {
    // Immediately persist pending room code to avoid missing events across navigation
    if (typeof window !== 'undefined') {
      (window as any).__pendingTradeRoomCode = incomingInvite.roomCode;
      try {
        sessionStorage.setItem('flipz_pending_trade_room', incomingInvite.roomCode);
        localStorage.setItem('flipz_pending_trade_room', incomingInvite.roomCode);
      } catch {}
    }

    // If not on /shop, navigate there first
    if (location.pathname !== '/shop') {
      navigate('/shop');
    }

    // Give a short delay if navigation is needed, then accept
    setTimeout(() => {
      acceptInvite(incomingInvite);
    }, 150);
  };

  return (
    <div className="fixed top-4 inset-x-0 z-[999999] flex justify-center px-4 pointer-events-none animate-in slide-in-from-top-4 duration-300">
      <div className="pointer-events-auto w-full max-w-[420px] rounded-2xl overflow-hidden shadow-[0_15px_50px_rgba(0,0,0,0.85),0_0_30px_rgba(168,85,247,0.25)] flex flex-col select-none bg-[#0e0f1d]/95 backdrop-blur-2xl border border-purple-500/30">
        {/* Top Header Bar */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-purple-950/60 via-[#131124] to-purple-950/60 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-black shadow-sm">
              <Handshake className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
            <span className="text-white text-xs font-bold uppercase tracking-wider">
              Demande d'échange
            </span>
          </div>

          <button
            type="button"
            onClick={declineInvite}
            title="Fermer"
            className="w-6 h-6 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 flex flex-col gap-3.5">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12 rounded-full border-2 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.3)] bg-[#131124] flex-shrink-0 overflow-hidden">
              {incomingInvite.senderAvatar ? (
                <AvatarImage 
                  src={incomingInvite.senderAvatar} 
                  alt={incomingInvite.senderName} 
                  className="w-full h-full object-cover" 
                />
              ) : null}
              <AvatarFallback className="bg-gradient-to-tr from-purple-700 via-indigo-600 to-amber-500 text-white font-bold text-sm flex items-center justify-center w-full h-full">
                {incomingInvite.senderName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-col min-w-0">
              <span className="text-white text-sm sm:text-base font-bold truncate leading-tight">
                {incomingInvite.senderName}
              </span>
              <span className="text-zinc-400 text-xs mt-0.5 leading-snug">
                souhaite faire un échange de cartes avec vous !
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-0.5">
            <button
              type="button"
              onClick={declineInvite}
              className="py-2.5 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/10 font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
            >
              Refuser
            </button>

            <button
              type="button"
              onClick={handleAccept}
              className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 active:scale-95 text-black font-extrabold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(250,204,21,0.3)] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Accepter</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
