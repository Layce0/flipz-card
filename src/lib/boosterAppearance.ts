import type { CSSProperties } from 'react';
import { GameCard, RARITY_CONFIG } from '@/types/card';

export const isRarityColor = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);

export const specialRarityColor = (card: GameCard): string | null =>
  card.custom_rarity && isRarityColor(card.custom_rarity_color) ? card.custom_rarity_color : null;

export const cardDisplayColor = (card: GameCard): string =>
  specialRarityColor(card) ?? (card.custom_rarity ? 'hsl(var(--rarity-special))' : RARITY_CONFIG[card.rarity].color);

export const rarityBadgeStyle = (card: GameCard): CSSProperties | undefined => {
  const color = specialRarityColor(card);
  if (!color) return undefined;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const foreground = (r * 299 + g * 587 + b * 114) / 1000 >= 155
    ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))';
  return { backgroundColor: color, color: foreground };
};