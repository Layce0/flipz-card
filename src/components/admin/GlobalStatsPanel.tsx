import { Users, Layers, Sparkles, BookOpen, Loader2 } from 'lucide-react';
import { useGlobalStats } from '@/hooks/useGlobalStats';

export const GlobalStatsPanel = () => {
  const { data, isLoading, error } = useGlobalStats();

  const items = [
    { label: 'Joueurs Totaux', value: data?.total_players, icon: Users },
    { label: 'Cartes en Circulation', value: data?.total_cards_in_circulation, icon: Layers },
    { label: 'Cartes Uniques Possédées', value: data?.total_unique_owned_cards, icon: Sparkles },
    { label: 'Cartes du Jeu', value: data?.total_cards_in_game, icon: BookOpen },
  ];

  return (
    <section>
      <h2 className="font-display text-lg mb-4 text-foreground">Statistiques globales</h2>
      {error ? (
        <p className="text-sm text-destructive">Impossible de charger les statistiques.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {items.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="w-4 h-4" />
                <span className="text-xs">{label}</span>
              </div>
              <div className="font-display text-2xl text-foreground">
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  (value ?? 0).toLocaleString('fr-FR')
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
