import { GameCard } from '@/types/card';
import { PackType } from '@/types/pack';

export interface StoredPack {
  instanceId: string;
  packId: string;
  packType: PackType;
  name: string;
  cardCount: number;
  cards: GameCard[];
  obtainedAt: string;
}

export interface StoredPotion {
  id: string;
  type: 'boost_luck' | 'boost_pack';
  name: string;
  description: string;
  config: {
    multiplier?: number;
    bonus?: number;
    duration_hours?: number;
    [key: string]: any;
  };
  quantity: number;
  obtainedAt: string;
}

export interface ActivePotion {
  id: string;
  potionId: string;
  type: 'boost_luck' | 'boost_pack';
  name: string;
  config: Record<string, any>;
  activatedAt: string;
  expiresAt: string;
}

export interface InventoryData {
  packs: StoredPack[];
  potions: StoredPotion[];
  activePotions: ActivePotion[];
}
