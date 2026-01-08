export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface GameCard {
  id: string;
  title: string;
  description: string;
  image_url: string;
  rarity: Rarity;
  release_date: string;
  created_at: string;
}

export interface UserCard {
  id: string;
  user_id: string;
  card_id: string;
  obtained_at: string;
  card: GameCard;
}

export const RARITY_CONFIG: Record<Rarity, { label: string; color: string; bgClass: string }> = {
  common: {
    label: 'Commun',
    color: 'hsl(220, 10%, 50%)',
    bgClass: 'rarity-common',
  },
  rare: {
    label: 'Rare',
    color: 'hsl(210, 80%, 55%)',
    bgClass: 'rarity-rare',
  },
  epic: {
    label: 'Épique',
    color: 'hsl(280, 70%, 55%)',
    bgClass: 'rarity-epic',
  },
  legendary: {
    label: 'Légendaire',
    color: 'hsl(45, 95%, 55%)',
    bgClass: 'rarity-legendary',
  },
};
