import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PackConfig, formatPrice } from '@/types/pack';
import { cn } from '@/lib/utils';
import { Loader2, Sparkles, Zap, Crown } from 'lucide-react';
import packStandard5Img from '@/assets/pack-standard-5.png';
import packStandard10Img from '@/assets/pack-standard-10.png';
import packStandard20Img from '@/assets/pack-standard-20.png';
import packStandard50Img from '@/assets/pack-standard-50.png';
import packLucky5Img from '@/assets/pack-lucky-5.png';
import packLucky10Img from '@/assets/pack-lucky-10.png';
import packLucky20Img from '@/assets/pack-lucky-20.png';
import packLucky50Img from '@/assets/pack-lucky-50.png';
import packUltra5Img from '@/assets/pack-ultra-5.png';

interface PackCardProps {
  pack: PackConfig;
  onPurchase: (packId: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export const PackCard = ({ pack, onPurchase, isLoading, disabled }: PackCardProps) => {
  const { t } = useTranslation();
  
  const getPackStyles = () => {
    switch (pack.type) {
      case 'lucky':
        return {
          container: 'bg-gradient-to-br from-[hsl(280,50%,18%)] via-[hsl(260,40%,12%)] to-[hsl(280,45%,15%)]',
          border: 'border-2 border-primary/40 hover:border-primary/70',
          glow: 'hover:shadow-[0_0_25px_rgba(234,179,8,0.25)]',
          iconGlow: 'drop-shadow-[0_0_12px_rgba(234,179,8,0.6)]',
          icon: Sparkles,
          badgeStyle: 'bg-primary/90 text-primary-foreground',
        };
      case 'ultra':
        return {
          container: 'bg-gradient-to-br from-[hsl(45,80%,25%)] via-[hsl(280,50%,20%)] to-[hsl(45,70%,20%)]',
          border: 'border-[3px] border-primary/70 hover:border-primary',
          glow: 'hover:shadow-[0_0_40px_rgba(234,179,8,0.5)]',
          iconGlow: 'drop-shadow-[0_0_20px_rgba(234,179,8,0.9)] animate-pulse',
          icon: Crown,
          badgeStyle: 'bg-gradient-to-r from-primary to-yellow-300 text-primary-foreground font-bold',
        };
      default:
        return {
          container: 'bg-gradient-to-br from-[hsl(280,40%,12%)] via-[hsl(260,30%,8%)] to-[hsl(240,30%,10%)]',
          border: 'border border-muted/30 hover:border-muted/50',
          glow: 'hover:shadow-[0_0_15px_rgba(168,85,247,0.15)]',
          iconGlow: 'drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]',
          icon: Zap,
          badgeStyle: 'bg-muted text-muted-foreground',
        };
    }
  };

  const getPackName = () => {
    switch (pack.type) {
      case 'lucky':
        return t('packs.lucky');
      case 'ultra':
        return t('packs.ultra');
      default:
        return t('packs.standard');
    }
  };

  const styles = getPackStyles();
  const Icon = styles.icon;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl transition-all duration-300 cursor-pointer group aspect-[3/4]",
        styles.container,
        styles.border,
        styles.glow,
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onClick={() => !disabled && !isLoading && onPurchase(pack.id)}
    >
      {/* Decorative pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_20%,rgba(0,0,0,0.3)_70%)]" />
        <div className="absolute top-4 left-4 w-8 h-8 border border-primary/20 rounded-full" />
        <div className="absolute top-4 right-4 w-8 h-8 border border-primary/20 rounded-full" />
        <div className="absolute bottom-4 left-4 w-8 h-8 border border-primary/20 rounded-full" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border border-primary/20 rounded-full" />
      </div>

      {/* Central icon / image */}
      <div className="absolute inset-0 flex items-start justify-center -mt-8">
        {pack.id === 'standard_5' ? (
          <img src={packStandard5Img} alt="Pack Standard 5" className="w-80 h-auto object-contain drop-shadow-[0_0_12px_rgba(168,85,247,0.4)]" draggable={false} />
        ) : pack.id === 'standard_10' ? (
          <img src={packStandard10Img} alt="Pack Standard 10" className="w-80 h-auto object-contain drop-shadow-[0_0_12px_rgba(168,85,247,0.4)]" draggable={false} />
        ) : pack.id === 'standard_20' ? (
          <img src={packStandard20Img} alt="Pack Standard 20" className="w-80 h-auto object-contain drop-shadow-[0_0_12px_rgba(168,85,247,0.4)]" draggable={false} />
        ) : pack.id === 'standard_50' ? (
          <img src={packStandard50Img} alt="Pack Standard 50" className="w-80 h-auto object-contain drop-shadow-[0_0_12px_rgba(168,85,247,0.4)]" draggable={false} />
        ) : pack.id === 'lucky_5' ? (
          <img src={packLucky5Img} alt="Pack Lucky 5" className="w-80 h-auto object-contain drop-shadow-[0_0_12px_rgba(234,179,8,0.4)]" draggable={false} />
        ) : pack.id === 'lucky_10' ? (
          <img src={packLucky10Img} alt="Pack Lucky 10" className="w-80 h-auto object-contain drop-shadow-[0_0_12px_rgba(234,179,8,0.4)]" draggable={false} />
        ) : pack.id === 'lucky_20' ? (
          <img src={packLucky20Img} alt="Pack Lucky 20" className="w-80 h-auto object-contain drop-shadow-[0_0_12px_rgba(234,179,8,0.4)]" draggable={false} />
        ) : pack.id === 'lucky_50' ? (
          <img src={packLucky50Img} alt="Pack Lucky 50" className="w-80 h-auto object-contain drop-shadow-[0_0_12px_rgba(234,179,8,0.4)]" draggable={false} />
        ) : pack.id === 'ultra_5' ? (
          <img src={packUltra5Img} alt="Pack Ultra 5" className="w-80 h-auto object-contain drop-shadow-[0_0_12px_rgba(234,179,8,0.6)]" draggable={false} />
        ) : (
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center",
            pack.type === 'ultra' && "bg-gradient-to-br from-primary/30 to-transparent"
          )}>
            <Icon className={cn("w-10 h-10 text-primary", styles.iconGlow)} />
          </div>
        )}
      </div>

      {/* Multiplier Badge */}
      {pack.multiplier > 1 && (
        <div className="absolute top-3 right-3 z-10">
          <Badge className={cn("text-xs font-bold", styles.badgeStyle)}>
            x{pack.multiplier}
          </Badge>
        </div>
      )}

      {/* Bottom content */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black via-black/90 to-transparent">
        <div className="text-center mb-2">
          <h3 className="font-display text-sm truncate bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent">{getPackName()}</h3>
          <p className="text-xs bg-gradient-to-r from-yellow-200/80 to-amber-300/80 bg-clip-text text-transparent">{pack.cardCount} {t('common.cards')}</p>
        </div>
        
        <Button
          variant={pack.type === 'ultra' ? 'gold' : pack.type === 'lucky' ? 'mystical' : 'secondary'}
          size="sm"
          className="w-full text-xs"
          disabled={isLoading || disabled}
        >
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            formatPrice(pack.price)
          )}
        </Button>
      </div>

      {/* Shine effect for ultra packs */}
      {pack.type === 'ultra' && (
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      )}
    </div>
  );
};
