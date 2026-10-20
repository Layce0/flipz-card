import { memo } from 'react';
import { PackCard } from './PackCard';
import { PackConfig } from '@/types/pack';

interface PackSectionProps {
  title: string;
  description: string;
  packs: PackConfig[];
  onPurchase: (packId: string) => void;
  isLoading: boolean;
  loadingPackId: string | null;
  localPrices?: Record<string, string>;
}

export const PackSection = memo(({
  title,
  description,
  packs,
  onPurchase,
  isLoading,
  loadingPackId,
  localPrices = {},
}: PackSectionProps) => {
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
        {packs.map((pack) => (
          <PackCard
            key={pack.id}
            pack={pack}
            onPurchase={onPurchase}
            isLoading={isLoading && loadingPackId === pack.id}
            disabled={isLoading && loadingPackId !== pack.id}
            localPrice={localPrices[pack.id]}
          />
        ))}
      </div>
    </section>
  );
});

PackSection.displayName = 'PackSection';
