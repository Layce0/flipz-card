import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PublicTradeRoom {
  code: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string | null;
  createdAt: string;
  status: 'waiting' | 'active' | 'completed' | 'cancelled';
  partnerName?: string;
}

const STORAGE_KEY = 'flipz_public_trade_rooms';
const SUPABASE_CHANNEL = 'flipz_public_trade_rooms';
const BROADCAST_CHANNEL = 'flipz_public_trade_rooms_bc';
const ROOM_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

export const usePublicTradeRooms = (
  currentActiveRoomCode?: string | null,
  myUsername?: string,
  myId?: string
) => {
  const { user } = useAuth();

  const validateRooms = useCallback((inputRooms: PublicTradeRoom[]): PublicTradeRoom[] => {
    const now = Date.now();
    return (inputRooms || []).filter(r => {
      // 1. Drop bots or seeds
      if (r.creatorId?.startsWith('seed_') || (r as any).isBot) return false;

      // 2. Drop stale rooms
      const age = now - new Date(r.createdAt).getTime();
      if (isNaN(age) || age > ROOM_MAX_AGE_MS || age < -60000) return false;

      // 3. Drop non-waiting
      if (r.status !== 'waiting') return false;

      // 4. Check actual session status in storage if present on same device
      try {
        const rawSes = localStorage.getItem('flipz_trade_room_' + r.code);
        if (rawSes) {
          const ses = JSON.parse(rawSes);
          if (ses.status === 'cancelled' || ses.status === 'completed' || ses.status === 'active') {
            return false;
          }
        }
      } catch {}

      return true;
    });
  }, []);

  const [rooms, setRooms] = useState<PublicTradeRoom[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: PublicTradeRoom[] = JSON.parse(raw);
        return validateRooms(parsed);
      }
    } catch {}
    return [];
  });

  const channelRef = useRef<any>(null);

  const saveAndBroadcastRooms = useCallback((newRooms: PublicTradeRoom[]) => {
    const clean = validateRooms(newRooms);
    setRooms(clean);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
      window.dispatchEvent(new StorageEvent('storage', {
        key: STORAGE_KEY,
        newValue: JSON.stringify(clean),
      }));
    } catch {}

    // Multi-tab broadcast
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel(BROADCAST_CHANNEL);
        bc.postMessage({ type: 'sync_rooms', rooms: clean });
        setTimeout(() => bc.close(), 500);
      }
    } catch {}

    // Supabase Realtime broadcast
    try {
      const ch = channelRef.current;
      if (ch) {
        ch.send({
          type: 'broadcast',
          event: 'sync_rooms',
          payload: { rooms: clean },
        }).catch(() => {});
      }
    } catch {}
  }, [validateRooms]);

  const closePublicRoom = useCallback((code: string) => {
    const cleanCode = code.trim().toUpperCase();

    // Immediately purge from localStorage
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: PublicTradeRoom[] = JSON.parse(raw);
        const filtered = parsed.filter(r => r.code.toUpperCase() !== cleanCode);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      }
    } catch {}

    setRooms(prev => {
      const next = prev.filter(r => r.code.toUpperCase() !== cleanCode);
      saveAndBroadcastRooms(next);
      return next;
    });

    // Notify Realtime of closure
    try {
      const ch = channelRef.current;
      if (ch) {
        ch.send({
          type: 'broadcast',
          event: 'close_room',
          payload: { code: cleanCode },
        }).catch(() => {});
      }
    } catch {}

    // Multi-tab broadcast closure
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel(BROADCAST_CHANNEL);
        bc.postMessage({ type: 'close_room', code: cleanCode });
        setTimeout(() => bc.close(), 500);
      }
    } catch {}
  }, [saveAndBroadcastRooms]);

  // Periodic and Event-based sync
  useEffect(() => {
    // 1. Supabase Realtime
    const ch = supabase.channel(SUPABASE_CHANNEL, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = ch;

    ch.on('broadcast', { event: 'sync_rooms' }, (payload: any) => {
      if (payload?.payload?.rooms) {
        const incoming: PublicTradeRoom[] = payload.payload.rooms;
        const clean = validateRooms(incoming);
        setRooms(prev => {
          const map = new Map<string, PublicTradeRoom>();
          [...clean, ...prev].forEach(r => {
            if (!map.has(r.code.toUpperCase())) {
              map.set(r.code.toUpperCase(), r);
            }
          });
          const merged = validateRooms(Array.from(map.values()));
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch {}
          return merged;
        });
      }
    })
    .on('broadcast', { event: 'publish_room' }, (payload: any) => {
      if (payload?.payload?.room) {
        const r: PublicTradeRoom = payload.payload.room;
        if (!r.creatorId?.startsWith('seed_') && !(r as any).isBot) {
          setRooms(prev => {
            const next = [r, ...prev.filter(x => x.code.toUpperCase() !== r.code.toUpperCase())];
            const clean = validateRooms(next);
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(clean)); } catch {}
            return clean;
          });
        }
      }
    })
    .on('broadcast', { event: 'close_room' }, (payload: any) => {
      if (payload?.payload?.code) {
        const c: string = payload.payload.code.toUpperCase();
        setRooms(prev => {
          const next = prev.filter(x => x.code.toUpperCase() !== c);
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
          return next;
        });
      }
    })
    .on('broadcast', { event: 'request_rooms' }, () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const clean = validateRooms(parsed);
          if (clean.length > 0) {
            ch.send({
              type: 'broadcast',
              event: 'sync_rooms',
              payload: { rooms: clean },
            }).catch(() => {});
          }
        }
      } catch {}
    })
    .subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        ch.send({
          type: 'broadcast',
          event: 'request_rooms',
          payload: {},
        }).catch(() => {});
      }
    });

    // 2. BroadcastChannel
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel(BROADCAST_CHANNEL);
      bc.onmessage = (e) => {
        if (e?.data?.type === 'close_room' && e.data.code) {
          const c: string = e.data.code.toUpperCase();
          setRooms(prev => prev.filter(x => x.code.toUpperCase() !== c));
        } else if (e?.data?.type === 'publish_room' && e.data.room) {
          setRooms(prev => {
            const next = [e.data.room, ...prev.filter(x => x.code.toUpperCase() !== e.data.room.code.toUpperCase())];
            return validateRooms(next);
          });
        } else if (e?.data?.rooms) {
          const clean = validateRooms(e.data.rooms);
          setRooms(clean);
        } else if (e?.data?.type === 'request_rooms') {
          try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              const clean = validateRooms(parsed);
              if (clean.length > 0) {
                bc?.postMessage({ type: 'sync_rooms', rooms: clean });
              }
            }
          } catch {}
        }
      };

      // Request rooms from other tabs
      bc.postMessage({ type: 'request_rooms' });
    }

    // 3. Storage event
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setRooms(validateRooms(parsed));
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    // 4. Custom window event for instant local closure
    const handleRoomClosed = (e: any) => {
      if (e?.detail?.code) {
        closePublicRoom(e.detail.code);
      }
    };
    window.addEventListener('flipz_room_closed', handleRoomClosed);

    // 5. Periodic cleanup of cancelled or stale rooms every 2 seconds
    const interval = setInterval(() => {
      setRooms(prev => {
        const clean = validateRooms(prev);
        if (clean.length !== prev.length) {
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(clean)); } catch {}
          return clean;
        }
        return prev;
      });
    }, 2000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('flipz_room_closed', handleRoomClosed);
      if (bc) bc.close();
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [validateRooms, closePublicRoom]);

  const publishPublicRoom = useCallback((room: PublicTradeRoom) => {
    setRooms(prev => {
      const next = [room, ...prev.filter(r => r.code.toUpperCase() !== room.code.toUpperCase())];
      saveAndBroadcastRooms(next);
      return next;
    });

    try {
      const ch = channelRef.current;
      if (ch) {
        ch.send({
          type: 'broadcast',
          event: 'publish_room',
          payload: { room },
        }).catch(() => {});
      }
    } catch {}

    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel(BROADCAST_CHANNEL);
        bc.postMessage({ type: 'publish_room', room });
        setTimeout(() => bc.close(), 500);
      }
    } catch {}
  }, [saveAndBroadcastRooms]);

  return {
    publicRooms: rooms,
    publishPublicRoom,
    closePublicRoom,
  };
};
