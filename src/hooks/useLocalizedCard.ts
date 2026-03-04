import { useTranslation } from 'react-i18next';
import { GameCard } from '@/types/card';

export const useLocalizedCard = () => {
  const { i18n } = useTranslation();
  const lang = i18n.language?.substring(0, 2) || 'fr';

  const getTitle = (card: GameCard): string => {
    if (lang === 'en' && card.title_en) return card.title_en;
    if (lang === 'es' && card.title_es) return card.title_es;
    return card.title;
  };

  const getDescription = (card: GameCard): string => {
    if (lang === 'en' && card.description_en) return card.description_en;
    if (lang === 'es' && card.description_es) return card.description_es;
    return card.description;
  };

  return { getTitle, getDescription, lang };
};
