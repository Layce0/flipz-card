import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MarketplaceItem } from '@/hooks/useMarketplace';

export type TradeCategory = 'p2p' | 'marketplace_direct' | 'marketplace_auction';

export interface TradeHistoryItem {
  id: string;
  type: 'card' | 'potion' | 'booster';
  name: string;
  imageUrl?: string;
  rarity?: string;
  quantity?: number;
}

export interface TradeHistoryRecord {
  id: string;
  tradeType: TradeCategory;
  title: string;
  partnerName: string;
  partnerAvatar?: string | null;
  partnerId?: string;
  role: 'creator' | 'partner' | 'buyer' | 'seller';
  sentItems: TradeHistoryItem[];
  receivedItems: TradeHistoryItem[];
  timestamp: string; // ISO
  status: 'completed';
}

const HISTORY_KEY_PREFIX = 'flipz_trade_history_v1_';
const BROADCAST_HISTORY_KEY = 'flipz_trade_history_channel_v1';

export function getTradeHistoryKey(userId?: string): string {
  if (userId) return `${HISTORY_KEY_PREFIX}${userId}`;
  try {
    const gid = sessionStorage.getItem('flipz_mp_client_id') || sessionStorage.getItem('flipz_client_id') || 'guest';
    return `${HISTORY_KEY_PREFIX}${gid}`;
  } catch {
    return `${HISTORY_KEY_PREFIX}guest`;
  }
}

export function loadTradeHistory(userId?: string): TradeHistoryRecord[] {
  try {
    const key = getTradeHistoryKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTradeHistory(records: TradeHistoryRecord[], userId?: string) {
  try {
    const key = getTradeHistoryKey(userId);
    localStorage.setItem(key, JSON.stringify(records.slice(0, 100))); // keep 100 max
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('flipz_trade_history_updated'));
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel(BROADCAST_HISTORY_KEY);
        bc.postMessage({ type: 'history_update' });
        bc.close();
      }
    }
  } catch (e) {
    console.error('Failed to save trade history:', e);
  }
}

export function addTradeHistoryEntry(record: Omit<TradeHistoryRecord, 'id' | 'timestamp' | 'status'>, userId?: string): TradeHistoryRecord {
  const current = loadTradeHistory(userId);
  const newEntry: TradeHistoryRecord = {
    ...record,
    id: 'th_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    timestamp: new Date().toISOString(),
    status: 'completed',
  };
  saveTradeHistory([newEntry, ...current], userId);
  return newEntry;
}

export const useTradeHistory = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const [history, setHistory] = useState<TradeHistoryRecord[]>(() => loadTradeHistory(userId));

  const refresh = useCallback(() => {
    setHistory(loadTradeHistory(userId));
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [userId, refresh]);

  useEffect(() => {
    const handleUpdate = () => refresh();
    window.addEventListener('flipz_trade_history_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel(BROADCAST_HISTORY_KEY);
      bc.onmessage = () => refresh();
    }

    return () => {
      window.removeEventListener('flipz_trade_history_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      bc?.close();
    };
  }, [refresh]);

  const clearHistory = useCallback(() => {
    saveTradeHistory([], userId);
    setHistory([]);
  }, [userId]);

  return {
    history,
    addEntry: (entry: Omit<TradeHistoryRecord, 'id' | 'timestamp' | 'status'>) => addTradeHistoryEntry(entry, userId),
    clearHistory,
    refresh,
  };
};
