import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory } from '@/hooks/useInventory';
import { useUserCards, useAllCards, UserCardWithCount, applyUserCardTradeDelta } from '@/hooks/useCards';
import { StoredPack, StoredPotion } from '@/types/inventory';
import { GameCard } from '@/types/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export type TradeItemType = 'card' | 'pack' | 'potion';

export interface TradeItem {
  id: string; // unique item instance id or composite id
  type: TradeItemType;
  title: string;
  imageUrl?: string;
  rarity?: string;
  quantity?: number;
  metadata?: any;
}

export interface TradeParticipant {
  id: string;
  username: string;
  avatarUrl?: string;
  isReady: boolean;
  isConfirmed: boolean;
  offer: TradeItem[];
}

export interface TradeSession {
  code: string;
  createdAt: string;
  status: 'waiting' | 'active' | 'completed' | 'cancelled';
  creator: TradeParticipant;
  partner?: TradeParticipant;
  lastMessage?: {
    senderId: string;
    senderName?: string;
    text: string;
    timestamp: string;
  };
  messages?: Array<{
    id: string;
    senderId: string;
    senderName: string;
    text: string;
    timestamp: string;
  }>;
}

const STORAGE_PREFIX = 'flipz_trade_room_';

export const generateTradeRoomCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let res = '';
  for (let i = 0; i < 6; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
};

export const useP2PTrade = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { packs, potions, removePack, removePotion, addPack, addPotion } = useInventory();
  const { data: userCards = [], refetch: refetchUserCards } = useUserCards(user?.id);
  const { data: allCards = [] } = useAllCards();

  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const [session, setSession] = useState<TradeSession | null>(null);
  const [isCreator, setIsCreator] = useState<boolean>(true);
  const [myProfile, setMyProfile] = useState<{ username: string; avatarUrl?: string }>({
    username: user?.email?.split('@')[0] || 'Joueur',
    avatarUrl: undefined,
  });

  const [guestId] = useState<string>(() => {
    try {
      let gid = sessionStorage.getItem('flipz_client_id');
      if (!gid) {
        gid = 'guest_' + Math.random().toString(36).substring(2, 9);
        sessionStorage.setItem('flipz_client_id', gid);
      }
      return gid;
    } catch {
      return 'guest_' + Math.random().toString(36).substring(2, 9);
    }
  });

  const myId = user?.id || guestId;
  const myUsername = myProfile.username;
  const myAvatarUrl = myProfile.avatarUrl;

  const isCreatorRef = useRef(isCreator);
  useEffect(() => {
    isCreatorRef.current = isCreator;
  }, [isCreator]);

  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const roomChannelRef = useRef<any>(null);

  useEffect(() => {
    if (!user?.id) return;
    const fetchProfile = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', user.id)
          .maybeSingle();

        if (data) {
          setMyProfile({
            username: data.username || user.email?.split('@')[0] || 'Joueur',
            avatarUrl: data.avatar_url || undefined,
          });
        }
      } catch (e) {
        console.error('Error loading profile avatar:', e);
      }
    };
    fetchProfile();
  }, [user?.id]);

  // Broadcast helper
  const broadcastSessionUpdate = useCallback((updated: TradeSession) => {
    // 1. Broadcast via BroadcastChannel
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('flipz_room_' + updated.code);
        bc.postMessage(updated);
        setTimeout(() => bc.close(), 1000);
      }
    } catch {}

    // 2. Broadcast via Supabase Realtime
    try {
      const ch = roomChannelRef.current;
      if (ch) {
        if (typeof ch.httpSend === 'function') {
          ch.httpSend('session_update', updated).catch(() => {});
        }
        if (ch.state === 'joined') {
          ch.send({
            type: 'broadcast',
            event: 'session_update',
            payload: updated,
          }).catch(() => {});
        }
      } else {
        const fallback = supabase.channel('trade_room_' + updated.code, {
          config: { broadcast: { self: false } },
        });
        if (typeof fallback.httpSend === 'function') {
          fallback.httpSend('session_update', updated).catch(() => {});
        }
        fallback.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            fallback.send({
              type: 'broadcast',
              event: 'session_update',
              payload: updated,
            }).catch(() => {});
          }
        });
      }
    } catch (e) {
      console.warn('Supabase realtime broadcast session_update error:', e);
    }
  }, []);

  const saveSession = useCallback((updated: TradeSession) => {
    setSession(updated);
    try {
      localStorage.setItem(STORAGE_PREFIX + updated.code, JSON.stringify(updated));
      window.dispatchEvent(new StorageEvent('storage', {
        key: STORAGE_PREFIX + updated.code,
        newValue: JSON.stringify(updated)
      }));
    } catch (e) {
      console.error('Failed to save trade room', e);
    }

    broadcastSessionUpdate(updated);
  }, [broadcastSessionUpdate]);

  // Sync session with Supabase Realtime, BroadcastChannel and LocalStorage
  useEffect(() => {
    if (!currentCode) {
      setSession(null);
      return;
    }

    const loadLocal = () => {
      try {
        const raw = localStorage.getItem(STORAGE_PREFIX + currentCode);
        if (raw) {
          const parsed: TradeSession = JSON.parse(raw);
          setSession(parsed);
        }
      } catch (e) {
        console.error('Error reading trade session', e);
      }
    };

    loadLocal();

    // 1. Web BroadcastChannel (for multi-tabs on same browser)
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('flipz_room_' + currentCode);
      bc.onmessage = (e) => {
        if (e?.data) {
          setSession(e.data);
          try {
            localStorage.setItem(STORAGE_PREFIX + currentCode, JSON.stringify(e.data));
          } catch {}
        }
      };
    }

    // 2. Supabase Realtime channel (across different devices / networks)
    const channel = supabase.channel('trade_room_' + currentCode, {
      config: { broadcast: { self: false } },
    });
    roomChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'session_update' }, (payload) => {
        if (payload?.payload) {
          const updated = payload.payload as TradeSession;
          setSession(updated);
          try {
            localStorage.setItem(STORAGE_PREFIX + currentCode, JSON.stringify(updated));
          } catch {}
        }
      })
      .on('broadcast', { event: 'join_session' }, (payload) => {
        // Creator receives partner's join event
        if (payload?.payload?.participant) {
          const raw = localStorage.getItem(STORAGE_PREFIX + currentCode);
          let currentSes: TradeSession | null = raw ? JSON.parse(raw) : null;
          if (!currentSes && sessionRef.current) {
            currentSes = sessionRef.current;
          }
          if (currentSes) {
            const updated: TradeSession = {
              ...currentSes,
              status: 'active',
              partner: payload.payload.participant,
            };
            saveSession(updated);
            toast.success(`${payload.payload.participant.username} a rejoint le salon d'échange !`);
          }
        }
      })
      .on('broadcast', { event: 'request_session' }, () => {
        const raw = localStorage.getItem(STORAGE_PREFIX + currentCode);
        const ses = raw ? JSON.parse(raw) : sessionRef.current;
        if (ses) {
          if (typeof channel.httpSend === 'function') {
            channel.httpSend('session_update', ses).catch(() => {});
          }
          if (channel.state === 'joined') {
            channel.send({
              type: 'broadcast',
              event: 'session_update',
              payload: ses,
            }).catch(() => {});
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // If joining as partner (not creator), announce presence!
          if (!isCreatorRef.current) {
            channel.send({
              type: 'broadcast',
              event: 'join_session',
              payload: {
                participant: {
                  id: myId,
                  username: myUsername,
                  avatarUrl: myAvatarUrl,
                  isReady: false,
                  isConfirmed: false,
                  offer: [],
                },
              },
            });
            // Also request current state in case creator was already waiting
            channel.send({
              type: 'broadcast',
              event: 'request_session',
            });
          }
        }
      });

    // 3. Storage event listener (fallback)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_PREFIX + currentCode && e.newValue) {
        try {
          setSession(JSON.parse(e.newValue));
        } catch {}
      }
    };

    const interval = setInterval(loadLocal, 1000);
    window.addEventListener('storage', handleStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
      if (bc) bc.close();
      supabase.removeChannel(channel);
      roomChannelRef.current = null;
    };
  }, [currentCode, myId, myUsername, myAvatarUrl, saveSession]);

  // Create room
  const createTradeRoom = useCallback((code?: string): string => {
    const roomCode = (code || generateTradeRoomCode()).toUpperCase();
    const newSession: TradeSession = {
      code: roomCode,
      createdAt: new Date().toISOString(),
      status: 'waiting',
      creator: {
        id: myId,
        username: myUsername,
        avatarUrl: myAvatarUrl,
        isReady: false,
        isConfirmed: false,
        offer: [],
      },
    };
    saveSession(newSession);
    setCurrentCode(roomCode);
    setIsCreator(true);
    toast.success('Salon d\'échange ' + roomCode + ' créé !');
    return roomCode;
  }, [myId, myUsername, myAvatarUrl, saveSession]);

  // Join room
  const joinTradeRoom = useCallback((inputCode: string): boolean => {
    const roomCode = inputCode.trim().toUpperCase();
    if (!roomCode) return false;

    const raw = localStorage.getItem(STORAGE_PREFIX + roomCode);
    if (!raw) {
      // Create provisional session so guest immediately enters trade view instead of getting stuck in lobby
      const provisionalSession: TradeSession = {
        code: roomCode,
        createdAt: new Date().toISOString(),
        status: 'waiting',
        creator: {
          id: 'host_' + roomCode,
          username: 'Hôte du salon',
          avatarUrl: undefined,
          isReady: false,
          isConfirmed: false,
          offer: [],
        },
        partner: {
          id: myId,
          username: myUsername,
          avatarUrl: myAvatarUrl,
          isReady: false,
          isConfirmed: false,
          offer: [],
        },
      };
      setSession(provisionalSession);
      setCurrentCode(roomCode);
      setIsCreator(false);
      toast.info('Connexion au salon ' + roomCode + '...');
      return true;
    }

    try {
      const existing: TradeSession = JSON.parse(raw);
      if (existing.status === 'completed' || existing.status === 'cancelled') {
        toast.error('Cet échange est déjà terminé.');
        return false;
      }

      if (existing.creator.id === myId) {
        // Re-joining own created room
        setCurrentCode(roomCode);
        setIsCreator(true);
        toast.info(`Retour dans votre salon ${roomCode}`);
        return true;
      }

      // Join as partner
      const updated: TradeSession = {
        ...existing,
        status: 'active',
        partner: existing.partner && existing.partner.id === myId ? existing.partner : {
          id: myId,
          username: myUsername,
          avatarUrl: myAvatarUrl,
          isReady: false,
          isConfirmed: false,
          offer: [],
        }
      };

      saveSession(updated);
      setCurrentCode(roomCode);
      setIsCreator(false);
      toast.success('Connecté au salon d\'échange ' + roomCode + ' !');
      return true;
    } catch {
      toast.error('Erreur lors de la connexion.');
      return false;
    }
  }, [myId, myUsername, myAvatarUrl, saveSession]);

  // Add or increment Item in Offer
  const addItemToOffer = useCallback((item: TradeItem, maxAvailable?: number) => {
    if (!session) return;
    const isMeCreator = session.creator.id === myId;
    const currentParticipant = isMeCreator ? session.creator : session.partner;
    if (!currentParticipant) return;

    const existingIndex = currentParticipant.offer.findIndex(i => i.id === item.id);
    let newOffer: TradeItem[];

    if (existingIndex >= 0) {
      const currentItem = currentParticipant.offer[existingIndex];
      const currentQty = currentItem.quantity || 1;
      const limit = maxAvailable !== undefined ? maxAvailable : 99;

      if (currentQty >= limit) {
        toast.info(`Quantité maximum atteinte (${limit}) pour cet objet.`);
        return;
      }

      newOffer = currentParticipant.offer.map((it, idx) => 
        idx === existingIndex ? { ...it, quantity: currentQty + 1 } : it
      );
    } else {
      if (currentParticipant.offer.length >= 10) {
        toast.error("Limite de 10 types d'objets par offre atteinte !");
        return;
      }
      newOffer = [...currentParticipant.offer, { ...item, quantity: item.quantity || 1 }];
    }

    const updatedParticipant: TradeParticipant = {
      ...currentParticipant,
      isReady: false, // reset ready on change
      offer: newOffer,
    };

    const updated: TradeSession = {
      ...session,
      creator: isMeCreator ? updatedParticipant : session.creator,
      partner: isMeCreator ? session.partner : updatedParticipant,
    };

    saveSession(updated);
  }, [session, myId, saveSession]);

  // Remove or decrement Item in Offer
  const removeItemFromOffer = useCallback((itemId: string, removeAll: boolean = false) => {
    if (!session) return;
    const isMeCreator = session.creator.id === myId;
    const currentParticipant = isMeCreator ? session.creator : session.partner;
    if (!currentParticipant) return;

    let newOffer: TradeItem[];

    if (removeAll) {
      newOffer = currentParticipant.offer.filter(i => i.id !== itemId);
    } else {
      const existing = currentParticipant.offer.find(i => i.id === itemId);
      if (!existing) return;

      if ((existing.quantity || 1) > 1) {
        newOffer = currentParticipant.offer.map(i => 
          i.id === itemId ? { ...i, quantity: (i.quantity || 1) - 1 } : i
        );
      } else {
        newOffer = currentParticipant.offer.filter(i => i.id !== itemId);
      }
    }

    const updatedParticipant: TradeParticipant = {
      ...currentParticipant,
      isReady: false,
      offer: newOffer,
    };

    const updated: TradeSession = {
      ...session,
      creator: isMeCreator ? updatedParticipant : session.creator,
      partner: isMeCreator ? session.partner : updatedParticipant,
    };

    saveSession(updated);
  }, [session, myId, saveSession]);

  // Toggle Ready
  const toggleReady = useCallback(() => {
    if (!session) return;
    const isMeCreator = session.creator.id === myId;
    const currentParticipant = isMeCreator ? session.creator : session.partner;
    if (!currentParticipant) return;

    const updatedParticipant: TradeParticipant = {
      ...currentParticipant,
      isReady: !currentParticipant.isReady,
    };

    const updated: TradeSession = {
      ...session,
      creator: isMeCreator ? updatedParticipant : session.creator,
      partner: isMeCreator ? session.partner : updatedParticipant,
    };

    saveSession(updated);
  }, [session, myId, saveSession]);

  // Send Preset Message
  const sendMessage = useCallback((msgText: string, customSenderName?: string, customSenderId?: string) => {
    if (!session) return;
    const sId = customSenderId || myId;
    const sName = customSenderName || myUsername;
    const newMsg = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      senderId: sId,
      senderName: sName,
      text: msgText,
      timestamp: new Date().toISOString(),
    };
    const updated: TradeSession = {
      ...session,
      lastMessage: newMsg,
      messages: [...(session.messages || []), newMsg],
    };
    saveSession(updated);
  }, [session, myId, myUsername, saveSession]);

  // Execute Trade Transfer (Both creator and partner execute this for their own client)
  const executeTradeTransfer = useCallback(async (completedSession: TradeSession) => {
    if (!completedSession || completedSession.status !== 'completed') return;

    const role = isCreatorRef.current ? 'creator' : 'partner';
    const processedKey = `flipz_processed_trade_${completedSession.code}_${role}`;
    if (typeof window !== 'undefined' && sessionStorage.getItem(processedKey)) {
      return;
    }
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(processedKey, new Date().toISOString());
    }

    const isMeCreator = isCreatorRef.current;
    const myOffer = isMeCreator ? completedSession.creator.offer : (completedSession.partner?.offer || []);
    const theirOffer = isMeCreator ? (completedSession.partner?.offer || []) : completedSession.creator.offer;

    // 1. Process card and item deductions for my side
    const cardDeltas: Record<string, number> = {};
    const cardIdsToDelete: string[] = [];

    for (const item of myOffer) {
      if (item.type === 'pack') {
        const cleanId = item.id.replace('pack_', '');
        removePack(cleanId);
      } else if (item.type === 'potion') {
        const cleanId = item.id.replace('potion_', '');
        removePotion(cleanId, item.quantity || 1);
      } else if (item.type === 'card') {
        const cleanCardId = item.metadata?.cardId || item.id.replace('card_', '');
        const qty = item.quantity || 1;
        cardDeltas[cleanCardId] = (cardDeltas[cleanCardId] || 0) - qty;
        for (let i = 0; i < qty; i++) {
          cardIdsToDelete.push(cleanCardId);
        }
      }
    }

    // 2. Grant received items to my side
    const cardsToInsert: any[] = [];
    for (const item of theirOffer) {
      if (item.type === 'pack') {
        addPack({
          packId: item.metadata?.packId || 'booster',
          packType: item.metadata?.packType || 'booster',
          name: item.title,
          cardCount: item.metadata?.cardCount || 5,
          cards: item.metadata?.cards || [],
        });
      } else if (item.type === 'potion') {
        addPotion({
          type: item.metadata?.type || 'boost_luck',
          name: item.title,
          description: item.metadata?.description || '',
          config: item.metadata?.config || {},
        });
      } else if (item.type === 'card') {
        const cleanCardId = item.metadata?.cardId || item.id.replace('card_', '');
        const qty = item.quantity || 1;
        cardDeltas[cleanCardId] = (cardDeltas[cleanCardId] || 0) + qty;
        if (user?.id) {
          for (let i = 0; i < qty; i++) {
            cardsToInsert.push({ user_id: user.id, card_id: cleanCardId });
          }
        }
      }
    }

    // Apply persistent card deltas (so local collection, stats, inventory reflect it 100%)
    if (Object.keys(cardDeltas).length > 0) {
      applyUserCardTradeDelta(user?.id, cardDeltas);
    }

    // Direct Supabase operations (best effort sync)
    if (user?.id) {
      if (cardsToInsert.length > 0) {
        try {
          await supabase.from('user_cards').insert(cardsToInsert);
        } catch (e) {
          console.warn('Direct Supabase insert (RLS):', e);
        }
      }
      if (cardIdsToDelete.length > 0) {
        try {
          for (const cId of cardIdsToDelete) {
            const { data: rows } = await supabase
              .from('user_cards')
              .select('id')
              .eq('user_id', user.id)
              .eq('card_id', cId)
              .limit(1);
            if (rows && rows.length > 0) {
              await supabase.from('user_cards').delete().eq('id', rows[0].id);
            }
          }
        } catch (e) {
          console.warn('Direct Supabase delete (RLS):', e);
        }
      }
    }

    if (refetchUserCards) {
      await refetchUserCards();
    }
    queryClient.invalidateQueries({ queryKey: ['user-cards'] });
    queryClient.invalidateQueries({ queryKey: ['user-card-stats'] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    window.dispatchEvent(new CustomEvent('flipz_cards_updated'));

    toast.success('🎉 Échange complété ! Vos éléments ont été mis à jour.');
  }, [user?.id, removePack, removePotion, addPack, addPotion, refetchUserCards, queryClient]);

  // Execute Trade Finalization
  const finalizeTrade = useCallback(async () => {
    if (!session || !session.partner) return;

    const updated: TradeSession = {
      ...session,
      status: 'completed'
    };
    saveSession(updated);
    await executeTradeTransfer(updated);
  }, [session, saveSession, executeTradeTransfer]);

  // Auto-transfer when partner completes trade and session updates
  useEffect(() => {
    if (session && session.status === 'completed') {
      executeTradeTransfer(session);
    }
  }, [session, executeTradeTransfer]);

  // Cancel / Leave
  const cancelTrade = useCallback(() => {
    if (!session) return;
    const roomCode = session.code;
    const updated: TradeSession = {
      ...session,
      status: 'cancelled'
    };
    saveSession(updated);
    setCurrentCode(null);

    // Remove from public rooms list in localStorage and notify
    try {
      const raw = localStorage.getItem('flipz_public_trade_rooms');
      if (raw) {
        const rooms = JSON.parse(raw);
        const filtered = rooms.filter((r: any) => r.code?.toUpperCase() !== roomCode.toUpperCase());
        localStorage.setItem('flipz_public_trade_rooms', JSON.stringify(filtered));
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'flipz_public_trade_rooms',
          newValue: JSON.stringify(filtered),
        }));
      }
    } catch {}

    // Dispatch global custom event
    window.dispatchEvent(new CustomEvent('flipz_room_closed', { detail: { code: roomCode } }));

    toast.info('Échange annulé.');
  }, [session, saveSession]);

  const myParticipant = session ? (isCreator ? session.creator : session.partner) : null;
  const theirParticipant = session ? (isCreator ? session.partner : session.creator) : null;

  return {
    currentCode,
    session,
    isCreator,
    myParticipant,
    theirParticipant,
    myUsername,
    myAvatarUrl,
    userCards,
    packs,
    potions,
    createTradeRoom,
    joinTradeRoom,
    addItemToOffer,
    removeItemFromOffer,
    toggleReady,
    sendMessage,
    finalizeTrade,
    cancelTrade,
    setCurrentCode,
    allCards,
    saveSession,
  };
};
