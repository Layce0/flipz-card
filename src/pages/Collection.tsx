import { useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { CollectionCard } from '@/components/CollectionCard';
import { RarityTabs } from '@/components/RarityTabs';
import { GameCard, Rarity } from '@/types/card';
import { BookOpen } from 'lucide-react';

// Données d'exemple (sera remplacé par la DB)
const MOCK_COLLECTION: GameCard[] = [
  {
    id: '1',
    title: 'Dragon Ancestral',
    description: 'Une créature légendaire gardienne des secrets anciens.',
    image_url: 'https://images.unsplash.com/photo-1577493340887-b7bfff550145?w=400&h=500&fit=crop',
    rarity: 'legendary',
    release_date: '2024-01-01',
    created_at: '2024-01-01',
  },
  {
    id: '2',
    title: 'Phénix Céleste',
    description: 'Né des flammes éternelles, il renaît de ses cendres.',
    image_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=500&fit=crop',
    rarity: 'epic',
    release_date: '2024-01-02',
    created_at: '2024-01-02',
  },
  {
    id: '3',
    title: 'Loup des Neiges',
    description: 'Chasseur silencieux des terres gelées du nord.',
    image_url: 'https://images.unsplash.com/photo-1516934024742-b461fba47600?w=400&h=500&fit=crop',
    rarity: 'rare',
    release_date: '2024-01-03',
    created_at: '2024-01-03',
  },
  {
    id: '4',
    title: 'Hibou Sage',
    description: 'Gardien de la forêt enchantée.',
    image_url: 'https://images.unsplash.com/photo-1543549790-8b5f4a028cfb?w=400&h=500&fit=crop',
    rarity: 'common',
    release_date: '2024-01-04',
    created_at: '2024-01-04',
  },
  {
    id: '5',
    title: 'Serpent Mystique',
    description: 'Ses écailles reflètent les étoiles.',
    image_url: 'https://images.unsplash.com/photo-1531386151447-fd76ad50012f?w=400&h=500&fit=crop',
    rarity: 'rare',
    release_date: '2024-01-05',
    created_at: '2024-01-05',
  },
  {
    id: '6',
    title: 'Renard Esprit',
    description: 'Un esprit bienveillant qui guide les voyageurs.',
    image_url: 'https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=400&h=500&fit=crop',
    rarity: 'common',
    release_date: '2024-01-06',
    created_at: '2024-01-06',
  },
];

const Collection = () => {
  const [activeRarity, setActiveRarity] = useState<Rarity | 'all'>('all');

  const filteredCards = activeRarity === 'all' 
    ? MOCK_COLLECTION 
    : MOCK_COLLECTION.filter(card => card.rarity === activeRarity);

  const counts = {
    all: MOCK_COLLECTION.length,
    common: MOCK_COLLECTION.filter(c => c.rarity === 'common').length,
    rare: MOCK_COLLECTION.filter(c => c.rarity === 'rare').length,
    epic: MOCK_COLLECTION.filter(c => c.rarity === 'epic').length,
    legendary: MOCK_COLLECTION.filter(c => c.rarity === 'legendary').length,
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="pt-12 pb-6 px-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-xl text-foreground">Ma Collection</h1>
            <p className="text-sm text-muted-foreground">{MOCK_COLLECTION.length} cartes collectées</p>
          </div>
        </div>

        {/* Rarity filter */}
        <RarityTabs 
          activeRarity={activeRarity} 
          onRarityChange={setActiveRarity}
          counts={counts}
        />
      </header>

      {/* Cards grid */}
      <main className="px-4">
        {filteredCards.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {filteredCards.map((card) => (
              <CollectionCard key={card.id} card={card} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Aucune carte de cette rareté</p>
          </div>
        )}
      </main>

      <Navigation />
    </div>
  );
};

export default Collection;
