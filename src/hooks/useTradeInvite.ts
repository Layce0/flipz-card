import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFriends } from '@/hooks/useFriends';
import { useSfx } from '@/hooks/useSfx';
import { toast } from 'sonner';

export interface TradeInvite {
  id: string;
  roomCode: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  senderFriendCode: string;
  targetFriendCode: string;
  targetUserId?: string;
  targetName?: string;
  timestamp: number;
  senderTabId?: string;
}

const INVITE_STORAGE_KEY = 'flipz_active_trade_invite';
const BROADCAST_CHANNEL_NAME = 'flipz_trade_invites_channel';
const SUPABASE_CHANNEL_NAME = 'flipz_global_trade_invites';

// Memory-only Tab ID: NEVER cloned between tabs even when duplicating tabs in Chrome
let inMemoryTabId = '';
export const getTabId = (): string => {
  if (typeof window === 'undefined') return 'server';
  if (!inMemoryTabId) {
    inMemoryTabId = 'tab_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now();
  }
  return inMemoryTabId;
};

// Strips 'FPZ-' or 'FPZ' prefix and special characters so codes like FPZ-ABC123 and ABC123 always match
export const normalizeCode = (code?: string): string => {
  if (!code) return '';
  return code
    .toString()
    .trim()
    .replace(/^FPZ-?/i, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
};

// Global singleton channel & listener registry
type InviteListener = (invite: TradeInvite) => void;
const inviteListeners = new Set<InviteListener>();
let globalRealtimeChannel: any = null;
let globalBroadcastChannel: BroadcastChannel | null = null;
let listenersInitialized = false;

// Global deduplication cache: stores inviteId -> timestamp
const processedInviteIds = new Map<string, number>();
const RECENT_INVITE_TTL_MS = 60000; // 60 seconds TTL
let lastSoundPlayTime = 0;

function setupRealtimeChannel() {
  if (typeof window === 'undefined') return;
  try {
    if (globalRealtimeChannel) {
      try { supabase.removeChannel(globalRealtimeChannel); } catch {}
    }

    globalRealtimeChannel = supabase.channel(SUPABASE_CHANNEL_NAME, {
      config: { broadcast: { self: true } },
    });

    globalRealtimeChannel
      .on('broadcast', { event: 'trade_invite' }, (payload: any) => {
        const inviteData = payload?.payload || payload;
        if (inviteData && inviteData.roomCode) {
          console.log('[TradeInvite] 📡 Global Realtime received broadcast:', inviteData);
          dispatchToListeners(inviteData as TradeInvite);
        }
      })
      .subscribe((status: string) => {
        console.log('[TradeInvite] 📡 Global Realtime status:', status);
        if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          setTimeout(setupRealtimeChannel, 3000);
        }
      });
  } catch (e) {
    console.warn('[TradeInvite] Setup realtime error:', e);
  }
}

function initGlobalListeners() {
  if (listenersInitialized || typeof window === 'undefined') return;
  listenersInitialized = true;

  // 1. Supabase Realtime channel
  setupRealtimeChannel();

  // Re-establish connection on focus / visibilitychange / online
  window.addEventListener('online', () => {
    console.log('[TradeInvite] 🌐 Network online, refreshing Realtime channel...');
    setupRealtimeChannel();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (!globalRealtimeChannel || globalRealtimeChannel.state !== 'joined') {
        console.log('[TradeInvite] 👁️ Tab visible, ensuring Realtime connection...');
        setupRealtimeChannel();
      }
    }
  });

  // 2. Web BroadcastChannel (multi-tabs on same browser)
  if ('BroadcastChannel' in window) {
    try {
      globalBroadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      globalBroadcastChannel.onmessage = (event) => {
        if (event?.data) {
          console.log('[TradeInvite] 📻 BroadcastChannel received:', event.data);
          dispatchToListeners(event.data as TradeInvite);
        }
      };
    } catch {}
  }

  // 3. LocalStorage storage event listener
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === INVITE_STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        console.log('[TradeInvite] 💾 LocalStorage received:', parsed);
        dispatchToListeners(parsed);
      } catch {}
    }
  });

  // Diagnostic helper attached to window
  if (typeof window !== 'undefined') {
    (window as any).__flipz_debug_trade = {
      getTabId,
      normalizeCode,
      getRealtimeState: () => globalRealtimeChannel?.state,
      sendTestSelfInvite: (room = 'TEST-ROOM') => {
        const dummy: TradeInvite = {
          id: 'test_' + Date.now(),
          roomCode: room,
          senderId: 'test_sender',
          senderName: 'Ami Test',
          senderFriendCode: 'FPZ-999999',
          targetFriendCode: 'ALL',
          timestamp: Date.now(),
        };
        dispatchToListeners(dummy);
      },
    };
  }
}

function dispatchToListeners(invite: TradeInvite) {
  if (!invite || !invite.id || !invite.roomCode) return;

  // STRICT GLOBAL DEDUPLICATION:
  // If this exact invite ID was already received and processed within TTL, DROP IT!
  const lastProcessed = processedInviteIds.get(invite.id);
  const now = Date.now();
  if (lastProcessed && now - lastProcessed < RECENT_INVITE_TTL_MS) {
    console.log('[TradeInvite] 🛡️ Dropping duplicate invite packet for ID:', invite.id);
    return;
  }
  processedInviteIds.set(invite.id, now);

  // Clean old entries if Map grows
  if (processedInviteIds.size > 100) {
    for (const [id, t] of processedInviteIds.entries()) {
      if (now - t > RECENT_INVITE_TTL_MS) {
        processedInviteIds.delete(id);
      }
    }
  }

  inviteListeners.forEach((listener) => {
    try {
      listener(invite);
    } catch (err) {
      console.error('[TradeInvite] Error in invite listener:', err);
    }
  });
}

export const useTradeInvite = () => {
  const { user } = useAuth();
  const { myFriendCode, myProfileName } = useFriends();
  const { play } = useSfx();
  const [incomingInvite, setIncomingInvite] = useState<TradeInvite | null>(null);

  const myId = user?.id || myFriendCode;

  const stateRef = useRef({
    myId,
    myFriendCode,
    myProfileName,
    userId: user?.id,
    play,
  });

  useEffect(() => {
    stateRef.current = {
      myId,
      myFriendCode,
      myProfileName,
      userId: user?.id,
      play,
    };
  }, [myId, myFriendCode, myProfileName, user?.id, play]);

  const incomingInviteRef = useRef(incomingInvite);
  useEffect(() => {
    incomingInviteRef.current = incomingInvite;
  }, [incomingInvite]);

  // Decline invite
  const declineInvite = useCallback(() => {
    if (incomingInviteRef.current) {
      toast.dismiss('trade_invite_' + incomingInviteRef.current.id);
      processedInviteIds.set(incomingInviteRef.current.id, Date.now());
    }
    setIncomingInvite(null);
  }, []);

  // Accept invite
  const acceptInvite = useCallback((inviteToAccept?: TradeInvite) => {
    const target = inviteToAccept || incomingInviteRef.current;
    if (!target) return;

    toast.dismiss('trade_invite_' + target.id);
    processedInviteIds.set(target.id, Date.now());
    setIncomingInvite(null);

    console.log('[TradeInvite] Accepting invite for room:', target.roomCode);

    if (typeof window !== 'undefined') {
      (window as any).__pendingTradeRoomCode = target.roomCode;
      try {
        sessionStorage.setItem('flipz_pending_trade_room', target.roomCode);
        localStorage.setItem('flipz_pending_trade_room', target.roomCode);
      } catch {}
    }

    window.dispatchEvent(
      new CustomEvent('open_trade_room', {
        detail: { roomCode: target.roomCode, partnerName: target.senderName },
      })
    );
  }, []);

  const acceptInviteRef = useRef(acceptInvite);
  useEffect(() => {
    acceptInviteRef.current = acceptInvite;
  }, [acceptInvite]);

  // Handle incoming invite for this client
  const onIncoming = useCallback((invite: TradeInvite) => {
    if (!invite || !invite.roomCode) return;

    const currentTabId = getTabId();
    // Do not notify the exact tab in memory that sent the invite
    if (invite.senderTabId && invite.senderTabId === currentTabId) {
      console.log('[TradeInvite] Ignoring invite sent by this exact tab');
      return;
    }

    // Do not re-trigger if this exact invite is already actively displayed
    if (incomingInviteRef.current?.id === invite.id) {
      return;
    }

    const { myId: currMyId, myFriendCode: currMyFriendCode, myProfileName: currMyName, userId: currUserId, play: currPlay } = stateRef.current;

    const guestCode = typeof window !== 'undefined' ? (localStorage.getItem('flipz_guest_friend_code') || '') : '';

    const normalizedTargetCode = normalizeCode(invite.targetFriendCode);
    const normalizedMyCode = normalizeCode(currMyFriendCode);
    const normalizedGuestCode = normalizeCode(guestCode);
    const normalizedUserId = normalizeCode(currUserId);
    const normalizedMyId = normalizeCode(currMyId);

    const isBroadcastToAll = invite.targetFriendCode === 'ALL';

    const isTargetCode = Boolean(
      isBroadcastToAll || (
        normalizedTargetCode && (
          (normalizedMyCode && normalizedTargetCode === normalizedMyCode) ||
          (normalizedGuestCode && normalizedTargetCode === normalizedGuestCode) ||
          (normalizedUserId && normalizedTargetCode === normalizedUserId) ||
          (normalizedMyId && normalizedTargetCode === normalizedMyId)
        )
      )
    );

    const isTargetUser = Boolean(
      invite.targetUserId && (
        (currUserId && invite.targetUserId.toLowerCase() === currUserId.toLowerCase()) ||
        (currMyId && invite.targetUserId.toLowerCase() === currMyId.toLowerCase()) ||
        (normalizedMyCode && normalizeCode(invite.targetUserId) === normalizedMyCode) ||
        (normalizedGuestCode && normalizeCode(invite.targetUserId) === normalizedGuestCode)
      )
    );

    const isTargetName = Boolean(
      invite.targetName &&
      currMyName &&
      invite.targetName.trim().toLowerCase() === currMyName.trim().toLowerCase() &&
      currMyName.trim().toLowerCase() !== 'moi' &&
      currMyName.trim().toLowerCase() !== 'joueur'
    );

    console.log('[TradeInvite] Incoming invite match test:', {
      invite,
      normalizedTargetCode,
      normalizedMyCode,
      normalizedGuestCode,
      isTargetCode,
      isTargetUser,
      isTargetName,
    });

    if (isTargetCode || isTargetUser || isTargetName) {
      const now = Date.now();
      if (now - invite.timestamp < 60000) {
        console.log('[TradeInvite] 🎯 Target matched! Displaying incoming invite:', invite);
        setIncomingInvite(invite);

        // Sound throttling
        if (now - lastSoundPlayTime > 4000) {
          lastSoundPlayTime = now;
          try {
            currPlay('collectSuccess');
          } catch {}
        }

        // Haptic feedback
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          try {
            navigator.vibrate([150, 80, 150]);
          } catch {}
        }

        // Single toast with fixed ID
        toast.info(`Demande d'échange reçue de ${invite.senderName} !`, {
          id: 'trade_invite_' + invite.id,
          duration: 12000,
          action: {
            label: 'Accepter',
            onClick: () => {
              toast.dismiss('trade_invite_' + invite.id);
              acceptInviteRef.current(invite);
            },
          },
        });
      }
    }
  }, []);

  const onIncomingRef = useRef(onIncoming);
  useEffect(() => {
    onIncomingRef.current = onIncoming;
  }, [onIncoming]);

  // Subscribe this hook instance to global listeners
  useEffect(() => {
    initGlobalListeners();

    const listener = (invite: TradeInvite) => {
      onIncomingRef.current(invite);
    };

    inviteListeners.add(listener);
    return () => {
      inviteListeners.delete(listener);
    };
  }, []);

  // Send an invite to an existing friend with redundancy and retry bursts
  const sendTradeInvite = useCallback(async ({
    roomCode,
    targetFriendCode,
    targetUserId,
    targetName,
    senderAvatar,
  }: {
    roomCode: string;
    targetFriendCode: string;
    targetUserId?: string;
    targetName: string;
    senderAvatar?: string | null;
  }) => {
    initGlobalListeners();

    const invite: TradeInvite = {
      id: 'invite_' + Date.now(),
      roomCode,
      senderId: myId,
      senderName: myProfileName || 'Un ami',
      senderAvatar: senderAvatar || null,
      senderFriendCode: myFriendCode,
      targetFriendCode: targetFriendCode.toUpperCase(),
      targetUserId,
      targetName,
      timestamp: Date.now(),
      senderTabId: getTabId(),
    };

    console.log('[TradeInvite] 🚀 Sending trade invite:', invite);

    // Register our own invite ID in processed set so the sender never triggers self-alerts
    processedInviteIds.set(invite.id, Date.now());

    const emitBroadcast = async () => {
      // 1. Supabase Realtime (WebSocket & HTTP REST dual transmission)
      try {
        let ch = globalRealtimeChannel;
        if (!ch) {
          ch = supabase.channel(SUPABASE_CHANNEL_NAME, {
            config: { broadcast: { self: true } },
          });
          globalRealtimeChannel = ch;
        }

        // Send via WebSocket if connected
        if (ch.state === 'joined') {
          try {
            await ch.send({
              type: 'broadcast',
              event: 'trade_invite',
              payload: invite,
            });
          } catch (err) {
            console.warn('[TradeInvite] ws send error:', err);
          }
        }

        // Always also send via REST HTTP endpoint for 100% guaranteed delivery
        if (typeof ch.httpSend === 'function') {
          try {
            await ch.httpSend('trade_invite', invite);
          } catch (err) {
            console.warn('[TradeInvite] httpSend error:', err);
          }
        }
      } catch (e) {
        console.warn('[TradeInvite] Supabase realtime broadcast error:', e);
      }

      // 2. BroadcastChannel (multi-tabs on same browser)
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
          bc.postMessage(invite);
          setTimeout(() => bc.close(), 1000);
        }
      } catch {}

      // 3. LocalStorage storage event (cross-window storage listener)
      try {
        localStorage.removeItem(INVITE_STORAGE_KEY);
        localStorage.setItem(INVITE_STORAGE_KEY, JSON.stringify({ ...invite, _nonce: Math.random() }));
      } catch {}
    };

    // Immediate transmission
    await emitBroadcast();

    // Redundant retry bursts (+1.2s and +2.8s) in background to ensure delivery
    // if the friend's app was reconnecting or in background
    setTimeout(emitBroadcast, 1200);
    setTimeout(emitBroadcast, 2800);

    return true;
  }, [myFriendCode, myId, myProfileName]);

  return {
    incomingInvite,
    sendTradeInvite,
    acceptInvite,
    declineInvite,
  };
};
