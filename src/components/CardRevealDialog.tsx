 import { useState } from 'react';
 import { Dialog, DialogContent } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { MysteryCard } from '@/components/MysteryCard';
 import { ChevronRight, X } from 'lucide-react';
 import { GameCard } from '@/types/card';
 import { cn } from '@/lib/utils';
 import { useAuth } from '@/contexts/AuthContext';
 import { useCollectCard } from '@/hooks/useCards';
 
 interface CardRevealDialogProps {
   cards: GameCard[];
   open: boolean;
   onClose: () => void;
   autoCollect?: boolean; // If true, cards are collected on reveal
   title?: string;
 }
 
 export const CardRevealDialog = ({ 
   cards, 
   open, 
   onClose,
   autoCollect = false,
   title = "Nouvelles cartes !"
 }: CardRevealDialogProps) => {
   const [currentCardIndex, setCurrentCardIndex] = useState(0);
   const [cardRevealed, setCardRevealed] = useState(false);
   const { user } = useAuth();
   const collectCard = useCollectCard();
 
   const handleRevealCard = async () => {
     if (!cardRevealed) {
       setCardRevealed(true);
       
       // Collect the card if autoCollect is enabled
       if (autoCollect && user && cards[currentCardIndex]) {
         try {
           await collectCard.mutateAsync({ userId: user.id, cardId: cards[currentCardIndex].id });
         } catch (error: any) {
           // Silently ignore duplicate collection errors
         }
       }
     }
   };
 
   const handleNextCard = () => {
     if (currentCardIndex < cards.length - 1) {
       setCurrentCardIndex(prev => prev + 1);
       setCardRevealed(false);
     } else {
       handleClose();
     }
   };
 
   const handleClose = () => {
     setCurrentCardIndex(0);
     setCardRevealed(false);
     onClose();
   };
 
   if (cards.length === 0) return null;
 
   return (
     <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
       <DialogContent className="max-w-sm bg-transparent border-none shadow-none p-0 flex flex-col items-center">
         {/* Close button */}
         <Button
           variant="ghost"
           size="icon"
           onClick={handleClose}
           className="absolute top-0 right-0 z-20 bg-card/80 rounded-full"
         >
           <X className="w-5 h-5" />
         </Button>
 
         {/* Title */}
         <h2 className="font-display text-xl text-primary mb-4 animate-fade-in">{title}</h2>
 
         {/* Card reveal */}
         <div className="relative mb-6">
           <div className="absolute -inset-8 bg-gradient-radial from-primary/20 via-transparent to-transparent blur-2xl" />
           
           {cards[currentCardIndex] && (
              <MysteryCard
                key={currentCardIndex}
                card={cards[currentCardIndex]}
                isRevealed={cardRevealed}
                onReveal={handleRevealCard}
                size="lg"
                isNew={true}
              />
           )}
         </div>
 
         {/* Progress indicator */}
         <div className="flex gap-2 mb-4">
           {cards.map((_, index) => (
             <div
               key={index}
               className={cn(
                 "w-3 h-3 rounded-full transition-all",
                 index < currentCardIndex
                   ? "bg-primary"
                   : index === currentCardIndex
                   ? "bg-primary/50 animate-pulse"
                   : "bg-muted"
               )}
             />
           ))}
         </div>
 
         <p className="text-muted-foreground text-sm">
           Carte {currentCardIndex + 1} / {cards.length}
         </p>
 
         {/* Next button - appears after card is revealed */}
         {cardRevealed && (
           <Button 
             variant="gold" 
             size="lg"
             onClick={handleNextCard}
             className="mt-4 gap-2 animate-fade-in"
           >
             {currentCardIndex < cards.length - 1 ? (
               <>
                 Carte suivante
                 <ChevronRight className="w-5 h-5" />
               </>
             ) : (
               'Terminer'
             )}
           </Button>
         )}
       </DialogContent>
     </Dialog>
   );
 };