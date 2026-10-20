import { useState, useEffect, useCallback, useRef } from 'react';
import { GameCard, Rarity } from '@/types/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/* ────────────────────────────────────────────────────────────
   Types for marketplace items — can be a Card, Potion, or Booster
   ──────────────────────────────────────────────────────────── */

export type MarketplaceItemType = 'card' | 'potion' | 'booster';

export interface MarketplaceItem {
  type: MarketplaceItemType;
  id: string;           // card id, potion id, or pack instance id
  name: string;
  imageUrl?: string;
  rarity?: Rarity;
  /** Extra metadata depending on item type */
  meta?: Record<string, any>;
}

/* ────────────────────────────────────────────────────────────
   1. Open Auction (Enchère ouverte)
   ──────────────────────────────────────────────────────────── */

export interface AuctionBid {
  id: string;
  bidderId: string;
  bidderName: string;
  bidderAvatar?: string | null;
  offeredItems: MarketplaceItem[];
  bidAt: string; // ISO
}

export interface OpenAuction {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string | null;
  /** The item being auctioned */
  item: MarketplaceItem;
  /** Duration in minutes for the auction */
  durationMinutes: number;
  /** Bids from other users */
  bids: AuctionBid[];
  /** When the auction was created */
  createdAt: string; // ISO
  /** When the auction ends */
  endsAt: string; // ISO
  /** Status */
  status: 'active' | 'ended' | 'accepted';
  /** The bid ID that was accepted (after timer ends) */
  acceptedBidId?: string;
}

/* ────────────────────────────────────────────────────────────
   2. Direct Trade (Échange direct)
   ──────────────────────────────────────────────────────────── */

export interface DirectTrade {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar?: string | null;
  /** What the creator is offering */
  offeredItem: MarketplaceItem;
  /** What the creator wants in return */
  wantedItem: MarketplaceItem;
  createdAt: string; // ISO
  status: 'open' | 'accepted' | 'cancelled';
  /** Who accepted */
  acceptedById?: string;
  acceptedByName?: string;
}

/* ────────────────────────────────────────────────────────────
   Identity Helpers (Tab-isolated guest ID & username)
   Uses sessionStorage so each tab acts as a distinct player
   ──────────────────────────────────────────────────────────── */

export function getMarketplaceUserId(user: any): string {
  if (user?.id) return user.id;
  if (typeof window === 'undefined') return 'guest_local';
  try {
    let gid = sessionStorage.getItem('flipz_mp_client_id') || sessionStorage.getItem('flipz_client_id');
    if (!gid) {
      gid = 'guest_' + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem('flipz_mp_client_id', gid);
    }
    return gid;
  } catch {
    return 'guest_' + Math.random().toString(36).substring(2, 9);
  }
}

export function getMarketplaceUserName(user: any): string {
  if (user?.user_metadata?.username) return user.user_metadata.username;
  if (user?.email) return user.email.split('@')[0];
  if (typeof window === 'undefined') return 'Joueur';
  try {
    const profile = localStorage.getItem('flipz_user_profile');
    if (profile) {
      const p = JSON.parse(profile);
      if (p.username) return p.username;
    }
    let gid = sessionStorage.getItem('flipz_mp_client_id') || sessionStorage.getItem('flipz_client_id');
    if (gid) {
      return `Joueur #${gid.slice(-4)}`;
    }
  } catch {}
  return 'Joueur';
}

/* ────────────────────────────────────────────────────────────
   LocalStorage & Channels Keys
   ──────────────────────────────────────────────────────────── */

const AUCTIONS_KEY = 'flipz_mp_auctions_v2';
const TRADES_KEY = 'flipz_mp_trades_v2';
const BROADCAST_KEY = 'flipz_marketplace_bc_v2';
const SUPABASE_CHANNEL = 'flipz_marketplace_realtime_v2';

/* ────────────────────────────────────────────────────────────
   Sanitization & Deduplication Helpers (Real announcements only)
   ──────────────────────────────────────────────────────────── */

export function sanitizeAuctions(list: OpenAuction[]): OpenAuction[] {
  if (!Array.isArray(list)) return [];
  const now = Date.now();
  const map = new Map<string, OpenAuction>();

  list.forEach(a => {
    if (!a || !a.id || typeof a.id !== 'string') return;
    if (a.id.startsWith('auc_seed_')) return; // No legacy fake seeds
    const existing = map.get(a.id);
    if (!existing) {
      map.set(a.id, a);
    } else {
      // Pick the more updated record
      if (a.status === 'accepted' || (existing.status !== 'accepted' && (a.bids?.length || 0) >= (existing.bids?.length || 0))) {
        map.set(a.id, a);
      }
    }
  });

  return Array.from(map.values()).map(a => {
    if (a.status === 'active' && new Date(a.endsAt).getTime() <= now) {
      return { ...a, status: 'ended' as const };
    }
    return a;
  });
}

export function sanitizeTrades(list: DirectTrade[]): DirectTrade[] {
  if (!Array.isArray(list)) return [];
  const map = new Map<string, DirectTrade>();

  list.forEach(t => {
    if (!t || !t.id || typeof t.id !== 'string') return;
    if (t.id.startsWith('dtrd_seed_')) return; // No legacy fake seeds
    const existing = map.get(t.id);
    if (!existing) {
      map.set(t.id, t);
    } else {
      if (t.status !== 'open') {
        map.set(t.id, t);
      }
    }
  });

  return Array.from(map.values());
}

function getInitialAuctions(): OpenAuction[] {
  try {
    const raw = localStorage.getItem(AUCTIONS_KEY);
    if (raw) {
      return sanitizeAuctions(JSON.parse(raw));
    }
  } catch {}
  return [];
}

function getInitialTrades(): DirectTrade[] {
  try {
    const raw = localStorage.getItem(TRADES_KEY);
    if (raw) {
      return sanitizeTrades(JSON.parse(raw));
    }
  } catch {}
  return [];
}

/* ────────────────────────────────────────────────────────────
   Hook: useMarketplace
   ──────────────────────────────────────────────────────────── */

export const useMarketplace = () => {
  const { user } = useAuth();
  const myId = getMarketplaceUserId(user);
  const myName = getMarketplaceUserName(user);
  const myAvatar = user?.user_metadata?.avatar_url || null;

  const bcRef = useRef<BroadcastChannel | null>(null);
  const channelRef = useRef<any>(null);

  // ── State ──
  const [auctions, setAuctions] = useState<OpenAuction[]>(getInitialAuctions);
  const [directTrades, setDirectTrades] = useState<DirectTrade[]>(getInitialTrades);

  const auctionsRef = useRef<OpenAuction[]>(auctions);
  auctionsRef.current = auctions;

  const tradesRef = useRef<DirectTrade[]>(directTrades);
  tradesRef.current = directTrades;

  // ── Persist to LocalStorage & Local BroadcastChannel ──
  const persistLocal = useCallback((nextAuctions: OpenAuction[], nextTrades: DirectTrade[]) => {
    try {
      localStorage.setItem(AUCTIONS_KEY, JSON.stringify(nextAuctions));
      localStorage.setItem(TRADES_KEY, JSON.stringify(nextTrades));
    } catch {}
    try {
      if (bcRef.current) {
        bcRef.current.postMessage({ type: 'mp_update', auctions: nextAuctions, trades: nextTrades });
      }
    } catch {}
  }, []);

  // ── Send to Supabase Realtime Broadcast ──
  const sendRealtime = useCallback((event: string, payload: any) => {
    try {
      const ch = channelRef.current;
      if (ch) {
        ch.send({
          type: 'broadcast',
          event,
          payload,
        }).catch((err: any) => {
          console.debug('[Marketplace Realtime] send error:', err);
        });
      }
    } catch {}
  }, []);

  // ── Supabase Realtime & Multi-tab Channel setup ──
  useEffect(() => {
    // 1. Local BroadcastChannel for instant same-browser cross-tab sync
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel(BROADCAST_KEY);
      bcRef.current = bc;
      bc.onmessage = (e) => {
        if (e?.data?.type === 'mp_update') {
          if (e.data.auctions) setAuctions(sanitizeAuctions(e.data.auctions));
          if (e.data.trades) setDirectTrades(sanitizeTrades(e.data.trades));
        }
      };
    }

    // 2. Storage event listener (fallback for browsers without BroadcastChannel)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === AUCTIONS_KEY && e.newValue) {
        try { setAuctions(sanitizeAuctions(JSON.parse(e.newValue))); } catch {}
      }
      if (e.key === TRADES_KEY && e.newValue) {
        try { setDirectTrades(sanitizeTrades(JSON.parse(e.newValue))); } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. Supabase Realtime Broadcast Channel for cross-device live sync
    const ch = supabase.channel(SUPABASE_CHANNEL, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = ch;

    ch
      .on('broadcast', { event: 'sync_marketplace' }, (msg: any) => {
        if (!msg?.payload) return;
        const incomingAuctions: OpenAuction[] = msg.payload.auctions || [];
        const incomingTrades: DirectTrade[] = msg.payload.trades || [];

        if (incomingAuctions.length > 0) {
          setAuctions(prev => {
            const merged = sanitizeAuctions([...incomingAuctions, ...prev]);
            try { localStorage.setItem(AUCTIONS_KEY, JSON.stringify(merged)); } catch {}
            return merged;
          });
        }

        if (incomingTrades.length > 0) {
          setDirectTrades(prev => {
            const merged = sanitizeTrades([...incomingTrades, ...prev]);
            try { localStorage.setItem(TRADES_KEY, JSON.stringify(merged)); } catch {}
            return merged;
          });
        }
      })
      .on('broadcast', { event: 'publish_auction' }, (msg: any) => {
        if (!msg?.payload?.auction) return;
        const auction: OpenAuction = msg.payload.auction;
        if (auction.id.startsWith('auc_seed_')) return;

        setAuctions(prev => {
          const next = sanitizeAuctions([auction, ...prev.filter(a => a.id !== auction.id)]);
          try { localStorage.setItem(AUCTIONS_KEY, JSON.stringify(next)); } catch {}
          return next;
        });

        if (auction.creatorId !== myId) {
          toast.info(`🔔 Nouvelle enchère : ${auction.item.name} par ${auction.creatorName}`);
        }
      })
      .on('broadcast', { event: 'update_auction' }, (msg: any) => {
        if (!msg?.payload?.auction) return;
        const auction: OpenAuction = msg.payload.auction;

        setAuctions(prev => {
          const existing = prev.find(a => a.id === auction.id);
          const next = sanitizeAuctions([auction, ...prev.filter(a => a.id !== auction.id)]);
          try { localStorage.setItem(AUCTIONS_KEY, JSON.stringify(next)); } catch {}

          if (auction.creatorId === myId && existing && (auction.bids?.length || 0) > (existing.bids?.length || 0)) {
            const latestBid = auction.bids[auction.bids.length - 1];
            toast.success(`🎉 Nouvelle offre sur votre enchère pour ${auction.item.name} reçue de ${latestBid?.bidderName || 'un joueur'} !`);
          }

          return next;
        });
      })
      .on('broadcast', { event: 'cancel_auction' }, (msg: any) => {
        if (!msg?.payload?.auctionId) return;
        const id = msg.payload.auctionId;
        setAuctions(prev => {
          const next = prev.filter(a => a.id !== id);
          try { localStorage.setItem(AUCTIONS_KEY, JSON.stringify(next)); } catch {}
          return next;
        });
      })
      .on('broadcast', { event: 'publish_trade' }, (msg: any) => {
        if (!msg?.payload?.trade) return;
        const trade: DirectTrade = msg.payload.trade;
        if (trade.id.startsWith('dtrd_seed_')) return;

        setDirectTrades(prev => {
          const next = sanitizeTrades([trade, ...prev.filter(t => t.id !== trade.id)]);
          try { localStorage.setItem(TRADES_KEY, JSON.stringify(next)); } catch {}
          return next;
        });

        if (trade.creatorId !== myId) {
          toast.info(`🔔 Nouvel échange direct proposé par ${trade.creatorName} !`);
        }
      })
      .on('broadcast', { event: 'update_trade' }, (msg: any) => {
        if (!msg?.payload?.trade) return;
        const trade: DirectTrade = msg.payload.trade;

        setDirectTrades(prev => {
          const next = sanitizeTrades([trade, ...prev.filter(t => t.id !== trade.id)]);
          try { localStorage.setItem(TRADES_KEY, JSON.stringify(next)); } catch {}

          if (trade.creatorId === myId && trade.status === 'accepted') {
            toast.success(`🎉 Votre échange pour ${trade.wantedItem.name} a été accepté par ${trade.acceptedByName || 'un joueur'} !`);
          }

          return next;
        });
      })
      .on('broadcast', { event: 'cancel_trade' }, (msg: any) => {
        if (!msg?.payload?.tradeId) return;
        const id = msg.payload.tradeId;
        setDirectTrades(prev => {
          const next = prev.filter(t => t.id !== id);
          try { localStorage.setItem(TRADES_KEY, JSON.stringify(next)); } catch {}
          return next;
        });
      })
      .on('broadcast', { event: 'request_marketplace_sync' }, () => {
        const curA = auctionsRef.current.filter(a => a.status === 'active');
        const curT = tradesRef.current.filter(t => t.status === 'open');
        if (curA.length > 0 || curT.length > 0) {
          ch.send({
            type: 'broadcast',
            event: 'sync_marketplace',
            payload: { auctions: curA, trades: curT },
          }).catch(() => {});
        }
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          ch.send({
            type: 'broadcast',
            event: 'request_marketplace_sync',
            payload: { requesterId: myId },
          }).catch(() => {});
        }
      });

    // Heartbeat sync request every 25 seconds
    const heartbeatTimer = setInterval(() => {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'request_marketplace_sync',
          payload: { requesterId: myId },
        }).catch(() => {});
      }
    }, 25000);

    return () => {
      clearInterval(heartbeatTimer);
      bcRef.current?.close();
      window.removeEventListener('storage', handleStorage);
      supabase.removeChannel(ch);
    };
  }, [myId]);

  // ── Auto-expire active auctions ──
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setAuctions(prev => {
        let changed = false;
        const next = prev.map(a => {
          if (a.status === 'active' && new Date(a.endsAt).getTime() <= now) {
            changed = true;
            return { ...a, status: 'ended' as const };
          }
          return a;
        });
        if (changed) {
          persistLocal(next, tradesRef.current);
        }
        return changed ? next : prev;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [persistLocal]);

  // ──────────────────────────
  // AUCTION ACTIONS
  // ──────────────────────────

  /** Create a new open auction */
  const createAuction = useCallback((item: MarketplaceItem, durationMinutes: number = 60) => {
    const now = new Date();
    const newAuction: OpenAuction = {
      id: 'auc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      creatorId: myId,
      creatorName: myName,
      creatorAvatar: myAvatar,
      item,
      durationMinutes,
      bids: [],
      createdAt: now.toISOString(),
      endsAt: new Date(now.getTime() + durationMinutes * 60000).toISOString(),
      status: 'active',
    };

    setAuctions(prev => {
      const next = sanitizeAuctions([newAuction, ...prev]);
      persistLocal(next, tradesRef.current);
      return next;
    });

    sendRealtime('publish_auction', { auction: newAuction });
    sendRealtime('sync_marketplace', {
      auctions: sanitizeAuctions([newAuction, ...auctionsRef.current]),
      trades: tradesRef.current,
    });

    toast.success('🔨 Enchère ouverte ! Les joueurs peuvent maintenant proposer des offres en direct.');
    return newAuction.id;
  }, [myId, myName, myAvatar, persistLocal, sendRealtime]);

  /** Place a bid (offer items) on an auction */
  const placeBid = useCallback((auctionId: string, offeredItems: MarketplaceItem[]) => {
    const bid: AuctionBid = {
      id: 'bid_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      bidderId: myId,
      bidderName: myName,
      bidderAvatar: myAvatar,
      offeredItems,
      bidAt: new Date().toISOString(),
    };

    let updatedAuction: OpenAuction | null = null;

    setAuctions(prev => {
      const next = prev.map(a => {
        if (a.id === auctionId && a.status === 'active') {
          updatedAuction = { ...a, bids: [...a.bids, bid] };
          return updatedAuction;
        }
        return a;
      });
      persistLocal(next, tradesRef.current);
      return next;
    });

    if (updatedAuction) {
      sendRealtime('update_auction', { auction: updatedAuction });
      sendRealtime('sync_marketplace', {
        auctions: auctionsRef.current,
        trades: tradesRef.current,
      });
    }

    toast.success('✅ Votre offre a été envoyée au vendeur !');
    return bid.id;
  }, [myId, myName, myAvatar, persistLocal, sendRealtime]);

  /** Accept a specific bid (auction creator only, after timer ends or early) */
  const acceptBid = useCallback((auctionId: string, bidId: string) => {
    let updatedAuction: OpenAuction | null = null;

    setAuctions(prev => {
      const next = prev.map(a => {
        if (a.id === auctionId && (a.status === 'ended' || a.status === 'active')) {
          updatedAuction = { ...a, status: 'accepted' as const, acceptedBidId: bidId };
          return updatedAuction;
        }
        return a;
      });
      persistLocal(next, tradesRef.current);
      return next;
    });

    if (updatedAuction) {
      sendRealtime('update_auction', { auction: updatedAuction });
      sendRealtime('sync_marketplace', {
        auctions: auctionsRef.current,
        trades: tradesRef.current,
      });
    }

    toast.success('🎉 Offre acceptée ! L\'échange est validé.');
  }, [persistLocal, sendRealtime]);

  /** Cancel an auction (creator only) */
  const cancelAuction = useCallback((auctionId: string) => {
    setAuctions(prev => {
      const next = prev.filter(a => a.id !== auctionId);
      persistLocal(next, tradesRef.current);
      return next;
    });

    sendRealtime('cancel_auction', { auctionId });
    sendRealtime('sync_marketplace', {
      auctions: auctionsRef.current.filter(a => a.id !== auctionId),
      trades: tradesRef.current,
    });

    toast.info('Enchère annulée.');
  }, [persistLocal, sendRealtime]);

  // ──────────────────────────
  // DIRECT TRADE ACTIONS
  // ──────────────────────────

  /** Create a direct trade offer: "I offer X and I want Y" */
  const createDirectTrade = useCallback((offeredItem: MarketplaceItem, wantedItem: MarketplaceItem) => {
    const newTrade: DirectTrade = {
      id: 'dtrd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      creatorId: myId,
      creatorName: myName,
      creatorAvatar: myAvatar,
      offeredItem,
      wantedItem,
      createdAt: new Date().toISOString(),
      status: 'open',
    };

    setDirectTrades(prev => {
      const next = sanitizeTrades([newTrade, ...prev]);
      persistLocal(auctionsRef.current, next);
      return next;
    });

    sendRealtime('publish_trade', { trade: newTrade });
    sendRealtime('sync_marketplace', {
      auctions: auctionsRef.current,
      trades: sanitizeTrades([newTrade, ...tradesRef.current]),
    });

    toast.success('📢 Offre d\'échange publiée en direct sur le Marketplace !');
    return newTrade.id;
  }, [myId, myName, myAvatar, persistLocal, sendRealtime]);

  /** Accept a direct trade */
  const acceptDirectTrade = useCallback((tradeId: string) => {
    let updatedTrade: DirectTrade | null = null;

    setDirectTrades(prev => {
      const next = prev.map(t => {
        if (t.id === tradeId && t.status === 'open') {
          updatedTrade = {
            ...t,
            status: 'accepted' as const,
            acceptedById: myId,
            acceptedByName: myName,
          };
          return updatedTrade;
        }
        return t;
      });
      persistLocal(auctionsRef.current, next);
      return next;
    });

    if (updatedTrade) {
      sendRealtime('update_trade', { trade: updatedTrade });
      sendRealtime('sync_marketplace', {
        auctions: auctionsRef.current,
        trades: tradesRef.current,
      });
    }

    toast.success('🎉 Échange accepté ! Les items ont été transférés.');
  }, [myId, myName, persistLocal, sendRealtime]);

  /** Cancel a direct trade (creator only) */
  const cancelDirectTrade = useCallback((tradeId: string) => {
    setDirectTrades(prev => {
      const next = prev.filter(t => t.id !== tradeId);
      persistLocal(auctionsRef.current, next);
      return next;
    });

    sendRealtime('cancel_trade', { tradeId });
    sendRealtime('sync_marketplace', {
      auctions: auctionsRef.current,
      trades: tradesRef.current.filter(t => t.id !== tradeId),
    });

    toast.info('Offre d\'échange retirée.');
  }, [persistLocal, sendRealtime]);

  // ── Derived stats ──
  const myActiveAuctions = auctions.filter(a => a.creatorId === myId && a.status === 'active');
  const myEndedAuctions = auctions.filter(a => a.creatorId === myId && a.status === 'ended');
  const myDirectTrades = directTrades.filter(t => t.creatorId === myId && t.status === 'open');
  const openAuctions = auctions.filter(a => a.status === 'active');
  const endedAuctions = auctions.filter(a => a.status === 'ended');
  const openDirectTrades = directTrades.filter(t => t.status === 'open');

  return {
    // Current user identifier
    myId,
    myName,

    // State
    auctions,
    directTrades,
    openAuctions,
    endedAuctions,
    openDirectTrades,
    myActiveAuctions,
    myEndedAuctions,
    myDirectTrades,

    // Auction actions
    createAuction,
    placeBid,
    acceptBid,
    cancelAuction,

    // Direct trade actions
    createDirectTrade,
    acceptDirectTrade,
    cancelDirectTrade,
  };
};
