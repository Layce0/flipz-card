import React, { useState, useEffect } from 'react';
import { useInventory } from '@/hooks/useInventory';
import { StoredPack, StoredPotion, ActivePotion } from '@/types/inventory';
import { getPackImage } from '@/components/shop/PackPurchasedDialog';
import { PotionBottle } from './PotionIcons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, Zap, Layers, Sparkles, Clock, ShoppingBag } from 'lucide-react';
import { PackRevealFlow } from '@/components/shop/PackRevealFlow';
import { GameCard } from '@/types/card';
import { useSfx } from '@/hooks/useSfx';
import { useNavigate } from 'react-router-dom';
import inventoryBagImg from '@/assets/inventory-bag.png';

// Countdown helper for active potions
const ActivePotionCountdown = ({ expiresAt }: { expiresAt: string }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      if (remaining <= 0) {
        setTimeLeft('Expire');
        return;
      }
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      setTimeLeft(`${m}m ${s.toString().padStart(2, '0')}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <div className="flex items-center gap-1 text-xs text-yellow-300 font-mono">
      <Clock className="w-3 h-3" />
      <span>{timeLeft}</span>
    </div>
  );
};

export const ProfileInventory: React.FC = () => {
  const { packs, potions, activePotions, removePack, usePotion } = useInventory();
  const { play } = useSfx();
  const navigate = useNavigate();

  // Pack reveal state
  const [openingPack, setOpeningPack] = useState<StoredPack | null>(null);
  const [revealCards, setRevealCards] = useState<GameCard[]>([]);
  const [showReveal, setShowReveal] = useState(false);

  const handleOpenPack = (pack: StoredPack) => {
    if (!pack.cards || pack.cards.length === 0) return;
    // Remove from inventory first (reads synchronously from localStorage)
    removePack(pack.instanceId);
    setOpeningPack(pack);
    setRevealCards(pack.cards);
    setShowReveal(true);
    play('packTap');
  };

  const handleCloseReveal = () => {
    setShowReveal(false);
    setOpeningPack(null);
    setRevealCards([]);
  };

  // Group packs by packId
  const groupedPacks = packs.reduce((acc, p) => {
    if (!acc[p.packId]) {
      acc[p.packId] = { pack: p, items: [] };
    }
    acc[p.packId].items.push(p);
    return acc;
  }, {} as Record<string, { pack: StoredPack; items: StoredPack[] }>);

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="border border-primary/20 bg-gradient-to-br from-card/90 via-card/50 to-primary/5 shadow-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src={inventoryBagImg} alt="Inventaire" className="w-7 h-7 object-contain drop-shadow" />
              <CardTitle className="text-xl font-bold">Mon Inventaire</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-purple-500/40 text-purple-300">
                {packs.length} Booster{packs.length > 1 ? 's' : ''}
              </Badge>
              <Badge variant="outline" className="border-amber-500/40 text-amber-300">
                {potions.reduce((a, b) => a + b.quantity, 0)} Potion{potions.length > 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
          <CardDescription>
            Gerez vos boosters et activez vos potions quand vous le souhaitez.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* SECTION BOOSTERS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold text-foreground">Boosters en reserve</h2>
          </div>
          {packs.length === 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/shop')}
              className="text-xs text-primary hover:text-primary/80"
            >
              Aller a la boutique
            </Button>
          )}
        </div>

        {packs.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-border/60 bg-card/40 flex flex-col items-center">
            <Package className="w-10 h-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-semibold text-foreground">Aucun booster dans l'inventaire</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Achetez des boosters dans la boutique et choisissez de les stocker ici !
            </p>
            <Button
              size="sm"
              onClick={() => navigate('/shop')}
              className="mt-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-md"
            >
              Decouvrir les boosters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.values(groupedPacks).map(({ pack, items }) => {
              const packImg = getPackImage(pack.packId);
              const count = items.length;
              const firstItem = items[0];

              return (
                <div
                  key={pack.packId}
                  className="relative p-4 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-[#120f24] to-[#090814] shadow-lg flex items-center justify-between gap-3 overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 rounded-full blur-2xl pointer-events-none" />

                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <img
                        src={packImg}
                        alt={pack.name}
                        className="w-16 h-20 object-contain drop-shadow-[0_0_12px_rgba(168,85,247,0.5)] transform group-hover:scale-105 transition-transform"
                      />
                      {count > 1 && (
                        <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-black bg-purple-600 text-white rounded-full border border-purple-300 shadow">
                          x{count}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="font-bold text-sm text-white">{pack.name}</h3>
                      <p className="text-xs text-purple-300/70">{pack.cardCount} cartes</p>
                      <span className="inline-block mt-1 text-[10px] text-muted-foreground">
                        En stock : <span className="font-bold text-white">{count}</span>
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleOpenPack(firstItem)}
                    className="h-10 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-[0_0_15px_rgba(168,85,247,0.4)] flex-shrink-0"
                  >
                    Ouvrir
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION POTIONS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-foreground">Potions magiques</h2>
          </div>
        </div>

        {potions.length === 0 && activePotions.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-border/60 bg-card/40 flex flex-col items-center">
            <Zap className="w-10 h-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-semibold text-foreground">Aucune potion pour le moment</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Gagnez des potions dans la Winstreak quotidienne et avec les codes promo !
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Active potions first */}
            {activePotions.map(active => (
              <div
                key={active.id}
                className="relative p-4 rounded-2xl border-2 border-yellow-400/80 bg-gradient-to-r from-yellow-950/20 via-card to-card shadow-[0_0_20px_rgba(250,204,21,0.2)] flex items-center justify-between gap-3 overflow-hidden"
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0 animate-pulse">
                    <PotionBottle type={active.type} config={active.config} size={48} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-yellow-300">{active.name}</h3>
                      <Badge className="bg-yellow-400/20 text-yellow-300 text-[10px] border-yellow-400/40">
                        Actif
                      </Badge>
                    </div>
                    <div className="mt-1">
                      <ActivePotionCountdown expiresAt={active.expiresAt} />
                    </div>
                  </div>
                </div>

                <div className="relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#12131a] border-2 border-yellow-400 text-yellow-400 font-extrabold shadow-[0_0_15px_rgba(250,204,21,0.55),inset_0_0_10px_rgba(250,204,21,0.15)] select-none">
                  <Layers className="w-4 h-4 text-yellow-400 stroke-[2.5]" />
                  <span className="text-xs tracking-wider">Utilise</span>
                </div>
              </div>
            ))}

            {/* Potions in stock */}
            {potions.map(potion => {
              const isLuck = potion.type === 'boost_luck';
              const activeMatch = activePotions.find(ap => ap.type === potion.type);

              return (
                <div
                  key={potion.id}
                  className="relative p-4 rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/60 shadow-lg flex items-center justify-between gap-3 overflow-hidden"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <PotionBottle type={potion.type} config={potion.config} size={48} />
                      {potion.quantity > 1 && (
                        <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-black bg-amber-500 text-stone-950 rounded-full border border-amber-300 shadow">
                          x{potion.quantity}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white">{potion.name}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-1 max-w-[220px]">
                        {potion.description}
                      </p>
                      <span className="inline-block mt-1 text-[10px] text-muted-foreground">
                        Quantite : <span className="font-bold text-white">{potion.quantity}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <Button
                      onClick={() => usePotion(potion.id)}
                      className={`h-9 px-4 rounded-xl text-xs font-bold shadow-md transition-all active:scale-[0.98] ${
                        isLuck
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-stone-950 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                          : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                      {activeMatch ? 'Prolonger' : 'Utiliser'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Pack reveal modal when opened from inventory */}
      {openingPack && (
        <PackRevealFlow
          isOpen={showReveal}
          onClose={handleCloseReveal}
          cards={revealCards}
          packType={openingPack.packType}
          packName={openingPack.name}
        />
      )}
    </div>
  );
};