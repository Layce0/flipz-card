import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const FALLBACK_WEIGHTS: Record<string, number> = { common: 60, rare: 25, epic: 12, legendary: 3 };

export function generateWeightedCards(cards: any[], weights: Record<string, number>, count: number): any[] {
  const rarityOrder = ['common', 'rare', 'epic', 'legendary'];
  const cardsByRarity = cards.reduce((acc: Record<string, any[]>, card: any) => {
    const rarity = card.rarity as string;
    if (!acc[rarity]) acc[rarity] = [];
    acc[rarity].push(card);
    return acc;
  }, {});

  const effectiveWeights: Record<string, number> = {};
  rarityOrder.forEach((rarity) => {
    effectiveWeights[rarity] = cardsByRarity[rarity]?.length ? Math.max(0, Number(weights[rarity] ?? 0)) : 0;
  });

  let totalWeight = rarityOrder.reduce((sum, rarity) => sum + effectiveWeights[rarity], 0);
  if (totalWeight <= 0) {
    rarityOrder.forEach((rarity) => {
      if (cardsByRarity[rarity]?.length) effectiveWeights[rarity] = 1;
    });
    totalWeight = rarityOrder.reduce((sum, rarity) => sum + effectiveWeights[rarity], 0);
  }

  const pickRarity = () => {
    let roll = Math.random() * totalWeight;
    for (const rarity of rarityOrder) {
      roll -= effectiveWeights[rarity];
      if (roll <= 0) return rarity;
    }
    return 'common';
  };

  const result: any[] = [];
  for (let i = 0; i < count; i++) {
    const rarity = pickRarity();
    const pool = cardsByRarity[rarity] ?? cards;
    result.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return result;
}
