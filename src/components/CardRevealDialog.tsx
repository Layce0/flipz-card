import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MysteryCard } from '@/components/MysteryCard';
import { ChevronLeft, X } from 'lucide-react';
import { GameCard } from '@/types/card';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useCollectCard } from '@/hooks/useCards';

interface CardRevealDialogProps {
  cards: GameCard[];
  open: boolean;
  onClose: () => void;
  autoCollect?: boolean;
  title?: string;
  ownedCardIds?: Set<string>;
}

export const CardRevealDialog = ({ 
  cards, 
  open, 
  onClose,
  autoCollect = false,
  title = "Nouvelles cartes !",
  ownedCardIds,
}: CardRevealDialogProps) => {
   const [currentCardIndex, setCurrentCardIndex] = useState(0);
   const [cardRevealed, setCardRevealed] = useState(false);
   const [slideDir, setSlideDir] = useState<'none' | 'left'>('none');
   const [dragX, setDragX] = useState(0);
   const [isDragging, setIsDragging] = useState(false);
   const { user } = useAuth();
   const collectCard = useCollectCard();

   const startXRef = useRef(0);
   const startYRef = useRef(0);
   const isSwipingRef = useRef(false);

   const handleClose = useCallback(() => {
     setCurrentCardIndex(0);
     setCardRevealed(false);
     setSlideDir('none');
     setDragX(0);
     onClose();
   }, [onClose]);

   const goNext = useCallback(() => {
     setSlideDir('left');
     setTimeout(() => {
       if (currentCardIndex < cards.length - 1) {
         setCurrentCardIndex(prev => prev + 1);
         setCardRevealed(false);
       } else {
         handleClose();
       }
       setSlideDir('none');
       setDragX(0);
     }, 250);
   }, [currentCardIndex, cards.length, handleClose]);

   const handleRevealCard = async () => {
     if (!cardRevealed) {
       setCardRevealed(true);
       if (autoCollect && user && cards[currentCardIndex]) {
         try {
           await collectCard.mutateAsync({ userId: user.id, cardId: cards[currentCardIndex].id });
         } catch (error: any) {
           // Silently ignore duplicate collection errors
         }
       }
     }
   };

   // Touch handlers
   const handleTouchStart = useCallback((e: React.TouchEvent) => {
     if (!cardRevealed) return;
     startXRef.current = e.touches[0].clientX;
     startYRef.current = e.touches[0].clientY;
     isSwipingRef.current = false;
     setIsDragging(true);
   }, [cardRevealed]);

   const handleTouchMove = useCallback((e: React.TouchEvent) => {
     if (!cardRevealed || !isDragging) return;
     const dx = e.touches[0].clientX - startXRef.current;
     const dy = e.touches[0].clientY - startYRef.current;
     const dist = Math.sqrt(dx * dx + dy * dy);
     if (!isSwipingRef.current && dist > 10) {
       isSwipingRef.current = true;
     }
     if (isSwipingRef.current) {
       setDragX(-Math.abs(dist));
     }
   }, [cardRevealed, isDragging]);

   const handleTouchEnd = useCallback(() => {
     if (!isDragging) return;
     setIsDragging(false);
     if (Math.abs(dragX) > 60) {
       goNext();
     } else {
       setDragX(0);
     }
   }, [isDragging, dragX, goNext]);

   // Mouse fallback
   const handleMouseDown = useCallback((e: React.MouseEvent) => {
     if (!cardRevealed) return;
     startXRef.current = e.clientX;
     isSwipingRef.current = false;
     setIsDragging(true);
   }, [cardRevealed]);

   const handleMouseMove = useCallback((e: React.MouseEvent) => {
     if (!cardRevealed || !isDragging) return;
     const dx = e.clientX - startXRef.current;
     if (!isSwipingRef.current && Math.abs(dx) > 10) {
       isSwipingRef.current = true;
     }
     if (isSwipingRef.current) {
       setDragX(-Math.abs(dx));
     }
   }, [cardRevealed, isDragging]);

   const handleMouseUp = useCallback(() => {
     if (!isDragging) return;
     setIsDragging(false);
     if (Math.abs(dragX) > 60) {
       goNext();
     } else {
       setDragX(0);
     }
   }, [isDragging, dragX, goNext]);

   if (cards.length === 0) return null;

   const translateX = slideDir === 'left' ? -300 : dragX;
   const opacity = slideDir === 'left' ? 0 : 1 - Math.min(Math.abs(dragX) / 300, 0.5);
   const isLast = currentCardIndex >= cards.length - 1;

   return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()} modal>
        <DialogContent 
          className="fixed inset-0 z-[60] max-w-none w-screen h-screen bg-background border-none shadow-none rounded-none p-0 flex flex-col items-center justify-center translate-x-0 translate-y-0 top-0 left-0 select-none data-[state=open]:slide-in-from-bottom-0"
          style={{ touchAction: 'pan-y' }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
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

         {/* Card reveal with swipe */}
         <div
           className="relative mb-6 cursor-grab active:cursor-grabbing"
           onTouchStart={handleTouchStart}
           onTouchMove={handleTouchMove}
           onTouchEnd={handleTouchEnd}
           onMouseDown={handleMouseDown}
         >
           <div className="absolute -inset-8 bg-gradient-radial from-primary/20 via-transparent to-transparent blur-2xl" />
           <div
             style={{
               transform: `translateX(${translateX}px) rotate(${translateX * 0.05}deg)`,
               opacity,
               transition: isDragging ? 'none' : 'transform 0.25s ease-out, opacity 0.25s ease-out',
             }}
           >
            {cards[currentCardIndex] && (
               <MysteryCard
                 key={currentCardIndex}
                 card={cards[currentCardIndex]}
                 isRevealed={cardRevealed}
                 onReveal={handleRevealCard}
                 size="lg"
                 isNew={(() => {
                   const cardId = cards[currentCardIndex].id;
                   if (ownedCardIds?.has(cardId)) return false;
                   const previouslyRevealed = cards.slice(0, currentCardIndex).some(c => c.id === cardId);
                   return !previouslyRevealed;
                 })()}
               />
            )}
           </div>
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

         {/* Swipe hint */}
         {cardRevealed && (
           <div className="mt-4 flex items-center gap-1 text-muted-foreground text-sm animate-fade-in">
             <ChevronLeft className="w-4 h-4 animate-[pulse_1.5s_ease-in-out_infinite]" />
             <span>{isLast ? 'Terminer' : 'Swipez pour continuer'}</span>
           </div>
         )}
       </DialogContent>
     </Dialog>
   );
};