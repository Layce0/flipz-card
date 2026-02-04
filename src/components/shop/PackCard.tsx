import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PackConfig, formatPrice } from '@/types/pack';
import { cn } from '@/lib/utils';
import { Loader2, Sparkles, Zap, Crown } from 'lucide-react';

interface PackCardProps {
  pack: PackConfig;
  onPurchase: (packId: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export const PackCard = ({ pack, onPurchase, isLoading, disabled }: PackCardProps) => {
  const getPackStyles = () => {
    switch (pack.type) {
      case 'lucky':
        return {
          border: 'border-blue-500/50 hover:border-blue-400',
          glow: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]',
          badge: 'bg-blue-500 text-white',
          icon: Sparkles,
          iconColor: 'text-blue-400',
        };
      case 'ultra':
        return {
          border: 'border-purple-500/50 hover:border-purple-400',
          glow: 'hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]',
          badge: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
          icon: Crown,
          iconColor: 'text-purple-400',
        };
      default:
        return {
          border: 'border-border hover:border-primary/50',
          glow: 'hover:shadow-lg',
          badge: 'bg-muted text-muted-foreground',
          icon: Zap,
          iconColor: 'text-primary',
        };
    }
  };

  const styles = getPackStyles();
  const Icon = styles.icon;

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-300 cursor-pointer group",
        styles.border,
        styles.glow,
        disabled && "opacity-50 cursor-not-allowed"
      )}
      onClick={() => !disabled && !isLoading && onPurchase(pack.id)}
    >
      {/* Multiplier Badge */}
      {pack.multiplier > 1 && (
        <div className="absolute top-2 right-2 z-10">
          <Badge className={cn("text-xs font-bold animate-pulse", styles.badge)}>
            x{pack.multiplier}
          </Badge>
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-5 h-5", styles.iconColor)} />
          <CardTitle className="text-base">{pack.name}</CardTitle>
        </div>
        <CardDescription className="text-xs">{pack.description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-primary">{pack.cardCount}</span>
          <span className="text-sm text-muted-foreground">cartes</span>
        </div>

        <Button
          variant={pack.type === 'ultra' ? 'gold' : pack.type === 'lucky' ? 'mystical' : 'default'}
          className="w-full"
          disabled={isLoading || disabled}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            formatPrice(pack.price)
          )}
        </Button>
      </CardContent>

      {/* Decorative glow effect for ultra packs */}
      {pack.type === 'ultra' && (
        <div className="absolute inset-0 bg-gradient-to-t from-accent/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      )}
    </Card>
  );
};
