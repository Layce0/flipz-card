import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HelpCircle, Loader2 } from 'lucide-react';
import { usePackProbabilities } from '@/hooks/usePackProbabilities';

export const PackProbabilitiesDialog = () => {
  const { t } = useTranslation();
  const { data: probabilities, isLoading } = usePackProbabilities();
  const [open, setOpen] = useState(false);

  // We only show paid packs probabilities
  const paidPacks = probabilities?.filter(p => p.pack_type.startsWith('paid_') && p.luck_multiplier === 1) || [];

  const getPackName = (type: string) => {
    if (type.includes('ultra')) return t('shop.ultraPacks', 'Packs Ultra');
    if (type.includes('lucky')) return t('shop.luckyPacks', 'Packs Chanceux');
    return t('shop.standardPacks', 'Packs Standard');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full opacity-60 hover:opacity-100 transition-opacity bg-background/50">
          <HelpCircle className="w-4 h-4" />
          <span className="sr-only">Probabilités de tirage</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Probabilités par paquet</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Conformément aux directives de l'App Store, voici les chances exactes d'obtenir chaque rareté de carte par type de pack.
          </p>
          
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {paidPacks.map((pack) => (
                <div key={pack.id} className="p-3 rounded-lg bg-card border border-border">
                  <h4 className="font-semibold mb-2 text-primary">{getPackName(pack.pack_type)}</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div className="flex flex-col items-center p-2 rounded bg-background">
                      <span className="text-gray-400 font-medium">{t('rarity.common', 'Commune')}</span>
                      <span>{pack.common_rate}%</span>
                    </div>
                    <div className="flex flex-col items-center p-2 rounded bg-background">
                      <span className="text-blue-400 font-medium">{t('rarity.rare', 'Rare')}</span>
                      <span>{pack.rare_rate}%</span>
                    </div>
                    <div className="flex flex-col items-center p-2 rounded bg-background">
                      <span className="text-purple-400 font-medium">{t('rarity.epic', 'Épique')}</span>
                      <span>{pack.epic_rate}%</span>
                    </div>
                    <div className="flex flex-col items-center p-2 rounded bg-background">
                      <span className="text-yellow-400 font-medium">{t('rarity.legendary', 'Légendaire')}</span>
                      <span>{pack.legendary_rate}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
