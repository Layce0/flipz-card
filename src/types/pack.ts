export type PackType = 'standard' | 'lucky' | 'ultra';

export interface PackConfig {
  id: string;
  name: string;
  cardCount: number;
  price: number; // in cents
  type: PackType;
  multiplier: number;
  description: string;
}

export const PACK_CONFIGS: PackConfig[] = [
  // Standard packs
  { id: 'standard_5', name: 'Pack Standard', cardCount: 5, price: 99, type: 'standard', multiplier: 1, description: 'Probabilités standard' },
  { id: 'standard_10', name: 'Pack Standard', cardCount: 10, price: 179, type: 'standard', multiplier: 1, description: 'Probabilités standard' },
  { id: 'standard_20', name: 'Pack Standard', cardCount: 20, price: 329, type: 'standard', multiplier: 1, description: 'Probabilités standard' },
  { id: 'standard_50', name: 'Pack Standard', cardCount: 50, price: 649, type: 'standard', multiplier: 1, description: 'Probabilités standard' },
  
  // Lucky packs (x2)
  { id: 'lucky_5', name: 'Pack Chanceux', cardCount: 5, price: 149, type: 'lucky', multiplier: 2, description: 'x2 épique/légendaire' },
  { id: 'lucky_10', name: 'Pack Chanceux', cardCount: 10, price: 299, type: 'lucky', multiplier: 2, description: 'x2 épique/légendaire' },
  { id: 'lucky_20', name: 'Pack Chanceux', cardCount: 20, price: 549, type: 'lucky', multiplier: 2, description: 'x2 épique/légendaire' },
  { id: 'lucky_50', name: 'Pack Chanceux', cardCount: 50, price: 1049, type: 'lucky', multiplier: 2, description: 'x2 épique/légendaire' },
  
  // Ultra lucky packs (x5)
  { id: 'ultra_5', name: 'Pack Ultra Chanceux', cardCount: 5, price: 199, type: 'ultra', multiplier: 5, description: 'x5 épique/légendaire' },
  { id: 'ultra_10', name: 'Pack Ultra Chanceux', cardCount: 10, price: 449, type: 'ultra', multiplier: 5, description: 'x5 épique/légendaire' },
  { id: 'ultra_20', name: 'Pack Ultra Chanceux', cardCount: 20, price: 799, type: 'ultra', multiplier: 5, description: 'x5 épique/légendaire' },
  { id: 'ultra_50', name: 'Pack Ultra Chanceux', cardCount: 50, price: 1399, type: 'ultra', multiplier: 5, description: 'x5 épique/légendaire' },
];

// Trade configurations
export interface TradeConfig {
  required: number;
  reward: number;
  keep: number;
}

export const TRADE_CONFIG: Record<string, TradeConfig> = {
  common: { required: 6, reward: 2, keep: 1 },      // 6 cards needed, get 2 back, keep 1
  rare: { required: 6, reward: 4, keep: 1 },        // 6 cards needed, get 4 back, keep 1
  epic: { required: 6, reward: 7, keep: 1 },        // 6 cards needed, get 7 back, keep 1
  legendary: { required: 4, reward: 15, keep: 0 },  // 4 cards needed, get 15 back
};

export const getPacksByType = (type: PackType): PackConfig[] => {
  return PACK_CONFIGS.filter(pack => pack.type === type);
};

export const formatPrice = (cents: number): string => {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
};
