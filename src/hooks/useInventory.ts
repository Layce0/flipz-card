import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { StoredPack, StoredPotion, ActivePotion, InventoryData } from '@/types/inventory';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const getInventoryKey = (userId: string | undefined) => `flipz_inventory_${userId || 'anonymous'}`;

const DEFAULT_INVENTORY: InventoryData = {
  packs: [],
  potions: [],
  activePotions: [],
};

const cleanExpiredActivePotions = (activePotions: ActivePotion[]): ActivePotion[] => {
  const now = Date.now();
  return (activePotions || []).filter(ap => new Date(ap.expiresAt).getTime() > now);
};

const loadFromStorage = (key: string): InventoryData => {
  try {
    let saved = localStorage.getItem(key);
    // If viewing authenticated inventory, auto-merge any orphaned items from anonymous
    if (key !== 'flipz_inventory_anonymous') {
      const anonSaved = localStorage.getItem('flipz_inventory_anonymous');
      if (anonSaved) {
        try {
          const anonData = JSON.parse(anonSaved);
          const currentData = saved ? JSON.parse(saved) : { ...DEFAULT_INVENTORY };
          const hasAnonItems = (anonData.packs && anonData.packs.length > 0) ||
                               (anonData.potions && anonData.potions.length > 0) ||
                               (anonData.activePotions && anonData.activePotions.length > 0);
          if (hasAnonItems) {
            const merged: InventoryData = {
              packs: [...(currentData.packs || []), ...(anonData.packs || [])],
              potions: [...(currentData.potions || [])],
              activePotions: cleanExpiredActivePotions([...(currentData.activePotions || []), ...(anonData.activePotions || [])]),
            };
            const pMap = new Map();
            merged.potions.forEach(p => pMap.set(p.id, { ...p }));
            (anonData.potions || []).forEach((p: any) => {
              if (pMap.has(p.id)) {
                pMap.get(p.id).quantity += p.quantity;
              } else {
                pMap.set(p.id, { ...p });
              }
            });
            merged.potions = Array.from(pMap.values());
            localStorage.removeItem('flipz_inventory_anonymous');
            localStorage.setItem(key, JSON.stringify(merged));
            saved = JSON.stringify(merged);
          }
        } catch (e) {}
      }
    }

    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        packs: parsed.packs || [],
        potions: parsed.potions || [],
        activePotions: cleanExpiredActivePotions(parsed.activePotions || []),
      };
    }
  } catch (e) {
    console.warn('Failed to parse inventory from localStorage', e);
  }
  return { ...DEFAULT_INVENTORY };
};

export const getPotionLabel = (type: string, config: Record<string, any>) => {
  if (type === 'boost_luck') {
    return `Potion de Chance x${config?.multiplier || 2}`;
  }
  if (type === 'boost_pack') {
    if (config?.bonus) return `Potion d'Abondance (+${config.bonus} cartes)`;
    if (config?.multiplier) return `Potion d'Abondance (x${config.multiplier} cartes)`;
    return "Potion de Boost Pack";
  }
  return 'Potion Mystique';
};

export const getPotionDescription = (type: string, config: Record<string, any>) => {
  if (type === 'boost_luck') {
    return `Augmente les chances d'obtenir des cartes epiques et legendaires pendant ${config?.duration_hours || 1}h.`;
  }
  if (type === 'boost_pack') {
    if (config?.bonus) return `Ajoute +${config.bonus} cartes a chaque booster ouvert pendant ${config?.duration_hours || 1}h.`;
    if (config?.multiplier) return `Multiplie par ${config.multiplier} les cartes recues par booster pendant ${config?.duration_hours || 1}h.`;
    return `Bonus de cartes par booster pendant ${config?.duration_hours || 1}h.`;
  }
  return 'Effet magique actif pendant 1h.';
};

export const useInventory = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const storageKey = getInventoryKey(user?.id);
  const storageKeyRef = useRef(storageKey);
  storageKeyRef.current = storageKey;

  const [inventory, setInventory] = useState<InventoryData>(() => loadFromStorage(storageKey));

  // Save helper - writes directly, no setInventory call (avoids infinite loops)
  const persist = useCallback((inv: InventoryData) => {
    try {
      localStorage.setItem(storageKeyRef.current, JSON.stringify(inv));
    } catch (e) {
      console.warn('Failed to save inventory', e);
    }
    window.dispatchEvent(new CustomEvent('flipz:inventory-updated'));
    queryClient.invalidateQueries({ queryKey: ['active-boosts'] });
  }, [queryClient]);

  // Load / reload whenever user changes
  useEffect(() => {
    const loaded = loadFromStorage(storageKey);
    setInventory(loaded);
  }, [storageKey]);

  // Listen to external changes
  useEffect(() => {
    const handleSync = () => {
      setInventory(loadFromStorage(storageKeyRef.current));
    };
    window.addEventListener('flipz:inventory-updated', handleSync);
    return () => window.removeEventListener('flipz:inventory-updated', handleSync);
  }, []);

  // Periodically clean expired potions
  useEffect(() => {
    const interval = setInterval(() => {
      setInventory(prev => {
        const cleaned = cleanExpiredActivePotions(prev.activePotions);
        if (cleaned.length !== prev.activePotions.length) {
          const updated = { ...prev, activePotions: cleaned };
          try { localStorage.setItem(storageKeyRef.current, JSON.stringify(updated)); } catch {}
          window.dispatchEvent(new CustomEvent('flipz:inventory-updated'));
          return updated;
        }
        return prev;
      });
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Add booster pack
  const addPack = useCallback((pack: Omit<StoredPack, 'instanceId' | 'obtainedAt'>) => {
    const current = loadFromStorage(storageKeyRef.current);
    const newPack: StoredPack = {
      ...pack,
      instanceId: `pack_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      obtainedAt: new Date().toISOString(),
    };
    const next = { ...current, packs: [newPack, ...current.packs] };
    setInventory(next);
    persist(next);
  }, [persist]);

  // Remove a pack when opened - returns the pack data synchronously
  const removePack = useCallback((instanceId: string): StoredPack | undefined => {
    const current = loadFromStorage(storageKeyRef.current);
    const removed = current.packs.find(p => p.instanceId === instanceId);
    if (!removed) return undefined;
    const next = { ...current, packs: current.packs.filter(p => p.instanceId !== instanceId) };
    setInventory(next);
    persist(next);
    return removed;
  }, [persist]);

  // Add potion to stock
  const removePotion = useCallback((potionId: string, quantityToRemove: number = 1): StoredPotion | undefined => {
    const current = loadFromStorage(storageKeyRef.current);
    const existingIdx = current.potions.findIndex(p => p.id === potionId);
    if (existingIdx === -1) return undefined;
    const potion = current.potions[existingIdx];
    let removedPotion: StoredPotion | undefined;
    let nextPotions: StoredPotion[];
    if (potion.quantity <= quantityToRemove) {
      removedPotion = { ...potion };
      nextPotions = current.potions.filter(p => p.id !== potionId);
    } else {
      removedPotion = { ...potion, quantity: quantityToRemove };
      nextPotions = current.potions.map(p => p.id === potionId ? { ...p, quantity: p.quantity - quantityToRemove } : p);
    }
    const next = { ...current, potions: nextPotions };
    storageKeyRef.current && persist(next);
    return removedPotion;
  }, [persist]);

  const addPotion = useCallback((potionData: {
    type: 'boost_luck' | 'boost_pack';
    name?: string;
    description?: string;
    config: Record<string, any>;
  }, quantity: number = 1) => {
    const current = loadFromStorage(storageKeyRef.current);
    const { type, config } = potionData;
    const name = potionData.name || getPotionLabel(type, config);
    const description = potionData.description || getPotionDescription(type, config);
    const potionId = `${type}_${config?.multiplier || ''}_${config?.bonus || ''}`;

    const existingIdx = current.potions.findIndex(p => p.id === potionId);
    let updatedPotions = [...current.potions];
    if (existingIdx >= 0) {
      updatedPotions[existingIdx] = { ...updatedPotions[existingIdx], quantity: updatedPotions[existingIdx].quantity + quantity };
    } else {
      updatedPotions.unshift({ id: potionId, type, name, description, config, quantity, obtainedAt: new Date().toISOString() });
    }
    const next = { ...current, potions: updatedPotions };
    setInventory(next);
    persist(next);
  }, [persist]);

  // Activate potion immediately (without touching stock)
  const activatePotionDirectly = useCallback((potionData: {
    type: 'boost_luck' | 'boost_pack';
    name?: string;
    config: Record<string, any>;
  }) => {
    const current = loadFromStorage(storageKeyRef.current);
    const { type, config } = potionData;
    const durationHours = config?.duration_hours || 1;
    const now = Date.now();
    const expiresAt = new Date(now + durationHours * 3600000).toISOString();
    const name = potionData.name || getPotionLabel(type, config);
    const potionId = `${type}_${config?.multiplier || ''}_${config?.bonus || ''}`;

    const newActivePotion: ActivePotion = {
      id: `active_${now}_${Math.random().toString(36).substring(2, 7)}`,
      potionId,
      type,
      name,
      config,
      activatedAt: new Date(now).toISOString(),
      expiresAt,
    };

    const otherActive = current.activePotions.filter(ap => ap.type !== type);
    const next = { ...current, activePotions: [...otherActive, newActivePotion] };
    setInventory(next);
    persist(next);
  }, [persist]);

  // Use 1 potion from stock: decrement quantity by 1, then activate or extend duration by 1h
  const usePotion = useCallback((potionId: string) => {
    const current = loadFromStorage(storageKeyRef.current);
    const potion = current.potions.find(p => p.id === potionId);

    if (!potion || potion.quantity <= 0) {
      toast.error('Potion introuvable ou quantite epuisee');
      return;
    }

    const durationHours = potion.config?.duration_hours || 1;
    const now = Date.now();
    
    // Check if there is already an active potion of the same type to extend it instead of replacing it
    const existingActive = current.activePotions.find(ap => ap.type === potion.type);
    let baseTime = now;
    if (existingActive) {
      const existingExpiresAtMs = new Date(existingActive.expiresAt).getTime();
      if (existingExpiresAtMs > now) {
        baseTime = existingExpiresAtMs;
      }
    }
    const expiresAt = new Date(baseTime + durationHours * 3600000).toISOString();

    const newActivePotion: ActivePotion = {
      id: existingActive ? existingActive.id : `active_${now}_${Math.random().toString(36).substring(2, 7)}`,
      potionId: potion.id,
      type: potion.type,
      name: potion.name,
      config: potion.config,
      activatedAt: existingActive ? existingActive.activatedAt : new Date(now).toISOString(),
      expiresAt,
    };

    // Decrement EXACTLY 1 unit from stock
    const nextPotions = current.potions
      .map(p => p.id === potionId ? { ...p, quantity: p.quantity - 1 } : p)
      .filter(p => p.quantity > 0);

    const otherActive = current.activePotions.filter(ap => ap.type !== potion.type);
    const next: InventoryData = {
      ...current,
      potions: nextPotions,
      activePotions: [...otherActive, newActivePotion],
    };

    setInventory(next);
    persist(next);
    if (existingActive) {
      toast.success(`${potion.name} prolongee de +${durationHours}h !`);
    } else {
      toast.success(`${potion.name} activee pour ${durationHours}h !`);
    }
  }, [persist]);

  const totalItemCount = useMemo(() => {
    const packsCount = inventory.packs.length;
    const potionsCount = inventory.potions.reduce((acc, p) => acc + p.quantity, 0);
    return packsCount + potionsCount;
  }, [inventory.packs, inventory.potions]);

  return {
    packs: inventory.packs,
    potions: inventory.potions,
    activePotions: inventory.activePotions,
    addPack,
    removePack,
    removePotion,
    addPotion,
    activatePotionDirectly,
    usePotion,
    totalItemCount,
  };
};