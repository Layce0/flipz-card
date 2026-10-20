import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Zap } from 'lucide-react';
import { PotionBottle } from './PotionIcons';
import inventoryBagImg from '@/assets/inventory-bag.png';

interface ReceivePotionDialogProps {
  open: boolean;
  type: 'boost_luck' | 'boost_pack';
  name: string;
  description: string;
  config: Record<string, any>;
  onUseNow: () => void;
  onSendToInventory: () => void;
}

export const ReceivePotionDialog: React.FC<ReceivePotionDialogProps> = ({
  open,
  type,
  name,
  description,
  config,
  onUseNow,
  onSendToInventory,
}) => {
  const isLuck = type === 'boost_luck';

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className={`max-w-[340px] sm:max-w-sm p-6 overflow-hidden rounded-3xl border-2 ${
          isLuck ? 'border-amber-500/50 shadow-[0_0_60px_rgba(245,158,11,0.35)]' : 'border-purple-500/50 shadow-[0_0_60px_rgba(168,85,247,0.35)]'
        } bg-[#0c0915]/95 backdrop-blur-2xl`}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Glow backdrop */}
        <div 
          className={`absolute -top-12 -left-12 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
            isLuck ? 'bg-amber-500/25' : 'bg-purple-600/25'
          }`} 
        />
        <div 
          className={`absolute -bottom-12 -right-12 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
            isLuck ? 'bg-yellow-500/25' : 'bg-indigo-600/25'
          }`} 
        />

        <div className="relative z-10 flex flex-col items-center text-center">
          {/* Sparkles top badge */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 mb-2 rounded-full bg-white/10 text-white text-xs font-semibold backdrop-blur-md border border-white/20">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
            <span>Nouvelle Potion !</span>
          </div>

          {/* Floating Potion */}
          <div className="relative my-3 flex items-center justify-center">
            <div 
              className={`absolute inset-0 rounded-full blur-2xl transform scale-125 ${
                isLuck ? 'bg-amber-400/30' : 'bg-purple-500/30'
              }`} 
            />
            <div className="animate-bounce" style={{ animationDuration: '3s' }}>
              <PotionBottle type={type} config={config} size={84} />
            </div>
          </div>

          {/* Title & Description */}
          <h2 className="text-xl font-extrabold text-white mt-1 mb-1 tracking-wide">
            {name}
          </h2>
          <p className="text-xs text-muted-foreground max-w-[260px] mb-6 leading-relaxed">
            {description}
          </p>

          {/* Buttons */}
          <div className="w-full space-y-3">
            {/* Button 1: Utiliser maintenant */}
            <Button
              onClick={onUseNow}
              className={`w-full h-12 rounded-2xl text-white font-bold text-base shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 ${
                isLuck
                  ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black shadow-[0_0_25px_rgba(245,158,11,0.5)] border border-yellow-300/40'
                  : 'bg-gradient-to-r from-indigo-500 via-purple-600 to-fuchsia-600 hover:from-indigo-400 hover:to-fuchsia-500 shadow-[0_0_25px_rgba(168,85,247,0.45)] border border-purple-300/30'
              }`}
            >
              <Zap className="w-5 h-5" />
              <span>Utiliser maintenant</span>
            </Button>

            {/* Button 2: Mettre dans l'inventaire */}
            <Button
              onClick={onSendToInventory}
              variant="outline"
              className="w-full h-12 rounded-2xl border-2 border-white/20 bg-white/5 hover:bg-white/10 text-white font-semibold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2.5"
            >
              <img src={inventoryBagImg} alt="Sac" className="w-5 h-5 object-contain" />
              <span>Mettre dans l'inventaire</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
