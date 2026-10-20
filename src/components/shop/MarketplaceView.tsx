import React, { useState, useMemo, useEffect } from 'react';
import {
  useMarketplace,
  MarketplaceItem,
  MarketplaceItemType,
  OpenAuction,
  DirectTrade,
  AuctionBid,
} from '@/hooks/useMarketplace';
import { useInventory } from '@/hooks/useInventory';
import { useAuth } from '@/contexts/AuthContext';
import { useAllCards, useUserCards, UserCardWithCount } from '@/hooks/useCards';
import { useSfx } from '@/hooks/useSfx';
import { GameCard, Rarity, RARITY_CONFIG } from '@/types/card';
import { StoredPack, StoredPotion } from '@/types/inventory';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Gavel, ArrowLeftRight, Plus, Clock, Check, X, ChevronDown,
  Package, Sparkles, Zap, Search, Send, Trophy, Shield, Eye,
  Timer, Users, CheckCircle2, XCircle, Filter, Heart, Info, Flame,
} from 'lucide-react';

/* ────────────────────────────────────────────────────────────
   Timer display with Urgent indicator
   ──────────────────────────────────────────────────────────── */

const CountdownTimer = ({ endsAt, compact }: { endsAt: string; compact?: boolean }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const update = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Terminé');
        setIsExpired(true);
        setIsUrgent(false);
        return;
      }
      setIsUrgent(diff <= 20 * 60 * 1000); // 20 mins or less is urgent
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 0) setTimeLeft(`${h}h ${m.toString().padStart(2, '0')}m`);
      else if (m > 0) setTimeLeft(`${m}m ${s.toString().padStart(2, '0')}s`);
      else setTimeLeft(`${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return (
    <span className={cn(
      "inline-flex items-center gap-1 font-mono text-xs font-bold transition-all",
      isExpired ? "text-red-400" : isUrgent ? "text-amber-400 font-extrabold" : "text-amber-300",
      compact && "text-[10px]"
    )}>
      {isUrgent && !isExpired ? (
        <Flame className="w-3.5 h-3.5 text-red-400 animate-pulse" />
      ) : (
        <Timer className="w-3 h-3" />
      )}
      {timeLeft}
      {isUrgent && !isExpired && (
        <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-red-500/25 text-red-300 border border-red-500/35 ml-0.5 animate-pulse">
          Bientôt fini
        </span>
      )}
    </span>
  );
};

/* ────────────────────────────────────────────────────────────
   Rarity badge helper
   ──────────────────────────────────────────────────────────── */

function getRarityBadge(rarity?: string) {
  const r = (rarity || 'common').toLowerCase();
  if (r === 'legendary') return 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-extrabold';
  if (r === 'epic') return 'bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white font-bold';
  if (r === 'rare') return 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-bold';
  return 'bg-zinc-700 text-zinc-200 font-semibold';
}

function getItemTypeLabel(type: MarketplaceItemType) {
  if (type === 'card') return 'Carte';
  if (type === 'potion') return 'Potion';
  return 'Booster';
}

function getItemTypeIcon(type: MarketplaceItemType) {
  if (type === 'card') return <Sparkles className="w-3 h-3" />;
  if (type === 'potion') return <Zap className="w-3 h-3" />;
  return <Package className="w-3 h-3" />;
}

/* ────────────────────────────────────────────────────────────
   Item card preview (used in auction list & create form)
   ──────────────────────────────────────────────────────────── */

const MarketplaceItemCard = ({
  item,
  size = 'md',
  onClick,
  selected,
}: {
  item: MarketplaceItem;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  selected?: boolean;
}) => {
  const sizeClasses = size === 'lg' ? 'w-20 h-[104px]' : size === 'md' ? 'w-16 h-[84px]' : 'w-12 h-[64px]';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 group",
        selected
          ? "border-amber-400 ring-2 ring-amber-400/40 shadow-[0_0_16px_rgba(251,191,36,0.4)]"
          : "border-zinc-700/60 hover:border-purple-400/60",
        sizeClasses,
        onClick && "cursor-pointer active:scale-95"
      )}
    >
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-purple-900/60 to-zinc-900 flex items-center justify-center">
          {getItemTypeIcon(item.type)}
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
      <div className="absolute bottom-0 inset-x-0 p-1 text-center">
        <span className="text-[8px] text-white font-medium truncate block leading-tight">
          {item.name}
        </span>
        {item.rarity && (
          <span className={cn(
            "text-[7px] px-1 py-0.5 rounded-sm inline-block mt-0.5 leading-none",
            getRarityBadge(item.rarity)
          )}>
            {RARITY_CONFIG[item.rarity]?.label || item.rarity}
          </span>
        )}
      </div>
      {item.type !== 'card' && (
        <div className="absolute top-1 left-1">
          <span className="px-1 py-0.5 rounded text-[7px] font-bold bg-black/60 text-purple-300 border border-purple-500/30">
            {getItemTypeLabel(item.type)}
          </span>
        </div>
      )}
    </button>
  );
};

/* ────────────────────────────────────────────────────────────
   Item Picker Dialog (inline, for selecting what to offer/want)
   ──────────────────────────────────────────────────────────── */

const ItemPicker = ({
  title,
  onSelect,
  onClose,
  userCards,
}: {
  title: string;
  onSelect: (item: MarketplaceItem) => void;
  onClose: () => void;
  userCards: UserCardWithCount[];
}) => {
  const { packs, potions } = useInventory();
  const [tab, setTab] = useState<'cards' | 'potions' | 'boosters'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [cardRarity, setCardRarity] = useState<'all' | 'common' | 'rare' | 'epic' | 'legendary'>('all');
  const [potionType, setPotionType] = useState<'all' | 'boost_luck' | 'boost_pack'>('all');
  const [packType, setPackType] = useState<'all' | 'standard' | 'lucky' | 'ultra'>('all');

  const filteredCards = useMemo(() => {
    let list = userCards;
    if (cardRarity !== 'all') {
      list = list.filter(c => c.rarity?.toLowerCase() === cardRarity);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => c.title?.toLowerCase().includes(q));
    }
    return list;
  }, [userCards, cardRarity, searchQuery]);

  const filteredPotions = useMemo(() => {
    let list = potions;
    if (potionType !== 'all') {
      list = list.filter(p => p.type === potionType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [potions, potionType, searchQuery]);

  const filteredPacks = useMemo(() => {
    let list = packs;
    if (packType !== 'all') {
      list = list.filter(p => p.packType === packType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [packs, packType, searchQuery]);

  const handleSelectCard = (card: UserCardWithCount) => {
    onSelect({
      type: 'card',
      id: card.id,
      name: card.title,
      imageUrl: card.image_url,
      rarity: card.rarity as Rarity,
    });
  };

  const handleSelectPotion = (potion: StoredPotion) => {
    onSelect({
      type: 'potion',
      id: potion.id,
      name: potion.name,
      meta: { potionType: potion.type, description: potion.description, config: potion.config },
    });
  };

  const handleSelectPack = (pack: StoredPack) => {
    onSelect({
      type: 'booster',
      id: pack.instanceId,
      name: pack.name,
      meta: { packId: pack.packId, cardCount: pack.cardCount, packType: pack.packType },
    });
  };

  return (
    <div className="bg-[#0e0f1e] border border-zinc-800 rounded-2xl p-3 space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-white uppercase tracking-wider">{title}</h4>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
          <X className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {/* Main Tab buttons */}
      <div className="flex gap-1 p-0.5 bg-black/40 rounded-lg border border-zinc-800">
        {[
          { key: 'cards' as const, label: 'Cartes', icon: <Sparkles className="w-3 h-3" />, count: userCards.length },
          { key: 'potions' as const, label: 'Potions', icon: <Zap className="w-3 h-3" />, count: potions.length },
          { key: 'boosters' as const, label: 'Boosters', icon: <Package className="w-3 h-3" />, count: packs.length },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-[10px] font-bold transition-all",
              tab === t.key
                ? "bg-zinc-800 text-white shadow-sm border border-zinc-700"
                : "text-zinc-400 hover:text-white"
            )}
          >
            {t.icon}
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Subcategory Pills */}
      {tab === 'cards' && (
        <div className="flex gap-1 overflow-x-auto scrollbar-none pb-0.5">
          {[
            { key: 'all', label: 'Toutes' },
            { key: 'common', label: 'Communes' },
            { key: 'rare', label: 'Rares' },
            { key: 'epic', label: 'Épiques' },
            { key: 'legendary', label: 'Légendaires' },
          ].map(r => (
            <button
              key={r.key}
              type="button"
              onClick={() => setCardRarity(r.key as any)}
              className={cn(
                "px-2 py-0.5 rounded text-[9px] font-semibold transition-all border",
                cardRarity === r.key
                  ? "bg-amber-400/20 text-amber-300 border-amber-400/40"
                  : "bg-white/5 text-zinc-400 border-transparent hover:text-white"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'potions' && (
        <div className="flex gap-1 overflow-x-auto scrollbar-none pb-0.5">
          {[
            { key: 'all', label: 'Toutes' },
            { key: 'boost_luck', label: 'Chance' },
            { key: 'boost_pack', label: 'Boost Pack' },
          ].map(p => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPotionType(p.key as any)}
              className={cn(
                "px-2 py-0.5 rounded text-[9px] font-semibold transition-all border",
                potionType === p.key
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                  : "bg-white/5 text-zinc-400 border-transparent hover:text-white"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'boosters' && (
        <div className="flex gap-1 overflow-x-auto scrollbar-none pb-0.5">
          {[
            { key: 'all', label: 'Tous' },
            { key: 'standard', label: 'Standard' },
            { key: 'lucky', label: 'Chanceux' },
            { key: 'ultra', label: 'Ultra' },
          ].map(b => (
            <button
              key={b.key}
              type="button"
              onClick={() => setPackType(b.key as any)}
              className={cn(
                "px-2 py-0.5 rounded text-[9px] font-semibold transition-all border",
                packType === b.key
                  ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                  : "bg-white/5 text-zinc-400 border-transparent hover:text-white"
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
        <input
          type="text"
          placeholder="Rechercher..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 bg-black/40 border border-zinc-800 rounded-lg text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
        />
      </div>

      {/* Items grid */}
      <div className="max-h-[200px] overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin">
        {tab === 'cards' && (
          filteredCards.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-6 italic">Aucune carte disponible</p>
          ) : (
            <div className="grid grid-cols-5 gap-1.5">
              {filteredCards.map(card => (
                <button
                  key={card.id}
                  onClick={() => handleSelectCard(card)}
                  className="relative rounded-xl overflow-hidden border border-zinc-700/60 hover:border-amber-400 transition-all aspect-[3/4] active:scale-95"
                >
                  <img src={card.image_url} alt={card.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  <div className="absolute bottom-0.5 inset-x-0 text-center">
                    <span className="text-[7px] text-white font-medium truncate block px-0.5">{card.title}</span>
                    <span className="text-[8px] text-amber-400 font-black">×{card.count}</span>
                  </div>
                </button>
              ))}
            </div>
          )
        )}

        {tab === 'potions' && (
          filteredPotions.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-6 italic">Aucune potion disponible</p>
          ) : (
            <div className="space-y-1.5">
              {filteredPotions.map(potion => (
                <button
                  key={potion.id}
                  onClick={() => handleSelectPotion(potion)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-black/30 border border-zinc-800 hover:border-purple-400 transition-all active:scale-[0.98]"
                >
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-600/30 to-fuchsia-600/20 flex items-center justify-center border border-purple-500/30">
                    <Zap className="w-4 h-4 text-purple-300" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{potion.name}</p>
                    <p className="text-[10px] text-zinc-400 truncate">{potion.description}</p>
                  </div>
                  <span className="text-[10px] text-amber-400 font-bold px-1.5 py-0.5 bg-amber-400/10 rounded-lg">×{potion.quantity}</span>
                </button>
              ))}
            </div>
          )
        )}

        {tab === 'boosters' && (
          filteredPacks.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-6 italic">Aucun booster disponible</p>
          ) : (
            <div className="space-y-1.5">
              {packs.map(pack => (
                <button
                  key={pack.instanceId}
                  onClick={() => handleSelectPack(pack)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-black/30 border border-zinc-800 hover:border-amber-400 transition-all active:scale-[0.98]"
                >
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-600/30 to-orange-600/20 flex items-center justify-center border border-amber-500/30">
                    <Package className="w-4 h-4 text-amber-300" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{pack.name}</p>
                    <p className="text-[10px] text-zinc-400">{pack.cardCount} cartes</p>
                  </div>
                </button>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────
   Create Offer Flow
   ──────────────────────────────────────────────────────────── */

const CreateOfferPanel = ({
  userCards,
  onClose,
  createAuction,
  createDirectTrade,
}: {
  userCards: UserCardWithCount[];
  onClose: () => void;
  createAuction: (item: MarketplaceItem, durationMinutes?: number) => string;
  createDirectTrade: (offeredItem: MarketplaceItem, wantedItem: MarketplaceItem) => string;
}) => {
  const { play } = useSfx();

  const [offerType, setOfferType] = useState<'auction' | 'direct'>('auction');
  const [myItem, setMyItem] = useState<MarketplaceItem | null>(null);
  const [wantedItem, setWantedItem] = useState<MarketplaceItem | null>(null);
  const [duration, setDuration] = useState(60); // minutes
  const [pickingFor, setPickingFor] = useState<'mine' | 'wanted' | null>(null);
  const { data: allCards = [] } = useAllCards();

  // All cards as UserCardWithCount for wanted picker (any card, not just owned)
  const allCardsAsFake = useMemo<UserCardWithCount[]>(() =>
    allCards.map(c => ({ ...c, count: 1, obtained_at: '', user_id: '', card_id: c.id })),
    [allCards]
  );

  const handleSubmit = () => {
    if (!myItem) {
      toast.error('Sélectionnez un item à proposer !');
      return;
    }
    play('navClick');

    if (offerType === 'auction') {
      createAuction(myItem, duration);
      onClose();
    } else {
      if (!wantedItem) {
        toast.error('Sélectionnez ce que vous voulez en échange !');
        return;
      }
      createDirectTrade(myItem, wantedItem);
      onClose();
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Type selector */}
      <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-zinc-800">
        <button
          onClick={() => setOfferType('auction')}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all",
            offerType === 'auction'
              ? "bg-gradient-to-r from-amber-500 to-orange-600 text-black shadow-lg"
              : "text-zinc-400 hover:text-white"
          )}
        >
          <Gavel className="w-3.5 h-3.5" />
          Enchère ouverte
        </button>
        <button
          onClick={() => setOfferType('direct')}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all",
            offerType === 'direct'
              ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg"
              : "text-zinc-400 hover:text-white"
          )}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          Échange direct
        </button>
      </div>

      {/* Description */}
      <p className="text-[11px] text-zinc-400 leading-relaxed">
        {offerType === 'auction'
          ? "Proposez une carte, potion ou booster. Les joueurs font des offres et à la fin du timer, vous choisissez celle qui vous plaît !"
          : "Proposez un échange direct : « Je donne ça contre ça ». Le premier joueur intéressé accepte."}
      </p>

      {/* My item selection */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
          {offerType === 'auction' ? '🎁 Je mets en enchère :' : '🎁 Je propose :'}
        </label>
        {myItem ? (
          <div className="flex items-center gap-3 p-2 bg-black/30 rounded-xl border border-amber-500/30">
            <MarketplaceItemCard item={myItem} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{myItem.name}</p>
              <p className="text-[10px] text-zinc-400">{getItemTypeLabel(myItem.type)}</p>
            </div>
            <button
              onClick={() => { setMyItem(null); setPickingFor(null); }}
              className="p-1 hover:bg-white/10 rounded-lg"
            >
              <X className="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </div>
        ) : (
          <>
            {pickingFor === 'mine' ? (
              <ItemPicker
                title="Choisir un item"
                userCards={userCards}
                onSelect={(item) => { setMyItem(item); setPickingFor(null); }}
                onClose={() => setPickingFor(null)}
              />
            ) : (
              <button
                onClick={() => setPickingFor('mine')}
                className="w-full py-3 border-2 border-dashed border-zinc-700 hover:border-amber-400/50 rounded-xl text-xs text-zinc-400 hover:text-amber-300 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Sélectionner carte / potion / booster
              </button>
            )}
          </>
        )}
      </div>

      {/* Duration (auction only) */}
      {offerType === 'auction' && (
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Timer className="w-3 h-3" />
            Durée de l'enchère
          </label>
          <div className="flex gap-2">
            {[
              { label: '15m', value: 15 },
              { label: '30m', value: 30 },
              { label: '1h', value: 60 },
              { label: '2h', value: 120 },
              { label: '4h', value: 240 },
              { label: '12h', value: 720 },
            ].map(d => (
              <button
                key={d.value}
                onClick={() => setDuration(d.value)}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                  duration === d.value
                    ? "bg-amber-500 text-black shadow-lg"
                    : "bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Wanted item (direct only) */}
      {offerType === 'direct' && (
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">
            💎 Je veux en échange :
          </label>
          {wantedItem ? (
            <div className="flex items-center gap-3 p-2 bg-black/30 rounded-xl border border-purple-500/30">
              <MarketplaceItemCard item={wantedItem} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{wantedItem.name}</p>
                <p className="text-[10px] text-zinc-400">{getItemTypeLabel(wantedItem.type)}</p>
              </div>
              <button
                onClick={() => { setWantedItem(null); setPickingFor(null); }}
                className="p-1 hover:bg-white/10 rounded-lg"
              >
                <X className="w-3.5 h-3.5 text-zinc-400" />
              </button>
            </div>
          ) : (
            <>
              {pickingFor === 'wanted' ? (
                <ItemPicker
                  title="Choisir ce que vous voulez"
                  userCards={allCardsAsFake}
                  onSelect={(item) => { setWantedItem(item); setPickingFor(null); }}
                  onClose={() => setPickingFor(null)}
                />
              ) : (
                <button
                  onClick={() => setPickingFor('wanted')}
                  className="w-full py-3 border-2 border-dashed border-zinc-700 hover:border-purple-400/50 rounded-xl text-xs text-zinc-400 hover:text-purple-300 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Sélectionner ce que je veux
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Submit */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-xs font-bold text-zinc-400 hover:bg-zinc-800 transition-all"
        >
          Annuler
        </button>
        <button
          onClick={handleSubmit}
          disabled={!myItem || (offerType === 'direct' && !wantedItem)}
          className={cn(
            "flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5",
            myItem
              ? offerType === 'auction'
                ? "bg-gradient-to-r from-amber-400 to-orange-500 text-black shadow-lg hover:shadow-xl active:scale-[0.98]"
                : "bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg hover:shadow-xl active:scale-[0.98]"
              : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
          )}
        >
          <Send className="w-3.5 h-3.5" />
          {offerType === 'auction' ? 'Lancer l\'enchère' : 'Publier l\'offre'}
        </button>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────
   Bid Dialog (to bid on an auction with your own items)
   ──────────────────────────────────────────────────────────── */

const BidPanel = ({
  auction,
  userCards,
  onClose,
  placeBid,
}: {
  auction: OpenAuction;
  userCards: UserCardWithCount[];
  onClose: () => void;
  placeBid: (auctionId: string, offeredItems: MarketplaceItem[]) => string;
}) => {
  const [selectedItems, setSelectedItems] = useState<MarketplaceItem[]>([]);
  const [picking, setPicking] = useState(false);

  const handleAddItem = (item: MarketplaceItem) => {
    setSelectedItems(prev => [...prev, item]);
    setPicking(false);
  };

  const handleRemoveItem = (idx: number) => {
    setSelectedItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmitBid = () => {
    if (selectedItems.length === 0) {
      toast.error('Ajoutez au moins un item à votre offre !');
      return;
    }
    placeBid(auction.id, selectedItems);
    onClose();
  };

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          <Gavel className="w-4 h-4 text-amber-400" />
          Faire une offre
        </h4>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
          <X className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      <p className="text-[10px] text-zinc-400">
        Pour : <span className="text-amber-300 font-bold">{auction.item.name}</span>
      </p>

      {/* Existing competitor offers */}
      {auction.bids.length > 0 ? (
        <div className="p-2.5 rounded-xl bg-black/40 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Offres déjà en compétition ({auction.bids.length})
            </span>
            <span className="text-[9px] text-zinc-400">À surpasser !</span>
          </div>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
            {auction.bids.map((b, i) => (
              <div key={b.id || i} className="p-2 rounded-lg bg-zinc-900/70 border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-white">{b.bidderName}</span>
                  <span className="text-[9px] text-zinc-400">{b.offeredItems.length} item(s)</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {b.offeredItems.map((item, idx) => (
                    <MarketplaceItemCard key={idx} item={item} size="sm" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-2 rounded-xl bg-zinc-900/50 border border-zinc-800/80 text-center">
          <p className="text-[10px] text-zinc-400 italic">
            Aucune offre pour l'instant. Soyez le premier à faire une offre !
          </p>
        </div>
      )}

      {/* Selected items */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-black/30 rounded-xl border border-purple-500/20">
          {selectedItems.map((item, idx) => (
            <div key={idx} className="relative">
              <MarketplaceItemCard item={item} size="sm" />
              <button
                onClick={() => handleRemoveItem(idx)}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center"
              >
                <X className="w-2.5 h-2.5 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {picking ? (
        <ItemPicker
          title="Ajouter un item à l'offre"
          userCards={userCards}
          onSelect={handleAddItem}
          onClose={() => setPicking(false)}
        />
      ) : (
        <button
          onClick={() => setPicking(true)}
          className="w-full py-2.5 border-2 border-dashed border-zinc-700 hover:border-purple-400/50 rounded-xl text-xs text-zinc-400 hover:text-purple-300 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Ajouter un item à votre offre
        </button>
      )}

      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 py-2 rounded-xl border border-zinc-700 text-xs font-bold text-zinc-400 hover:bg-zinc-800 transition-all"
        >
          Annuler
        </button>
        <button
          onClick={handleSubmitBid}
          disabled={selectedItems.length === 0}
          className={cn(
            "flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5",
            selectedItems.length > 0
              ? "bg-gradient-to-r from-amber-400 to-orange-500 text-black shadow-lg active:scale-[0.98]"
              : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
          )}
        >
          <Send className="w-3.5 h-3.5" />
          Envoyer l'offre ({selectedItems.length})
        </button>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────
   View Bids Dialog (for auction creator & any interested player)
   ──────────────────────────────────────────────────────────── */

const ViewBidsPanel = ({
  auction,
  myId,
  onClose,
  acceptBid,
  onBidClick,
}: {
  auction: OpenAuction;
  myId: string;
  onClose: () => void;
  acceptBid: (auctionId: string, bidId: string) => void;
  onBidClick?: (auction: OpenAuction) => void;
}) => {
  const isOwner = auction.creatorId === myId;
  const isEnded = auction.status === 'ended' || new Date(auction.endsAt).getTime() <= Date.now();

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-400" />
            {isOwner ? `Offres reçues sur votre enchère (${auction.bids.length})` : `Offres en cours (${auction.bids.length})`}
          </h4>
          <p className="text-[10px] text-zinc-400 mt-0.5">
            Pour : <span className="text-amber-300 font-bold">{auction.item.name}</span>
            {' • '}vendeur : <span className="text-zinc-200 font-semibold">{auction.creatorName}</span>
          </p>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
          <X className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {/* Item & Timer summary card */}
      <div className="flex items-center justify-between p-2.5 bg-black/40 rounded-xl border border-zinc-800">
        <div className="flex items-center gap-2.5">
          <MarketplaceItemCard item={auction.item} size="sm" />
          <div>
            <p className="text-xs font-bold text-white">{auction.item.name}</p>
            <CountdownTimer endsAt={auction.endsAt} />
          </div>
        </div>
        {!isOwner && (
          <button
            onClick={() => onBidClick?.(auction)}
            className="py-1.5 px-3 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black text-xs font-bold flex items-center gap-1 shadow-md active:scale-95 transition-all"
          >
            <Gavel className="w-3.5 h-3.5" />
            Enchérir
          </button>
        )}
      </div>

      {isOwner && !isEnded && (
        <div className="flex items-center gap-2 p-2 bg-amber-500/10 rounded-xl border border-amber-500/20">
          <Timer className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-[10px] text-amber-300">
            L'enchère est encore active. Vous pouvez accepter une offre dès maintenant ou attendre la fin du chrono !
          </p>
        </div>
      )}

      {!isOwner && (
        <div className="flex items-center gap-2 p-2 bg-purple-500/10 rounded-xl border border-purple-500/20">
          <Info className="w-4 h-4 text-purple-400 flex-shrink-0" />
          <p className="text-[10px] text-purple-200">
            Voici les offres déjà soumises par les autres joueurs. Proposez une offre plus intéressante pour convaincre le vendeur !
          </p>
        </div>
      )}

      {auction.bids.length === 0 ? (
        <div className="text-center py-8 px-4 rounded-xl border border-dashed border-zinc-800 space-y-2">
          <p className="text-xs text-zinc-400 italic">
            Aucune offre pour le moment sur cette enchère.
          </p>
          {!isOwner && (
            <button
              onClick={() => onBidClick?.(auction)}
              className="py-1.5 px-4 rounded-lg bg-amber-400 text-black text-xs font-bold inline-flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <Gavel className="w-3.5 h-3.5" />
              Soyez le premier à faire une offre !
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
          {auction.bids.map((bid, index) => (
            <div
              key={bid.id || index}
              className={cn(
                "p-3 rounded-xl border transition-all",
                auction.acceptedBidId === bid.id
                  ? "bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30"
                  : bid.bidderId === myId
                  ? "bg-purple-950/20 border-purple-500/40"
                  : "bg-black/40 border-zinc-800 hover:border-zinc-700"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                    {bid.bidderName ? bid.bidderName[0]?.toUpperCase() : '?'}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">{bid.bidderName || 'Joueur anonyme'}</span>
                      {bid.bidderId === myId && (
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-300 border border-purple-500/40">
                          Votre offre
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-zinc-500">
                      Offre #{index + 1}
                      {bid.bidAt ? ` • ${new Date(bid.bidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </span>
                  </div>
                </div>

                {auction.acceptedBidId === bid.id && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500 text-white flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Offre acceptée
                  </span>
                )}
              </div>

              {/* Bid items */}
              <div className="p-2 rounded-lg bg-zinc-900/60 border border-white/5 space-y-1">
                <span className="text-[9px] text-zinc-400 font-medium block">
                  Items proposés ({bid.offeredItems.length}) :
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {bid.offeredItems.map((item, i) => (
                    <MarketplaceItemCard key={i} item={item} size="sm" />
                  ))}
                </div>
              </div>

              {/* Accept button (creator only) */}
              {isOwner && !auction.acceptedBidId && (
                <button
                  onClick={() => { acceptBid(auction.id, bid.id); onClose(); }}
                  className="w-full mt-2 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white text-[10px] font-black flex items-center justify-center gap-1 active:scale-[0.98] transition-all shadow-md"
                >
                  <Check className="w-3.5 h-3.5" />
                  Accepter cette offre
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onClose}
          className="flex-1 py-2 rounded-xl border border-zinc-700 text-xs font-bold text-zinc-400 hover:bg-zinc-800 transition-all"
        >
          Fermer
        </button>
        {!isOwner && (
          <button
            onClick={() => onBidClick?.(auction)}
            className="flex-1 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-black text-xs font-black flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <Gavel className="w-3.5 h-3.5" />
            Faire une offre
          </button>
        )}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════
   MAIN: MarketplaceTab Component
   ════════════════════════════════════════════════════════════ */

export const MarketplaceTab: React.FC<{
  userCards: UserCardWithCount[];
}> = ({ userCards }) => {
  const { user } = useAuth();
  const { play } = useSfx();
  const {
    myId,
    openAuctions,
    endedAuctions,
    openDirectTrades,
    myActiveAuctions,
    myEndedAuctions,
    myDirectTrades,
    createAuction,
    createDirectTrade,
    placeBid,
    acceptBid,
    cancelAuction,
    cancelDirectTrade,
    acceptDirectTrade,
  } = useMarketplace();

  const [view, setView] = useState<'browse' | 'create'>('browse');
  const [subTab, setSubTab] = useState<'auctions' | 'directs' | 'my'>('auctions');
  const [biddingAuction, setBiddingAuction] = useState<OpenAuction | null>(null);
  const [viewingBids, setViewingBids] = useState<OpenAuction | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'card' | 'potion' | 'booster'>('all');
  const [cardRarityFilter, setCardRarityFilter] = useState<'all' | 'common' | 'rare' | 'epic' | 'legendary'>('all');
  const [potionSubFilter, setPotionSubFilter] = useState<'all' | 'luck' | 'pack'>('all');
  const [boosterSubFilter, setBoosterSubFilter] = useState<'all' | 'standard' | 'lucky' | 'ultra'>('all');
  const [sortBy, setSortBy] = useState<'endingSoon' | 'newest'>('endingSoon');

  const totalMy = myActiveAuctions.length + myEndedAuctions.length + myDirectTrades.length;

  // Filtered & sorted auctions (Real announcements only)
  const filteredAuctions = useMemo(() => {
    let list = [...openAuctions];

    // Filter by item type
    if (categoryFilter !== 'all') {
      list = list.filter(a => a.item.type === categoryFilter);
    }

    // Subcategory: Cards rarity
    if (categoryFilter === 'card' && cardRarityFilter !== 'all') {
      list = list.filter(a => a.item.rarity?.toLowerCase() === cardRarityFilter);
    }

    // Subcategory: Potions
    if (categoryFilter === 'potion' && potionSubFilter !== 'all') {
      if (potionSubFilter === 'luck') {
        list = list.filter(a =>
          a.item.meta?.potionType === 'boost_luck' ||
          a.item.name.toLowerCase().includes('chance') ||
          a.item.name.toLowerCase().includes('luck')
        );
      } else if (potionSubFilter === 'pack') {
        list = list.filter(a =>
          a.item.meta?.potionType === 'boost_pack' ||
          a.item.name.toLowerCase().includes('pack') ||
          a.item.name.toLowerCase().includes('booster')
        );
      }
    }

    // Subcategory: Boosters
    if (categoryFilter === 'booster' && boosterSubFilter !== 'all') {
      if (boosterSubFilter === 'standard') {
        list = list.filter(a =>
          a.item.meta?.packType === 'standard' ||
          a.item.name.toLowerCase().includes('standard')
        );
      } else if (boosterSubFilter === 'lucky') {
        list = list.filter(a =>
          a.item.meta?.packType === 'lucky' ||
          a.item.name.toLowerCase().includes('chanceux')
        );
      } else if (boosterSubFilter === 'ultra') {
        list = list.filter(a =>
          a.item.meta?.packType === 'ultra' ||
          a.item.name.toLowerCase().includes('ultra')
        );
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(a =>
        a.item.name.toLowerCase().includes(q) ||
        a.creatorName.toLowerCase().includes(q)
      );
    }

    // Sort: ending soon (timer croissant) vs newest
    if (sortBy === 'endingSoon') {
      list.sort((a, b) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime());
    } else {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return list;
  }, [openAuctions, categoryFilter, cardRarityFilter, potionSubFilter, boosterSubFilter, searchQuery, sortBy]);

  // Filtered direct trades
  const filteredDirectTrades = useMemo(() => {
    let list = [...openDirectTrades];

    if (categoryFilter !== 'all') {
      list = list.filter(t => t.offeredItem.type === categoryFilter || t.wantedItem.type === categoryFilter);
    }

    if (categoryFilter === 'card' && cardRarityFilter !== 'all') {
      list = list.filter(t =>
        t.offeredItem.rarity?.toLowerCase() === cardRarityFilter ||
        t.wantedItem.rarity?.toLowerCase() === cardRarityFilter
      );
    }

    if (categoryFilter === 'potion' && potionSubFilter !== 'all') {
      const matchP = (it: MarketplaceItem) =>
        potionSubFilter === 'luck'
          ? it.meta?.potionType === 'boost_luck' || it.name.toLowerCase().includes('chance')
          : it.meta?.potionType === 'boost_pack' || it.name.toLowerCase().includes('pack');
      list = list.filter(t => matchP(t.offeredItem) || matchP(t.wantedItem));
    }

    if (categoryFilter === 'booster' && boosterSubFilter !== 'all') {
      const matchB = (it: MarketplaceItem) =>
        it.meta?.packType === boosterSubFilter || it.name.toLowerCase().includes(boosterSubFilter);
      list = list.filter(t => matchB(t.offeredItem) || matchB(t.wantedItem));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(t =>
        t.offeredItem.name.toLowerCase().includes(q) ||
        t.wantedItem.name.toLowerCase().includes(q) ||
        t.creatorName.toLowerCase().includes(q)
      );
    }

    if (sortBy === 'newest') {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return list;
  }, [openDirectTrades, categoryFilter, cardRarityFilter, potionSubFilter, boosterSubFilter, searchQuery, sortBy]);

  if (view === 'create') {
    return (
      <div className="p-4">
        <CreateOfferPanel
          userCards={userCards}
          onClose={() => setView('browse')}
          createAuction={createAuction}
          createDirectTrade={createDirectTrade}
        />
      </div>
    );
  }

  if (biddingAuction) {
    return (
      <div className="p-4">
        <BidPanel
          auction={biddingAuction}
          userCards={userCards}
          onClose={() => setBiddingAuction(null)}
          placeBid={placeBid}
        />
      </div>
    );
  }

  if (viewingBids) {
    return (
      <div className="p-4">
        <ViewBidsPanel
          auction={viewingBids}
          myId={myId}
          onClose={() => setViewingBids(null)}
          acceptBid={acceptBid}
          onBidClick={(a) => {
            setViewingBids(null);
            setBiddingAuction(a);
          }}
        />
      </div>
    );
  }

  const isFiltering =
    searchQuery.trim().length > 0 ||
    categoryFilter !== 'all' ||
    cardRarityFilter !== 'all' ||
    potionSubFilter !== 'all' ||
    boosterSubFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setCardRarityFilter('all');
    setPotionSubFilter('all');
    setBoosterSubFilter('all');
  };

  return (
    <div className="flex flex-col h-full bg-[#0b0c16]">
      {/* ── TOP ACTION BAR: Search, circled 'i' (Mes offres), and '+' (Créer) ── */}
      <div className="px-4 py-2.5 border-b border-zinc-800/80 bg-[#0e0f1d] space-y-2">
        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="flex-1 relative flex items-center">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher carte, potion, booster, joueur..."
              className="w-full bg-[#141525] border border-zinc-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-zinc-500 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 'i' circled button for viewing "Mes offres" */}
          <button
            type="button"
            onClick={() => {
              setSubTab(prev => prev === 'my' ? 'auctions' : 'my');
              play('navClick');
            }}
            title="Mes annonces (i)"
            className={cn(
              "relative w-8 h-8 rounded-full flex items-center justify-center transition-all border flex-shrink-0 text-xs font-serif italic font-bold",
              subTab === 'my'
                ? "bg-purple-600 border-purple-400 text-white shadow-sm"
                : "bg-[#141525] border-zinc-700/80 text-zinc-300 hover:text-white hover:border-zinc-600"
            )}
          >
            i
            {totalMy > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-amber-400 text-black text-[8px] font-black flex items-center justify-center">
                {totalMy}
              </span>
            )}
          </button>

          {/* '+' button to create an offer/auction */}
          <button
            type="button"
            onClick={() => { setView('create'); play('navClick'); }}
            title="Créer une annonce (+)"
            className="h-8 px-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs flex items-center gap-1 active:scale-95 transition-all flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span className="text-[11px]">Créer</span>
          </button>
        </div>

        {/* ── Subtabs (Enchères / Échanges) + Category & Subcategory Row ── */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            {/* Tabs */}
            <div className="flex gap-1 p-0.5 bg-black/40 rounded-lg border border-zinc-800">
              <button
                onClick={() => { setSubTab('auctions'); play('navClick'); }}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all",
                  subTab === 'auctions'
                    ? "bg-zinc-800 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                <Gavel className="w-3 h-3" />
                Enchères
                {openAuctions.length > 0 && (
                  <span className="px-1 py-0.2 rounded-full bg-white/20 text-[8px] font-bold">
                    {openAuctions.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => { setSubTab('directs'); play('navClick'); }}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all",
                  subTab === 'directs'
                    ? "bg-zinc-800 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                <ArrowLeftRight className="w-3 h-3" />
                Échanges
                {openDirectTrades.length > 0 && (
                  <span className="px-1 py-0.2 rounded-full bg-white/20 text-[8px] font-bold">
                    {openDirectTrades.length}
                  </span>
                )}
              </button>
            </div>

            {/* Main Category Pills */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
              {(['all', 'card', 'potion', 'booster'] as const).map(cat => (
                <button
                  key={cat}
                  onClick={() => {
                    setCategoryFilter(cat);
                    setCardRarityFilter('all');
                    setPotionSubFilter('all');
                    setBoosterSubFilter('all');
                  }}
                  className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-semibold transition-all border",
                    categoryFilter === cat
                      ? "bg-amber-400/20 text-amber-300 border-amber-400/40"
                      : "bg-white/5 text-zinc-400 border-transparent hover:text-white"
                  )}
                >
                  {cat === 'all' && 'Tous'}
                  {cat === 'card' && 'Cartes'}
                  {cat === 'potion' && 'Potions'}
                  {cat === 'booster' && 'Boosters'}
                </button>
              ))}

              {/* Sort Pill */}
              {subTab === 'auctions' && (
                <button
                  onClick={() => setSortBy(prev => prev === 'endingSoon' ? 'newest' : 'endingSoon')}
                  title="Ordre de tri"
                  className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-semibold transition-all border flex items-center gap-1",
                    sortBy === 'endingSoon'
                      ? "bg-zinc-800 text-amber-300 border-zinc-700"
                      : "bg-white/5 text-zinc-400 border-transparent"
                  )}
                >
                  <Timer className="w-2.5 h-2.5" />
                  {sortBy === 'endingSoon' ? 'Fin proche' : 'Récents'}
                </button>
              )}
            </div>
          </div>

          {/* ── Subcategory Secondary Row (contextual) ── */}
          {categoryFilter === 'card' && (
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pt-0.5 pl-0.5">
              <span className="text-[9px] text-zinc-500 font-medium mr-1">Rareté :</span>
              {[
                { key: 'all', label: 'Toutes' },
                { key: 'common', label: 'Communes' },
                { key: 'rare', label: 'Rares' },
                { key: 'epic', label: 'Épiques' },
                { key: 'legendary', label: 'Légendaires' },
              ].map(r => (
                <button
                  key={r.key}
                  onClick={() => setCardRarityFilter(r.key as any)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[8px] font-semibold transition-all border",
                    cardRarityFilter === r.key
                      ? "bg-purple-500/20 text-purple-300 border-purple-500/50"
                      : "bg-zinc-900/60 text-zinc-500 border-zinc-800 hover:text-zinc-300"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}

          {categoryFilter === 'potion' && (
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pt-0.5 pl-0.5">
              <span className="text-[9px] text-zinc-500 font-medium mr-1">Effet :</span>
              {[
                { key: 'all', label: 'Toutes' },
                { key: 'luck', label: 'Chance' },
                { key: 'pack', label: 'Boost Pack' },
              ].map(p => (
                <button
                  key={p.key}
                  onClick={() => setPotionSubFilter(p.key as any)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[8px] font-semibold transition-all border",
                    potionSubFilter === p.key
                      ? "bg-purple-500/20 text-purple-300 border-purple-500/50"
                      : "bg-zinc-900/60 text-zinc-500 border-zinc-800 hover:text-zinc-300"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {categoryFilter === 'booster' && (
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pt-0.5 pl-0.5">
              <span className="text-[9px] text-zinc-500 font-medium mr-1">Type :</span>
              {[
                { key: 'all', label: 'Tous' },
                { key: 'standard', label: 'Standard' },
                { key: 'lucky', label: 'Chanceux (x2)' },
                { key: 'ultra', label: 'Ultra (x5)' },
              ].map(b => (
                <button
                  key={b.key}
                  onClick={() => setBoosterSubFilter(b.key as any)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[8px] font-semibold transition-all border",
                    boosterSubFilter === b.key
                      ? "bg-orange-500/20 text-orange-300 border-orange-500/50"
                      : "bg-zinc-900/60 text-zinc-500 border-zinc-800 hover:text-zinc-300"
                  )}
                >
                  {b.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── CONTENT AREA ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 scrollbar-thin">
        {/* ── 1. AUCTIONS TAB ── */}
        {subTab === 'auctions' && (
          <>
            {filteredAuctions.length === 0 && endedAuctions.length === 0 ? (
              <div className="text-center py-12 px-4 space-y-2">
                <Gavel className="w-8 h-8 text-zinc-600 mx-auto stroke-[1.5]" />
                <p className="text-xs font-semibold text-zinc-300">
                  {isFiltering ? 'Aucune enchère ne correspond à vos filtres' : 'Aucune enchère active'}
                </p>
                <p className="text-[11px] text-zinc-500 max-w-[240px] mx-auto">
                  {isFiltering
                    ? 'Essayez de modifier votre recherche ou vos catégories.'
                    : 'Soyez le premier à publier une enchère avec le bouton + !'}
                </p>
                {isFiltering ? (
                  <button
                    onClick={resetFilters}
                    className="mt-2 text-xs text-amber-400 hover:text-amber-300 font-medium underline"
                  >
                    Effacer les filtres
                  </button>
                ) : (
                  <button
                    onClick={() => setView('create')}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 text-black text-xs font-bold hover:bg-amber-300 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Créer une enchère
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Active auctions */}
                {filteredAuctions.map(auction => {
                  const diff = new Date(auction.endsAt).getTime() - Date.now();
                  const isEndingSoon = diff > 0 && diff <= 15 * 60 * 1000;

                  return (
                    <div
                      key={auction.id}
                      className="rounded-xl border border-zinc-800/90 bg-[#11121e] p-3 space-y-2 transition-all hover:border-zinc-700"
                    >
                      <div className="flex items-start gap-3">
                        <MarketplaceItemCard item={auction.item} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate">{auction.item.name}</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            par <span className="text-zinc-200 font-semibold">{auction.creatorName}</span>
                          </p>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <CountdownTimer endsAt={auction.endsAt} />
                            <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                              <Users className="w-3 h-3" />
                              {auction.bids.length} offre{auction.bids.length !== 1 ? 's' : ''}
                            </span>
                            {isEndingSoon && (
                              <span className="text-[8px] font-bold text-amber-400 px-1 py-0.2 rounded bg-amber-400/10 border border-amber-400/20">
                                Fin proche
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Preview existing offers on the card if any */}
                      {auction.bids.length > 0 && (
                        <div className="p-2 rounded-xl bg-black/40 border border-zinc-800/80 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-zinc-400 flex items-center gap-1 font-medium">
                              <Users className="w-3 h-3 text-amber-400" />
                              {auction.bids.length === 1 ? '1 offre reçue :' : `${auction.bids.length} offres reçues :`}
                            </span>
                            <span className="text-amber-300/90 text-[9px] font-medium truncate max-w-[140px]">
                              Dernière par {auction.bids[auction.bids.length - 1].bidderName}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 overflow-x-auto py-0.5 scrollbar-none">
                            {auction.bids[auction.bids.length - 1].offeredItems.map((item, idx) => (
                              <MarketplaceItemCard key={idx} item={item} size="sm" />
                            ))}
                            {auction.bids.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setViewingBids(auction); }}
                                className="h-16 px-2 rounded-xl border border-dashed border-zinc-700 hover:border-amber-400/50 bg-zinc-900/50 text-[10px] text-zinc-400 hover:text-amber-300 flex flex-col items-center justify-center flex-shrink-0 transition-colors"
                              >
                                <span className="font-bold">+{auction.bids.length - 1}</span>
                                <span className="text-[8px]">autre(s)</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      {auction.creatorId !== myId ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setViewingBids(auction)}
                            className="flex-1 py-1.5 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                          >
                            <Eye className="w-3.5 h-3.5 text-amber-400" />
                            Voir offres ({auction.bids.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setBiddingAuction(auction)}
                            className="flex-1 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.98]"
                          >
                            <Gavel className="w-3.5 h-3.5" />
                            Faire une offre
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setViewingBids(auction)}
                          className="w-full py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                        >
                          <Eye className="w-3.5 h-3.5 text-amber-400" />
                          Gérer mes offres reçues ({auction.bids.length})
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Ended auctions awaiting creator decision */}
                {endedAuctions.filter(a => a.creatorId === myId && !a.acceptedBidId).map(auction => (
                  <div
                    key={auction.id}
                    className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 space-y-2"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400">
                      <Trophy className="w-3.5 h-3.5" />
                      Enchère terminée — Choisissez une offre
                    </div>
                    <div className="flex items-start gap-3">
                      <MarketplaceItemCard item={auction.item} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{auction.item.name}</p>
                        <p className="text-[10px] text-zinc-400">{auction.bids.length} offre(s) reçue(s)</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setViewingBids(auction)}
                      className="w-full py-1.5 rounded-lg bg-amber-400 text-black text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Choisir une offre ({auction.bids.length})
                    </button>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* ── 2. DIRECTS TAB ── */}
        {subTab === 'directs' && (
          <>
            {filteredDirectTrades.length === 0 ? (
              <div className="text-center py-12 px-4 space-y-2">
                <ArrowLeftRight className="w-8 h-8 text-zinc-600 mx-auto stroke-[1.5]" />
                <p className="text-xs font-semibold text-zinc-300">
                  {isFiltering ? 'Aucun échange ne correspond à vos filtres' : 'Aucun échange direct disponible'}
                </p>
                <p className="text-[11px] text-zinc-500 max-w-[240px] mx-auto">
                  {isFiltering
                    ? 'Modifiez votre recherche ou vos catégories.'
                    : 'Cliquez sur + pour proposer un échange direct !'}
                </p>
                {isFiltering ? (
                  <button
                    onClick={resetFilters}
                    className="mt-2 text-xs text-amber-400 hover:text-amber-300 font-medium underline"
                  >
                    Effacer les filtres
                  </button>
                ) : (
                  <button
                    onClick={() => setView('create')}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 text-black text-xs font-bold hover:bg-amber-300 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Proposer un échange
                  </button>
                )}
              </div>
            ) : (
              filteredDirectTrades.map(trade => (
                <div
                  key={trade.id}
                  className="rounded-xl border border-zinc-800/90 bg-[#11121e] p-3 space-y-2.5"
                >
                  <p className="text-[10px] text-zinc-400">
                    par <span className="text-zinc-200 font-semibold">{trade.creatorName}</span>
                  </p>

                  <div className="flex items-center gap-2">
                    <MarketplaceItemCard item={trade.offeredItem} size="md" />
                    <div className="flex flex-col items-center gap-0.5 px-2">
                      <ArrowLeftRight className="w-3.5 h-3.5 text-zinc-400" />
                      <span className="text-[8px] text-zinc-500 font-bold uppercase">Contre</span>
                    </div>
                    <MarketplaceItemCard item={trade.wantedItem} size="md" />
                  </div>

                  {trade.creatorId !== myId ? (
                    <button
                      onClick={() => acceptDirectTrade(trade.id)}
                      className="w-full py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Check className="w-3 h-3" />
                      Accepter l'échange
                    </button>
                  ) : (
                    <button
                      onClick={() => cancelDirectTrade(trade.id)}
                      className="w-full py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <XCircle className="w-3 h-3" />
                      Retirer mon offre
                    </button>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {/* ── 3. MY OFFERS TAB (Accessed via circled 'i') ── */}
        {subTab === 'my' && (
          <>
            <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full border border-zinc-700 bg-zinc-900 flex items-center justify-center text-[10px] font-serif italic font-bold text-zinc-300">
                  i
                </span>
                <h3 className="text-xs font-bold text-white">Mes annonces ({totalMy})</h3>
              </div>
              <button
                onClick={() => setSubTab('auctions')}
                className="text-[10px] text-zinc-400 hover:text-white underline"
              >
                Retour
              </button>
            </div>

            {totalMy === 0 ? (
              <div className="text-center py-10 px-4 space-y-2">
                <Shield className="w-8 h-8 text-zinc-600 mx-auto stroke-[1.5]" />
                <p className="text-xs font-semibold text-zinc-300">Vous n'avez aucune annonce active</p>
                <p className="text-[10px] text-zinc-500">
                  Utilisez le bouton + pour publier une enchère ou un échange.
                </p>
              </div>
            ) : (
              <>
                {/* My active auctions */}
                {myActiveAuctions.map(auction => (
                  <div key={auction.id} className="rounded-xl border border-zinc-800 bg-[#11121e] p-3 space-y-2">
                    <div className="flex items-center gap-1 text-[9px] font-bold text-amber-400 uppercase tracking-wider">
                      <Gavel className="w-3 h-3" /> Enchère en cours
                    </div>
                    <div className="flex items-start gap-3">
                      <MarketplaceItemCard item={auction.item} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{auction.item.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <CountdownTimer endsAt={auction.endsAt} compact />
                          <span className="text-[10px] text-zinc-400">{auction.bids.length} offre(s) reçue(s)</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setViewingBids(auction)}
                        className="flex-1 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1"
                      >
                        <Eye className="w-3 h-3" /> Offres ({auction.bids.length})
                      </button>
                      <button
                        onClick={() => cancelAuction(auction.id)}
                        className="py-1.5 px-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-bold text-red-400 hover:bg-red-500/20"
                        title="Annuler l'enchère"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* My ended auctions needing decision */}
                {myEndedAuctions.filter(a => !a.acceptedBidId).map(auction => (
                  <div key={auction.id} className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
                    <div className="flex items-center gap-1 text-[9px] font-bold text-amber-400 uppercase tracking-wider">
                      <Trophy className="w-3 h-3" /> Enchère terminée — À choisir
                    </div>
                    <div className="flex items-start gap-3">
                      <MarketplaceItemCard item={auction.item} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{auction.item.name}</p>
                        <p className="text-[10px] text-zinc-400">{auction.bids.length} offre(s) reçue(s)</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setViewingBids(auction)}
                      className="w-full py-1.5 rounded-lg bg-amber-400 text-black text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3 h-3" /> Choisir une offre ({auction.bids.length})
                    </button>
                  </div>
                ))}

                {/* My direct trades */}
                {myDirectTrades.map(trade => (
                  <div key={trade.id} className="rounded-xl border border-zinc-800 bg-[#11121e] p-3 space-y-2">
                    <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                      <ArrowLeftRight className="w-3 h-3" /> Échange direct
                    </div>
                    <div className="flex items-center gap-2">
                      <MarketplaceItemCard item={trade.offeredItem} size="sm" />
                      <ArrowLeftRight className="w-3 h-3 text-zinc-600" />
                      <MarketplaceItemCard item={trade.wantedItem} size="sm" />
                    </div>
                    <button
                      onClick={() => cancelDirectTrade(trade.id)}
                      className="w-full py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 flex items-center justify-center gap-1"
                    >
                      <XCircle className="w-3 h-3" /> Retirer mon offre
                    </button>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

