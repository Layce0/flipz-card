import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useP2PTrade, TradeItem } from '@/hooks/useP2PTrade';
import { useAuth } from '@/contexts/AuthContext';
import { useFriends } from '@/hooks/useFriends';
import { useTradeInvite } from '@/hooks/useTradeInvite';
import { usePublicTradeRooms, PublicTradeRoom } from '@/hooks/usePublicTradeRooms';
import { PotionBottle } from '@/components/inventory/PotionIcons';
import { getPackImage } from '@/components/shop/PackPurchasedDialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ArrowLeftRight, Handshake, Star, Search, Check, X, Clock, Sparkles,
  Copy, Users, UserPlus, Share2, KeyRound, Send, Swords, Package, Zap,
  ShieldCheck, Globe, Plus, Radio,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSfx } from '@/hooks/useSfx';

interface P2PTradeViewProps {
  initialRoomCode?: string | null;
  onClose?: () => void;
  onSwitchToSystem?: () => void;
  onSessionStateChange?: (active: boolean) => void;
}

// Rarity style map
const RARITY_STYLES: Record<string, { border: string; glow: string; badge: string; text: string }> = {
  legendary: { border: 'border-yellow-400', glow: 'shadow-[0_0_18px_rgba(250,204,21,0.55)]', badge: 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black', text: 'text-yellow-400' },
  epic:      { border: 'border-purple-400', glow: 'shadow-[0_0_18px_rgba(192,132,252,0.55)]', badge: 'bg-purple-600 text-white', text: 'text-purple-400' },
  rare:      { border: 'border-blue-400',   glow: 'shadow-[0_0_14px_rgba(96,165,250,0.45)]',  badge: 'bg-blue-600 text-white', text: 'text-blue-400' },
  common:    { border: 'border-zinc-600',   glow: '', badge: 'bg-zinc-700 text-zinc-200', text: 'text-zinc-400' },
  pack:      { border: 'border-amber-400',  glow: 'shadow-[0_0_14px_rgba(251,191,36,0.4)]',   badge: 'bg-amber-400 text-black font-black', text: 'text-amber-400' },
  potion:    { border: 'border-cyan-400',   glow: 'shadow-[0_0_14px_rgba(34,211,238,0.4)]',   badge: 'bg-cyan-400 text-black font-black', text: 'text-cyan-400' },
};

function getRarityStyle(item: TradeItem) {
  if (item.type === 'pack')   return RARITY_STYLES.pack;
  if (item.type === 'potion') return RARITY_STYLES.potion;
  const key = (item.rarity?.toLowerCase() || 'common').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return RARITY_STYLES[key] || RARITY_STYLES.common;
}

function getRarityLabel(item: TradeItem) {
  if (item.type === 'pack')   return 'BOOSTER';
  if (item.type === 'potion') return 'POTION';
  const r = (item.rarity?.toLowerCase() || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (r === 'legendary') return 'LEGENDAIRE';
  if (r === 'epic')      return 'EPIQUE';
  if (r === 'rare')      return 'RARE';
  return 'COMMUN';
}

function getPackStyleDetails(packIdOrType: string = '') {
  const clean = packIdOrType.toLowerCase();
  if (clean.includes('ultra')) {
    return {
      container: 'bg-gradient-to-br from-[hsl(45,80%,22%)] via-[hsl(280,50%,16%)] to-[hsl(45,70%,16%)]',
      border: 'border-2 border-yellow-400/80',
      glow: 'shadow-[0_0_20px_rgba(250,204,21,0.4)]',
      imageDrop: 'drop-shadow-[0_0_14px_rgba(234,179,8,0.7)]',
      badge: 'bg-gradient-to-r from-yellow-400 to-amber-300 text-black font-extrabold',
      label: 'ULTRA',
    };
  }
  if (clean.includes('lucky') || clean.includes('chanceux')) {
    return {
      container: 'bg-gradient-to-br from-[hsl(280,50%,16%)] via-[hsl(260,40%,12%)] to-[hsl(280,45%,14%)]',
      border: 'border-2 border-amber-400/60',
      glow: 'shadow-[0_0_16px_rgba(245,158,11,0.3)]',
      imageDrop: 'drop-shadow-[0_0_12px_rgba(234,179,8,0.5)]',
      badge: 'bg-amber-400 text-black font-black',
      label: 'CHANCEUX',
    };
  }
  return {
    container: 'bg-gradient-to-br from-[hsl(280,40%,12%)] via-[hsl(260,30%,8%)] to-[hsl(240,30%,10%)]',
    border: 'border-2 border-purple-500/40',
    glow: 'shadow-[0_0_14px_rgba(168,85,247,0.25)]',
    imageDrop: 'drop-shadow-[0_0_12px_rgba(168,85,247,0.45)]',
    badge: 'bg-purple-600 text-white font-black',
    label: 'STANDARD',
  };
}

export const P2PTradeView = ({ initialRoomCode, onClose, onSwitchToSystem, onSessionStateChange }: P2PTradeViewProps) => {
  const { user } = useAuth();
  const { friends, myFriendCode, addFriend } = useFriends();
  const { play: playSfx } = useSfx();

  const {
    session, isCreator, myParticipant, theirParticipant,
    myUsername, myAvatarUrl, userCards, packs, potions,
    createTradeRoom, joinTradeRoom, addItemToOffer, removeItemFromOffer,
    toggleReady, sendMessage, finalizeTrade, cancelTrade,
    allCards, saveSession, setCurrentCode,
  } = useP2PTrade();

  const { publicRooms, publishPublicRoom, closePublicRoom } = usePublicTradeRooms(
    session?.code,
    myUsername,
    user?.id
  );

  const [lobbyTab, setLobbyTab] = useState<'public' | 'friends'>('public');
  const [inventoryTab, setInventoryTab] = useState<'cards' | 'packs' | 'potions'>('cards');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { sendTradeInvite } = useTradeInvite();

  useEffect(() => { onSessionStateChange?.(!!session && session.status !== 'cancelled'); }, [session, onSessionStateChange]);

  const [inputCode, setInputCode]             = useState('');
  const [searchQuery, setSearchQuery]         = useState('');
  const [chatInput, setChatInput]             = useState('');
  const [copiedCode, setCopiedCode]           = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [friendInputCode, setFriendInputCode] = useState('');
  const [addingFriend, setAddingFriend]       = useState(false);
  const [copiedShare, setCopiedShare]         = useState(false);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [session?.messages]);

  useEffect(() => { if (initialRoomCode) joinTradeRoom(initialRoomCode); }, [initialRoomCode, joinTradeRoom]);

  useEffect(() => {
    const handler = (e: any) => { if (e?.detail?.roomCode) joinTradeRoom(e.detail.roomCode); };
    window.addEventListener('open_trade_room', handler);
    const pending = (window as any).__pendingTradeRoomCode || sessionStorage.getItem('flipz_pending_trade_room');
    if (pending) {
      (window as any).__pendingTradeRoomCode = null;
      try { sessionStorage.removeItem('flipz_pending_trade_room'); } catch {}
      joinTradeRoom(pending);
    }
    return () => window.removeEventListener('open_trade_room', handler);
  }, [joinTradeRoom]);

  useEffect(() => { if (session?.status === 'completed') playSfx('collectSuccess'); }, [session?.status, playSfx]);

  const unmountRoomCodeRef = useRef<string | null>(null);
  const unmountIsCreatorRef = useRef<boolean>(false);
  const unmountStatusRef = useRef<string>('');
  const closePublicRoomRef = useRef(closePublicRoom);
  closePublicRoomRef.current = closePublicRoom;

  useEffect(() => {
    unmountRoomCodeRef.current = session?.code || null;
    unmountIsCreatorRef.current = isCreator;
    unmountStatusRef.current = session?.status || '';
  }, [session?.code, session?.status, isCreator]);

  // Automatically close and remove public room strictly when unmounting while waiting
  useEffect(() => {
    return () => {
      if (unmountRoomCodeRef.current && unmountIsCreatorRef.current && unmountStatusRef.current === 'waiting') {
        closePublicRoomRef.current(unmountRoomCodeRef.current);
      }
    };
  }, []);

  // ─ Copy helper
  const copyToClipboard = (text: string) => {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(() => {});
    try {
      const ta = document.createElement('textarea'); ta.value = text;
      ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    } catch {}
  };
  const handleCopyMyCode = () => {
    copyToClipboard(myFriendCode); setCopiedCode(true);
    toast.success(`Code ami ${myFriendCode} copie !`);
    setTimeout(() => setCopiedCode(false), 2500);
  };
  const handleCopyRoomCode = () => {
    if (!session?.code) return;
    copyToClipboard(session.code); setCopiedCode(true);
    toast.success('Code salon copie !');
    setTimeout(() => setCopiedCode(false), 2000);
  };
  const handleShareInvite = async () => {
    const text = `Rejoins-moi sur FLIPZ ! Mon code ami : ${myFriendCode}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Echange FLIPZ', text, url: window.location.origin + '/shop' }); toast.success('Invitation partagee !'); return; } catch {}
    }
    copyToClipboard(text); setCopiedShare(true);
    toast.success("Message d'invitation copie !");
    setTimeout(() => setCopiedShare(false), 3000);
  };

  // ─ Offer map
  const offeredMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of myParticipant?.offer || []) map.set(item.id, item.quantity || 1);
    return map;
  }, [myParticipant?.offer]);

  // ─ Create Public Room
  const handleCreatePublicRoom = () => {
    const code = createTradeRoom();
    publishPublicRoom({
      code,
      creatorId: user?.id || 'user_' + Date.now(),
      creatorName: myUsername,
      creatorAvatar: myAvatarUrl || null,
      createdAt: new Date().toISOString(),
      status: 'waiting',
    });
    toast.success(`Salon public ${code} cree ! Visible par tous les joueurs.`);
  };

  // ─ Join Public Room (Real human room)
  const handleJoinPublicRoom = (room: PublicTradeRoom) => {
    joinTradeRoom(room.code);
  };

  // ─ Cancel with cleanup
  const handleCancelTrade = () => {
    if (session?.code) {
      closePublicRoom(session.code);
    }
    cancelTrade();
  };

  const handleToggleReady = () => {
    if (!session) return;
    toggleReady();
  };

  // ─ Render a single trade item card
  const renderTradeItemCard = (item: TradeItem, onRemove?: () => void) => {
    if (item.type === 'pack') {
      const packKind = (item.metadata?.packType || item.metadata?.packId || item.title || '').toString();
      const pStyles = getPackStyleDetails(packKind);
      const packImg = item.imageUrl || getPackImage(item.metadata?.packId || 'booster');
      const cardCount = item.metadata?.cardCount;

      return (
        <div key={item.id} className={`relative rounded-xl overflow-hidden ${pStyles.border} ${pStyles.glow} ${pStyles.container} w-full h-full aspect-[3/4] flex flex-col justify-between p-1.5 transition-all select-none group`}>
          {/* Subtle background radial pattern like boutique */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_20%,rgba(0,0,0,0.4)_70%)]" />
            <div className="absolute top-1 left-1 w-2 h-2 border border-yellow-400/30 rounded-full" />
            <div className="absolute top-1 right-1 w-2 h-2 border border-yellow-400/30 rounded-full" />
          </div>

          {/* Centered boutique pack image */}
          <div className="absolute inset-0 flex items-center justify-center p-2 pointer-events-none">
            <img
              src={packImg}
              alt={item.title}
              className={`w-auto h-[74%] max-w-[85%] object-contain ${pStyles.imageDrop} group-hover:scale-105 transition-transform duration-300`}
              draggable={false}
            />
          </div>

          {/* Vignette overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30 pointer-events-none" />

          {/* Top badges */}
          <div className="relative z-10 flex items-start justify-between gap-1">
            <span className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded shadow-sm leading-none ${pStyles.badge}`}>
              {pStyles.label}
            </span>
            {onRemove ? (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onRemove(); }}
                className="w-5 h-5 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition-all active:scale-90 flex-shrink-0 cursor-pointer"
                title="Retirer"
              >
                <X className="w-3 h-3 stroke-[3]" />
              </button>
            ) : (
              (item.quantity && item.quantity > 1) ? (
                <span className="bg-yellow-400 text-black font-black text-[8px] px-1.5 py-0.5 rounded-full shadow">
                  x{item.quantity}
                </span>
              ) : cardCount ? (
                <span className="bg-black/60 border border-white/20 text-yellow-300 font-bold text-[7px] px-1.5 py-0.5 rounded-full">
                  {cardCount}c
                </span>
              ) : null
            )}
          </div>

          {/* Bottom Title */}
          <div className="relative z-10 text-center px-0.5">
            <span className="text-white font-extrabold text-[9px] sm:text-[10px] block truncate leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              {item.title}
            </span>
          </div>
        </div>
      );
    }

    const s = getRarityStyle(item);
    const label = getRarityLabel(item);
    return (
      <div key={item.id} className={`relative rounded-xl overflow-hidden border-2 ${s.border} ${s.glow} bg-[#0c0d1a] w-full h-full aspect-[3/4] flex flex-col justify-between p-1.5 transition-all select-none group`}>
        {item.type === 'card' && item.imageUrl
          ? <img src={item.imageUrl} alt={item.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          : item.type === 'potion'
          ? <div className="absolute inset-0 flex items-center justify-center p-2 bg-gradient-to-b from-cyan-950/70 to-black/90"><PotionBottle type={item.metadata?.type || 'luck'} size="sm" /></div>
          : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent pointer-events-none" />
        <div className="relative z-10 flex items-start justify-between gap-1">
          <span className={`text-[8px] uppercase tracking-wide px-1.5 py-0.5 rounded font-black shadow-sm leading-none ${s.badge}`}>{label}</span>
          {onRemove
            ? <button type="button" onClick={e => { e.stopPropagation(); onRemove(); }} className="w-5 h-5 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition-all active:scale-90 flex-shrink-0 cursor-pointer" title="Retirer"><X className="w-3 h-3 stroke-[3]" /></button>
            : (item.quantity && item.quantity > 1) ? <span className="bg-yellow-400 text-black font-black text-[8px] px-1.5 py-0.5 rounded-full shadow">x{item.quantity}</span> : null}
        </div>
        <div className="relative z-10 text-center px-0.5">
          <span className="text-white font-bold text-[9px] sm:text-[10px] block truncate leading-tight drop-shadow">{item.title}</span>
        </div>
      </div>
    );
  };

  // ─ Render 6-slot offer grid
  const renderOfferSlots = (items: TradeItem[], isMyOffer: boolean) => (
    <div className="grid grid-cols-3 gap-1.5">
      {Array.from({ length: 6 }).map((_, idx) => {
        const item = items[idx];
        return item
          ? <div key={item.id} className="aspect-[3/4]">{renderTradeItemCard(item, isMyOffer ? () => removeItemFromOffer(item.id) : undefined)}</div>
          : (
            <div key={`empty-${idx}`} className={`aspect-[3/4] rounded-xl border-2 border-dashed ${isMyOffer ? 'border-yellow-500/20 hover:border-yellow-500/40 bg-yellow-500/[0.03]' : 'border-white/[0.08] bg-white/[0.02]'} flex flex-col items-center justify-center gap-0.5 transition-colors`}>
              {isMyOffer
                ? <><span className="text-yellow-500/40 text-sm font-black leading-none">+</span><span className="text-[7px] font-bold text-yellow-500/30 uppercase">Slot {idx + 1}</span></>
                : <span className="text-[7px] font-medium text-zinc-600 italic">Vide</span>}
            </div>
          );
      })}
    </div>
  );

  // ══ SCREEN: COMPLETED ══════════════════════════════════════════════════════
  if (session?.status === 'completed') {
    const receivedItems = isCreator ? (session.partner?.offer || []) : session.creator.offer;
    const givenItems    = isCreator ? session.creator.offer : (session.partner?.offer || []);
    const partnerName   = (isCreator ? session.partner?.username : session.creator.username) || 'Partenaire';
    return (
      <div className="w-full max-w-2xl mx-auto flex flex-col text-white select-none p-5 sm:p-6 gap-5 animate-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-emerald-300 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.6)]">
              <Handshake className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-yellow-400 flex items-center justify-center shadow-lg"><Sparkles className="w-4 h-4 text-black" /></div>
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Echange Reussi !</h2>
            <p className="text-sm text-zinc-400 mt-1">Finalise avec <span className="text-emerald-400 font-bold">@{partnerName}</span></p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-2xl bg-emerald-950/30 border border-emerald-500/30 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center"><Sparkles className="w-3.5 h-3.5 text-emerald-400" /></div>
              <span className="text-emerald-400 text-xs font-black uppercase tracking-wider">Vous avez recu ({receivedItems.length})</span>
            </div>
            {receivedItems.length === 0
              ? <p className="text-zinc-500 text-xs italic text-center py-4">Aucun objet recu</p>
              : <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">{receivedItems.map(item => <div key={item.id} className="aspect-[3/4]">{renderTradeItemCard(item)}</div>)}</div>}
          </div>
          <div className="rounded-2xl bg-zinc-900/40 border border-zinc-700/50 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-zinc-700/50 border border-zinc-600/50 flex items-center justify-center"><ArrowLeftRight className="w-3.5 h-3.5 text-zinc-400" /></div>
              <span className="text-zinc-300 text-xs font-black uppercase tracking-wider">Vous avez donne ({givenItems.length})</span>
            </div>
            {givenItems.length === 0
              ? <p className="text-zinc-500 text-xs italic text-center py-4">Aucun objet donne</p>
              : <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">{givenItems.map(item => <div key={item.id} className="aspect-[3/4]">{renderTradeItemCard(item)}</div>)}</div>}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={() => { onClose?.(); window.location.href = '/collection'; }} className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 active:scale-[0.98] text-black font-black text-sm uppercase tracking-wider shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer"><Sparkles className="w-4 h-4" /> Voir ma collection</button>
          <button onClick={() => setCurrentCode(null)} className="px-5 py-3.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-white font-bold text-sm uppercase tracking-wider transition-all cursor-pointer">Nouvel echange</button>
          {onClose && <button onClick={onClose} className="px-4 py-3.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white font-bold text-sm transition-all cursor-pointer">Fermer</button>}
        </div>
      </div>
    );
  }

  // ══ SCREEN: LOBBY ═════════════════════════════════════════════════════════
  if (!session) {
    const allPlayers = friends.map(f => ({
      id: f.id, name: f.username,
      handle: `@${f.username.toLowerCase().replace(/\s+/g, '_')}`,
      avatar: f.avatarUrl && !f.avatarUrl.includes('avatar_sigma') ? f.avatarUrl : null,
      status: f.status, friendCode: f.friendCode || f.id,
    }));

    const handleSendTrade = (player: typeof allPlayers[0]) => {
      const roomCode = createTradeRoom();
      sendTradeInvite({ roomCode, targetFriendCode: player.friendCode, targetUserId: player.id, targetName: player.name, senderAvatar: myAvatarUrl || user?.user_metadata?.avatar_url || null });
      toast.success(`Demande d'echange envoyee a ${player.name} !`);
    };

    return (
      <div className="w-full max-w-xl mx-auto flex flex-col text-white select-none p-3.5 sm:p-5 gap-3.5">
        
        {/* Lobby Navigation Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/50 border border-white/10">
          <button
            type="button"
            onClick={() => setLobbyTab('public')}
            className={`flex-1 py-2 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${lobbyTab === 'public' ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'text-zinc-400 hover:text-white'}`}
          >
            <Globe className="w-4 h-4" />
            <span>Salons Publics</span>
            {publicRooms.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${lobbyTab === 'public' ? 'bg-black/30 text-black' : 'bg-white/10 text-zinc-300'}`}>
                {publicRooms.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setLobbyTab('friends')}
            className={`flex-1 py-2 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${lobbyTab === 'friends' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'text-zinc-400 hover:text-white'}`}
          >
            <Users className="w-4 h-4" />
            <span>Amis ({allPlayers.length})</span>
          </button>
        </div>

        {/* ── TAB 1: SALONS PUBLICS ── */}
        {lobbyTab === 'public' && (
          <div className="flex flex-col gap-3 animate-in fade-in duration-200">
            {/* Create Room CTA */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 via-[#181524] to-purple-900/20 border-2 border-amber-500/30 flex flex-col gap-2.5 shadow-[0_4px_20px_rgba(245,158,11,0.15)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center">
                    <Radio className="w-4 h-4 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">Créer votre salon</h3>
                    <p className="text-[10px] text-zinc-400">Accessible et visible par tous les joueurs</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-amber-400/90 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">Public</span>
              </div>
              
              <button
                type="button"
                onClick={handleCreatePublicRoom}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 active:scale-[0.98] text-black font-extrabold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(234,179,8,0.35)] transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" /> Créer un salon public
              </button>
            </div>

            {/* Public Rooms List */}
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  <span className="text-xs font-black uppercase tracking-wider text-white">Salons disponibles</span>
                </div>
                {publicRooms.length > 0 && <span className="text-[10px] text-zinc-400">Rejoindre en 1 clic</span>}
              </div>

              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto scrollbar-thin pr-0.5">
                {publicRooms.length === 0 ? (
                  <div className="py-8 rounded-2xl flex flex-col items-center justify-center gap-2 border border-dashed border-white/10 bg-white/[0.02] text-center">
                    <Globe className="w-8 h-8 text-zinc-600" />
                    <p className="text-xs text-zinc-300 font-bold">Aucun salon public ouvert actuellement</p>
                    <p className="text-[10px] text-zinc-500">Créez votre salon ci-dessus pour que d'autres joueurs vous rejoignent !</p>
                  </div>
                ) : (
                  publicRooms.map(room => (
                    <div
                      key={room.code}
                      className="flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-amber-400/30 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="w-9 h-9 rounded-xl border border-amber-400/30 bg-amber-950/40 flex-shrink-0">
                          {room.creatorAvatar && <AvatarImage src={room.creatorAvatar} alt={room.creatorName} className="object-cover" />}
                          <AvatarFallback className="bg-gradient-to-tr from-amber-700 to-yellow-600 text-black font-black text-xs rounded-xl">
                            {room.creatorName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-white text-xs sm:text-sm font-bold truncate">@{room.creatorName}</span>
                            <span className="px-1.5 py-0.2 rounded-md bg-purple-950/60 border border-purple-500/30 text-purple-300 font-mono text-[10px] font-bold">
                              #{room.code}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                              1/2 En attente
                            </span>
                            <span className="text-zinc-600 text-[10px]">•</span>
                            <span className="text-zinc-500 text-[10px]">Ouvert à tous</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleJoinPublicRoom(room)}
                        className="flex-shrink-0 ml-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110 active:scale-95 text-black font-extrabold text-[11px] uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.35)] transition-all cursor-pointer"
                      >
                        <Swords className="w-3.5 h-3.5" /> Rejoindre
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: AMIS ── */}
        {lobbyTab === 'friends' && (
          <div className="flex flex-col gap-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-white">Amis</span>
              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 font-bold cursor-pointer"
              >
                <UserPlus className="w-3 h-3" /> Ajouter un ami
              </button>
            </div>

            <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto scrollbar-thin pr-0.5">
              {allPlayers.length === 0 ? (
                <div className="py-8 rounded-2xl flex flex-col items-center justify-center gap-2 border border-dashed border-purple-500/20 bg-purple-500/5 text-center">
                  <Users className="w-8 h-8 text-purple-400/60" />
                  <p className="text-white text-xs font-bold">Aucun ami pour l'instant</p>
                  <button type="button" onClick={() => setShowInviteModal(true)} className="mt-1 px-3 py-1.5 rounded-xl bg-purple-600 text-white font-bold text-xs uppercase cursor-pointer">Ajouter un ami</button>
                </div>
              ) : allPlayers.map(player => (
                <div key={player.id} className="flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-purple-500/30 transition-all">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative flex-shrink-0">
                      <Avatar className="w-9 h-9 rounded-xl border border-purple-500/25 bg-purple-950/30">
                        {player.avatar && <AvatarImage src={player.avatar} alt={player.name} className="object-cover" />}
                        <AvatarFallback className="bg-gradient-to-tr from-purple-800 to-indigo-700 text-white font-black text-xs rounded-xl">{player.name?.slice(0, 2).toUpperCase() || 'FL'}</AvatarFallback>
                      </Avatar>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0a0a14] ${player.status === 'online' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-zinc-600'}`} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-white text-xs sm:text-sm font-bold truncate">{player.name}</span>
                      <span className="text-zinc-500 text-[10px] font-mono truncate">{player.handle}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => handleSendTrade(player)} className="flex-shrink-0 ml-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-400 hover:brightness-110 active:scale-95 text-black font-extrabold text-[11px] uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_12px_rgba(234,179,8,0.3)] transition-all cursor-pointer">
                    <Swords className="w-3.5 h-3.5" /> Echanger
                  </button>
                </div>
              ))}
            </div>

            <button type="button" onClick={() => setShowInviteModal(true)} className="w-full py-2.5 px-4 rounded-xl bg-purple-900/20 hover:bg-purple-900/35 border border-purple-500/20 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer">
              <UserPlus className="w-4 h-4 text-amber-400" /> Mon Code Ami & Partage
            </button>
          </div>
        )}

        {/* Join by code */}
        <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.08] flex flex-col sm:flex-row items-center gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <KeyRound className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
            <span className="text-[11px] text-zinc-400">Rejoindre avec un code :</span>
          </div>
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Input placeholder="Ex: 5JFD67" value={inputCode} onChange={e => setInputCode(e.target.value.toUpperCase())} className="h-8 w-full sm:w-28 bg-black/40 border-white/15 focus:border-purple-400 text-white font-mono uppercase tracking-widest text-xs text-center rounded-xl" maxLength={6} />
            <button type="button" onClick={() => { if (!inputCode.trim()) { toast.error('Entrez un code !'); return; } joinTradeRoom(inputCode); }} disabled={!inputCode.trim()} className="h-8 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-[11px] font-bold uppercase transition-all cursor-pointer flex-shrink-0">Rejoindre</button>
          </div>
        </div>

        {/* Switch to system */}
        {onSwitchToSystem && (
          <div className="flex justify-center">
            <button onClick={onSwitchToSystem} className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1.5 transition-colors cursor-pointer">
              <ArrowLeftRight className="w-3.5 h-3.5 text-yellow-500/60" /> Passer au Recyclage Systeme
            </button>
          </div>
        )}

        {/* Invite modal */}
        {showInviteModal && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-200">
            <div className="w-full max-w-sm flex flex-col text-white overflow-hidden rounded-3xl bg-[#0e0f1e] border border-purple-500/25 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_40px_rgba(112,26,117,0.3)]">
              <div className="px-4 py-3.5 bg-gradient-to-r from-purple-950/60 via-[#131124] to-purple-950/60 border-b border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center"><UserPlus className="w-3.5 h-3.5 text-white" /></div>
                  <span className="text-sm font-black text-white uppercase tracking-wide">Inviter des amis</span>
                </div>
                <button type="button" onClick={() => setShowInviteModal(false)} className="w-7 h-7 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/20 flex flex-col gap-1.5">
                  <span className="text-[11px] font-black text-purple-300 uppercase tracking-wider">Votre code ami</span>
                  <div className="flex items-center justify-between gap-2">
                    <span id="my-friend-code-value" className="font-mono font-extrabold text-2xl text-yellow-300 tracking-widest select-all cursor-pointer" onClick={handleCopyMyCode}>{myFriendCode}</span>
                    <button type="button" id="btn-copy-friend-code" onClick={handleCopyMyCode} className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center gap-1.5 border border-white/10 transition-all active:scale-95 cursor-pointer">
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-300" />}
                      <span>{copiedCode ? 'Copie !' : 'Copier'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-500">Partagez ce code pour que vos amis vous ajoutent.</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex flex-col gap-2">
                  <span className="text-[11px] font-black text-zinc-400 uppercase tracking-wider">Ajouter un ami par son code</span>
                  <div className="flex items-center gap-2">
                    <input id="input-friend-code" autoFocus placeholder="FPZ-A7K92B" value={friendInputCode}
                      onChange={e => setFriendInputCode(e.target.value.toUpperCase())}
                      onKeyDown={async e => { if (e.key === 'Enter' && friendInputCode.trim() && !addingFriend) { setAddingFriend(true); const ok = await addFriend(friendInputCode.trim()); setAddingFriend(false); if (ok) { setFriendInputCode(''); setShowInviteModal(false); } } }}
                      className="h-10 bg-black/40 border border-white/15 focus:border-purple-400 text-white placeholder-zinc-600 font-mono font-bold text-xs uppercase tracking-wider px-3 rounded-xl flex-1 outline-none transition-colors" />
                    <button type="button" id="btn-add-friend" disabled={addingFriend}
                      onClick={async () => { if (!friendInputCode.trim()) { toast.error('Entrez un code ami !'); return; } setAddingFriend(true); const ok = await addFriend(friendInputCode.trim()); setAddingFriend(false); if (ok) { setFriendInputCode(''); setShowInviteModal(false); } }}
                      className="h-10 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 active:scale-95 text-white font-bold text-xs uppercase transition-all cursor-pointer flex-shrink-0">{addingFriend ? '...' : 'Ajouter'}</button>
                  </div>
                </div>
                <button type="button" id="btn-share-invite" onClick={handleShareInvite} className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-purple-600/15 to-indigo-600/15 hover:from-purple-600/25 hover:to-indigo-600/25 border border-purple-500/20 hover:border-purple-400/40 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer">
                  {copiedShare ? <span className="text-emerald-400 flex items-center gap-1.5"><Check className="w-4 h-4" /> Copie !</span> : <><Share2 className="w-4 h-4 text-purple-400" /> Partager l'invitation</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══ SCREEN: ACTIVE TRADE ROOM ══════════════════════════════════════════════
  const myOffer     = myParticipant?.offer   || [];
  const theirOffer  = theirParticipant?.offer || [];
  const partnerName = theirParticipant?.username || 'En attente...';
  const isWaitingPartner = !theirParticipant || session.status === 'waiting';
  const bothReady   = Boolean(myParticipant?.isReady && theirParticipant?.isReady);

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col text-white select-none overflow-hidden">

      {/* HEADER */}
      <div className="px-3 sm:px-4 py-2.5 bg-[#0d0d1a] border-b border-purple-500/20 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl border border-purple-500/30 bg-purple-950/50 flex-shrink-0">
            {theirParticipant?.avatarUrl && <AvatarImage src={theirParticipant.avatarUrl} alt={partnerName} className="object-cover" />}
            <AvatarFallback className="bg-gradient-to-tr from-purple-800 to-indigo-700 text-white font-black text-xs rounded-xl">{partnerName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-white text-xs sm:text-sm font-black truncate">@{partnerName}</span>
              <span className={theirParticipant?.isReady ? "px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse" : "px-2 py-0.5 rounded-full text-[10px] font-bold text-zinc-400 bg-zinc-800 border border-zinc-700"}>
                {theirParticipant?.isReady ? 'Pret' : isWaitingPartner ? 'En attente...' : 'En cours'}
              </span>
            </div>
            <span className="text-[10px] text-zinc-500">{isWaitingPartner ? 'Salon public ouvert à tous' : "Partenaire d'echange"}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={handleCopyRoomCode} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-950/50 hover:bg-purple-900/70 border border-purple-500/30 text-purple-200 text-[11px] font-mono font-bold transition-all active:scale-95 cursor-pointer">
            <span className="hidden sm:inline text-purple-400/70 text-[10px]">CODE:</span>{session.code}
            {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-purple-400/70" />}
          </button>
        </div>
      </div>

      {/* TRADE TABLE: Mobile */}
      <div className="sm:hidden p-2.5 flex flex-col gap-2.5 bg-[#08091a]">
        <div className="p-3 rounded-2xl bg-[#0d0d1c] border border-yellow-500/20">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
              <span className="text-yellow-400 text-xs font-black uppercase tracking-wider">Vous donnez</span>
              <span className="text-[10px] font-mono text-zinc-400 bg-black/50 px-2 py-0.5 rounded-full">{myOffer.length}/6</span>
            </div>
            {myOffer.length > 0 && <button type="button" onClick={() => myOffer.forEach(it => removeItemFromOffer(it.id, true))} className="text-red-400 hover:text-red-300 text-[10px] font-bold cursor-pointer">Tout retirer</button>}
          </div>
          {myOffer.length === 0
            ? <div className="py-3 text-center border-2 border-dashed border-yellow-500/15 rounded-xl bg-yellow-500/[0.03]"><span className="text-xs text-zinc-500">Touchez une carte ci-dessous</span></div>
            : <div className="flex gap-2 overflow-x-auto pb-1">{myOffer.map(item => <div key={item.id} className="w-[80px] h-[108px] flex-shrink-0">{renderTradeItemCard(item, () => removeItemFromOffer(item.id))}</div>)}</div>}
        </div>
        <div className="p-3 rounded-2xl bg-[#0d0d1c] border border-emerald-500/20">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="text-emerald-400 text-xs font-black uppercase tracking-wider">Vous recevez</span>
              <span className="text-[10px] font-mono text-zinc-400 bg-black/50 px-2 py-0.5 rounded-full">{theirOffer.length}/6</span>
            </div>
            <span className="text-emerald-400 text-xs font-bold truncate max-w-[120px]">@{partnerName}</span>
          </div>
          {isWaitingPartner ? (
            <div className="py-5 px-3 text-center border-2 border-dashed border-emerald-500/20 rounded-xl bg-emerald-500/[0.03] flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-wider">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                En attente d'un joueur...
              </div>
              <p className="text-[11px] text-zinc-400 max-w-xs">Ce salon est public et ouvert. Dès qu'un joueur rejoint, l'échange commence !</p>
              <button
                type="button"
                onClick={handleCopyRoomCode}
                className="mt-1 px-3.5 py-2 rounded-xl bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 text-purple-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" /> Partager le code #{session.code}
              </button>
            </div>
          ) : theirOffer.length === 0 ? (
            <div className="py-3 text-center border-2 border-dashed border-emerald-500/15 rounded-xl bg-emerald-500/[0.03]"><span className="text-xs text-zinc-500 italic">Offre vide</span></div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">{theirOffer.map(item => <div key={item.id} className="w-[80px] h-[108px] flex-shrink-0">{renderTradeItemCard(item)}</div>)}</div>
          )}
        </div>
      </div>

      {/* TRADE TABLE: Desktop */}
      <div className="hidden sm:grid sm:grid-cols-2 gap-3 p-4 bg-[#08091a]">
        <div className="p-4 rounded-2xl bg-[#0d0d1c] border border-yellow-500/15 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <span className="text-yellow-400 text-xs font-black uppercase tracking-wider">Vous donnez</span>
              <span className="text-[10px] font-mono text-zinc-400 bg-black/50 px-2 py-0.5 rounded-full border border-white/[0.08]">{myOffer.length}/6</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={myParticipant?.isReady ? "text-[10px] font-black text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-500/30" : "text-[10px] font-bold text-yellow-300 bg-yellow-950/50 px-2 py-0.5 rounded-full border border-yellow-500/20"}>
                {myParticipant?.isReady ? 'Pret' : 'En cours'}
              </span>
              {myOffer.length > 0 && <button type="button" onClick={() => myOffer.forEach(it => removeItemFromOffer(it.id, true))} className="text-red-400/70 hover:text-red-300 text-[10px] font-bold cursor-pointer transition-colors">Retirer tout</button>}
            </div>
          </div>
          {renderOfferSlots(myOffer, true)}
          <p className="text-[10px] text-zinc-600">{myOffer.length ? `${myOffer.length} slot(s) occupe(s)` : 'Cliquez sur un objet ci-dessous'}</p>
        </div>
        <div className="p-4 rounded-2xl bg-[#0d0d1c] border border-emerald-500/15 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-emerald-400 text-xs font-black uppercase tracking-wider">Vous recevez</span>
              <span className="text-[10px] font-mono text-zinc-400 bg-black/50 px-2 py-0.5 rounded-full border border-white/[0.08]">{theirOffer.length}/6</span>
            </div>
            <span className={theirParticipant?.isReady ? "text-[10px] font-black text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-500/30 animate-pulse" : "text-[10px] font-bold text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-700"}>
              {theirParticipant?.isReady ? 'Pret' : isWaitingPartner ? 'En attente...' : 'En cours...'}
            </span>
          </div>
          {isWaitingPartner ? (
            <div className="flex-1 min-h-[180px] rounded-xl border-2 border-dashed border-emerald-500/20 bg-emerald-500/[0.02] flex flex-col items-center justify-center gap-2.5 p-4 text-center">
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-ping" />
              <p className="text-sm font-black text-white">En attente qu'un joueur rejoigne le salon...</p>
              <p className="text-xs text-zinc-400 max-w-xs">Ce salon est public et ouvert. Dès qu'un joueur clique sur Rejoindre, l'échange commence !</p>
              <button
                type="button"
                onClick={handleCopyRoomCode}
                className="mt-2 px-4 py-2 rounded-xl bg-purple-900/30 hover:bg-purple-900/50 border border-purple-500/30 text-purple-200 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" /> Copier le code #{session.code}
              </button>
            </div>
          ) : (
            renderOfferSlots(theirOffer, false)
          )}
          <p className="text-[10px] text-emerald-500/70 font-bold">@{partnerName}</p>
        </div>
      </div>

      {/* CHAT MESSAGES */}
      {(session.messages?.length ?? 0) > 0 && (
        <div className="px-3 sm:px-4 py-2 bg-[#08091a] border-t border-white/[0.04]">
          <div className="max-h-[80px] overflow-y-auto space-y-1 scrollbar-thin">
            {(session.messages || []).slice(-5).map(msg => (
              <div key={msg.id} className={`flex items-start gap-2 text-[11px] ${msg.senderId === user?.id ? 'flex-row-reverse' : 'flex-row'}`}>
                <span className="font-black shrink-0" style={{ color: msg.senderId === user?.id ? '#a78bfa' : '#34d399' }}>@{msg.senderName?.split(' ')[0]}:</span>
                <span className={`px-2 py-1 rounded-lg max-w-[200px] leading-snug ${msg.senderId === user?.id ? 'bg-purple-600/25 text-purple-100' : 'bg-zinc-800/80 text-zinc-200'}`}>{msg.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </div>
      )}

      {/* INVENTORY */}
      <div className="px-2.5 sm:px-4 py-2.5 bg-[#090915] border-t border-purple-500/15 flex flex-col gap-2">
        {inventoryTab === 'cards' && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input placeholder="Chercher une carte..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 h-8 bg-black/40 border border-white/10 focus:border-purple-400 text-white placeholder-zinc-600 text-xs rounded-xl outline-none transition-colors" />
          </div>
        )}
        <div className="flex items-center gap-1 bg-black/30 p-0.5 rounded-xl border border-white/[0.08] text-[11px] font-bold">
          {[
            { key: 'cards',   label: `Cartes (${userCards.length})`,                          icon: <Star className="w-3 h-3" /> },
            { key: 'packs',   label: `Boosters (${packs.length})`,                            icon: <Package className="w-3 h-3" /> },
            { key: 'potions', label: `Potions (${potions.reduce((a, b) => a + b.quantity, 0)})`, icon: <Zap className="w-3 h-3" /> },
          ].map(tab => (
            <button key={tab.key} onClick={() => setInventoryTab(tab.key as any)}
              className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-lg transition-all cursor-pointer ${inventoryTab === tab.key ? 'bg-purple-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}>
              {tab.icon}<span className="hidden sm:inline">{tab.label}</span><span className="sm:hidden">{tab.key === 'cards' ? 'Cartes' : tab.key === 'packs' ? 'Boost.' : 'Pot.'}</span>
            </button>
          ))}
        </div>
        <div className="max-h-[155px] overflow-y-auto scrollbar-thin pr-0.5">
          {inventoryTab === 'cards' && (userCards.length === 0
            ? <p className="text-xs text-zinc-500 text-center py-6">Aucune carte</p>
            : <div className="grid grid-cols-5 sm:grid-cols-7 gap-1.5">
                {userCards.map(c => {
                  const itemId = 'card_' + c.id; const selQty = offeredMap.get(itemId) || 0; const isSel = selQty > 0;
                  return (
                    <div key={c.id} onClick={() => { if (myOffer.length >= 6 && !isSel) { toast.info('Offre complete (6/6).'); return; } addItemToOffer({ id: itemId, type: 'card', title: c.title, imageUrl: c.image_url, rarity: c.rarity, metadata: { cardId: c.id } }, c.count); }}
                      className={`relative aspect-[3/4] rounded-lg overflow-hidden cursor-pointer transition-all active:scale-95 border-2 ${isSel ? 'border-yellow-400 ring-1 ring-yellow-400/40 shadow-[0_0_10px_rgba(250,204,21,0.35)]' : 'border-zinc-700/50 hover:border-yellow-400/60'}`}>
                      <img src={c.image_url} alt={c.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                      {isSel
                        ? <div className="absolute top-0.5 right-0.5 z-10 px-1 py-0.5 rounded bg-yellow-400 text-black text-[7px] font-black">+{selQty}</div>
                        : <div className="absolute top-0.5 right-0.5 z-10 px-1 py-0.5 rounded bg-black/60 text-zinc-300 text-[7px] font-mono">x{c.count}</div>}
                      <span className="absolute bottom-0.5 inset-x-0.5 text-[7px] font-bold text-white truncate text-center z-10">{c.title}</span>
                    </div>
                  );
                })}
              </div>)}
          {inventoryTab === 'packs' && (packs.length === 0
            ? <p className="text-xs text-zinc-500 text-center py-6">Aucun booster</p>
            : <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {packs.map(p => {
                  const itemId = 'pack_' + p.instanceId;
                  const isSel = offeredMap.has(itemId);
                  const pStyles = getPackStyleDetails(p.packType || p.packId);
                  const packImg = getPackImage(p.packId);
                  return (
                    <div
                      key={p.instanceId}
                      onClick={() => {
                        if (myOffer.length >= 6 && !isSel) {
                          toast.info('Offre complete (6/6).');
                          return;
                        }
                        addItemToOffer({
                          id: itemId,
                          type: 'pack',
                          title: p.name,
                          imageUrl: packImg,
                          metadata: { packId: p.packId, packType: p.packType, cardCount: p.cardCount, cards: p.cards }
                        }, 1);
                      }}
                      className={`relative aspect-[3/4] rounded-xl overflow-hidden p-2 cursor-pointer transition-all active:scale-95 flex flex-col justify-between group ${pStyles.container} ${pStyles.border} ${pStyles.glow} ${isSel ? 'ring-2 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]' : ''}`}
                    >
                      {/* Background radial glow */}
                      <div className="absolute inset-0 opacity-20 pointer-events-none">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_20%,rgba(0,0,0,0.4)_70%)]" />
                        <div className="absolute top-1 left-1 w-2 h-2 border border-yellow-400/30 rounded-full" />
                        <div className="absolute top-1 right-1 w-2 h-2 border border-yellow-400/30 rounded-full" />
                      </div>

                      {/* Top Badges */}
                      <div className="relative z-10 flex items-start justify-between">
                        <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded shadow ${pStyles.badge}`}>
                          {pStyles.label}
                        </span>
                        <span className="text-[8px] font-black text-amber-300 bg-black/60 border border-amber-400/30 px-1.5 py-0.2 rounded-full">
                          {p.cardCount}c
                        </span>
                      </div>

                      {/* Center Pack Image with boutique shadow */}
                      <div className="relative z-0 flex items-center justify-center my-auto">
                        <img
                          src={packImg}
                          alt={p.name}
                          className={`w-auto h-20 max-w-[85%] object-contain ${pStyles.imageDrop} group-hover:scale-105 transition-transform duration-200`}
                          draggable={false}
                        />
                      </div>

                      {/* Bottom Name & Selected Indicator */}
                      <div className="relative z-10 flex flex-col items-center">
                        <span className="text-[9px] font-extrabold text-white truncate w-full text-center drop-shadow">
                          {p.name}
                        </span>
                        {isSel && (
                          <span className="mt-0.5 px-2 py-0.2 rounded bg-yellow-400 text-black text-[8px] font-black shadow-md">
                            Offert
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>)}
          {inventoryTab === 'potions' && (potions.length === 0
            ? <p className="text-xs text-zinc-500 text-center py-6">Aucune potion</p>
            : <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {potions.map(pot => { const itemId = 'potion_' + pot.id; const selQty = offeredMap.get(itemId) || 0; const isSel = selQty > 0; return (
                  <div key={pot.id} onClick={() => { if (myOffer.length >= 6 && !isSel) { toast.info('Offre complete.'); return; } addItemToOffer({ id: itemId, type: 'potion', title: pot.name, metadata: { type: pot.type, description: pot.description, config: pot.config } }, pot.quantity); }}
                    className={`p-2 rounded-xl bg-[#121224] border-2 cursor-pointer transition-all active:scale-95 text-center flex flex-col items-center ${isSel ? 'border-yellow-400 ring-1 ring-yellow-400/40' : 'border-zinc-700/50 hover:border-yellow-400/60'}`}>
                    <div className="w-8 h-8 flex items-center justify-center my-0.5"><PotionBottle type={pot.type} size="sm" /></div>
                    <span className="text-[8px] font-bold text-white truncate w-full">{pot.name}</span>
                    <span className="text-[8px] text-yellow-300 font-mono">x{pot.quantity}</span>
                    {isSel && <span className="mt-0.5 px-1.5 py-0.5 rounded bg-yellow-400 text-black text-[7px] font-black">{selQty} offert</span>}
                  </div>
                ); })}
              </div>)}
        </div>
      </div>

      {/* FOOTER */}
      <div className="px-3 sm:px-4 py-3 bg-[#0d0d1a] border-t border-purple-500/20 flex flex-col gap-2.5">
        {/* Quick messages */}
        <div className="flex items-center gap-1.5">
          {[
            { label: 'Pret !',       msg: 'Je suis pret !' },
            { label: 'Equitable',    msg: "C'est equitable !" },
            { label: 'Ajoute +',     msg: 'Peux-tu ajouter un objet ?' },
            { label: 'Pas ok',       msg: "Je ne suis pas d'accord." },
          ].map(({ label, msg }) => (
            <button key={label} onClick={() => sendMessage(msg)} className="flex-1 py-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-700 text-zinc-200 text-[10px] sm:text-[11px] font-bold border border-white/[0.08] active:scale-95 transition-all truncate text-center cursor-pointer">{label}</button>
          ))}
        </div>
        {/* Chat input */}
        <div className="flex items-center gap-2">
          <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && chatInput.trim()) { sendMessage(chatInput.trim()); setChatInput(''); } }} placeholder="Envoyer un message..." className="flex-1 h-9 px-3 bg-black/40 border border-white/10 focus:border-purple-400/60 text-white placeholder-zinc-600 text-xs rounded-xl outline-none transition-colors" />
          <button onClick={() => { if (chatInput.trim()) { sendMessage(chatInput.trim()); setChatInput(''); } }} className="w-9 h-9 rounded-xl bg-purple-600/30 hover:bg-purple-600/60 border border-purple-500/30 flex items-center justify-center text-purple-300 hover:text-white transition-all cursor-pointer"><Send className="w-3.5 h-3.5" /></button>
        </div>
        {/* Main actions */}
        <div className="flex items-center gap-2">
          {bothReady ? (
            <button onClick={() => finalizeTrade()} className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110 active:scale-[0.98] text-black font-extrabold text-sm uppercase tracking-wider shadow-[0_0_30px_rgba(34,197,94,0.5)] transition-all cursor-pointer flex items-center justify-center gap-2">
              <ShieldCheck className="w-5 h-5 stroke-[2.5]" /> Confirmer l'echange !
            </button>
          ) : (
            <button onClick={handleToggleReady} className={`flex-1 py-3.5 rounded-xl font-extrabold text-sm uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${myParticipant?.isReady ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30' : 'bg-gradient-to-r from-emerald-500 to-green-500 hover:brightness-110 active:scale-[0.98] text-black shadow-[0_0_20px_rgba(34,197,94,0.35)]'}`}>
              {myParticipant?.isReady
                ? <><Clock className="w-4 h-4" /> En attente du partenaire</>
                : <><Check className="w-4 h-4 stroke-[2.5]" /> Valider mon offre</>}
            </button>
          )}
          <button onClick={handleCancelTrade} className="px-4 py-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white font-bold text-xs uppercase border border-white/10 transition-all cursor-pointer active:scale-95">Annuler</button>
        </div>
      </div>
    </div>
  );
};
