import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useClaimMilestone } from '@/hooks/useCards';
import { PackRevealFlow } from '@/components/shop/PackRevealFlow';
import { GameCard } from '@/types/card';
import { toast } from 'sonner';

const ONBOARDING_KEY = 'flipz_onboarding_done';

const LANGUAGES = [
  { code: 'fr', label: '🇫🇷 Français' },
  { code: 'en', label: '🇬🇧 English' },
  { code: 'es', label: '🇪🇸 Español' },
];

type InteractionType = 'none' | 'click-target' | 'flip-card';

interface SpotlightStep {
  selector: string;
  titleKey: string;
  descKey: string;
  position: 'top' | 'bottom';
  interaction: InteractionType;
  navigateTo?: string;
}

const TOUR_STEPS: SpotlightStep[] = [
  { selector: '[data-tour="logo"]', titleKey: 'onboarding.step1Title', descKey: 'onboarding.step1Desc', position: 'bottom', interaction: 'none' },
  { selector: '[data-tour="timer"]', titleKey: 'onboarding.step2Title', descKey: 'onboarding.step2Desc', position: 'bottom', interaction: 'none' },
  { selector: '[data-tour="card"]', titleKey: 'onboarding.step3Title', descKey: 'onboarding.step3Desc', position: 'top', interaction: 'flip-card' },
  { selector: '[data-tour="nav-collection"]', titleKey: 'onboarding.step4Title', descKey: 'onboarding.step4Desc', position: 'top', interaction: 'click-target', navigateTo: '/collection' },
  { selector: '[data-tour="nav-packs"]', titleKey: 'onboarding.step5Title', descKey: 'onboarding.step5Desc', position: 'top', interaction: 'click-target', navigateTo: '/packs' },
  { selector: '[data-tour="nav-shop"]', titleKey: 'onboarding.step6Title', descKey: 'onboarding.step6Desc', position: 'top', interaction: 'click-target', navigateTo: '/shop' },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const OnboardingTutorial = () => {
  const [phase, setPhase] = useState<'idle' | 'lang' | 'tour' | 'finish' | 'done'>('idle');
  const [tourStep, setTourStep] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [waitingForInteraction, setWaitingForInteraction] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const rafRef = useRef<number>();
  const { user } = useAuth();
  
  const claimMilestone = useClaimMilestone();
  const [revealedCards, setRevealedCards] = useState<GameCard[]>([]);
  const [isRevealing, setIsRevealing] = useState(false);

  useEffect(() => {
    if (!user) return; // Only start onboarding after login
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) {
      const timer = setTimeout(() => setPhase('lang'), 800);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // After navigating for a click-target step, auto-advance once we're on the right page
  useEffect(() => {
    if (phase !== 'tour' || !waitingForInteraction) return;
    const step = TOUR_STEPS[tourStep];
    if (step.interaction === 'click-target' && step.navigateTo && location.pathname === step.navigateTo) {
      setMinimized(true);
      const timer = setTimeout(() => {
        setMinimized(false);
        setWaitingForInteraction(false);
        if (tourStep < TOUR_STEPS.length - 1) {
          setTourStep(tourStep + 1);
        } else {
          handleFinish();
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, phase, tourStep, waitingForInteraction]);

  // Listen for card flip during flip-card step
  useEffect(() => {
    if (phase !== 'tour' || !waitingForInteraction) return;
    const step = TOUR_STEPS[tourStep];
    if (step.interaction !== 'flip-card') return;

    const checkFlipped = () => {
      const cardInner = document.querySelector('[data-tour="card"] .flip-card-inner');
      if (cardInner?.classList.contains('flipped')) {
        setWaitingForInteraction(false);
        setMinimized(true);
        setTimeout(() => {
          setMinimized(false);
          if (tourStep < TOUR_STEPS.length - 1) {
            setTourStep(tourStep + 1);
          } else {
            handleFinish();
          }
        }, 2000);
        return;
      }
      requestAnimationFrame(checkFlipped);
    };
    const id = requestAnimationFrame(checkFlipped);
    return () => cancelAnimationFrame(id);
  }, [phase, tourStep, waitingForInteraction]);

  const measureTarget = useCallback(() => {
    if (phase !== 'tour') return;
    const step = TOUR_STEPS[tourStep];
    const el = document.querySelector(step.selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      const padding = 8;
      setTargetRect({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });
    }
    rafRef.current = requestAnimationFrame(measureTarget);
  }, [phase, tourStep]);

  useEffect(() => {
    if (phase === 'tour') {
      rafRef.current = requestAnimationFrame(measureTarget);
      return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }
  }, [phase, tourStep, measureTarget]);

  // When entering a new step, set up interaction mode
  useEffect(() => {
    if (phase !== 'tour') return;
    const step = TOUR_STEPS[tourStep];
    if (step.interaction !== 'none') {
      setWaitingForInteraction(true);
    } else {
      setWaitingForInteraction(false);
    }
  }, [phase, tourStep]);

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('i18nextLng', code);
  };

  const handleLangNext = () => {
    // Navigate to home for the tour
    if (location.pathname !== '/') navigate('/');
    setPhase('tour');
  };

  const handleFinish = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPhase('finish');
  };

  const handleTourNext = () => {
    const step = TOUR_STEPS[tourStep];
    // For interactive steps, don't allow manual next
    if (step.interaction !== 'none' && !waitingForInteraction) {
      // Already completed interaction, this shouldn't happen
    }
    if (step.interaction !== 'none') return; // must interact

    if (tourStep < TOUR_STEPS.length - 1) {
      setTourStep(tourStep + 1);
    } else {
      handleFinish();
    }
  };

  const handleTourPrev = () => {
    if (tourStep > 0) {
      // Navigate back to home if needed
      if (location.pathname !== '/') navigate('/');
      setTimeout(() => setTourStep(tourStep - 1), 100);
    }
  };

  const handleClickOverlay = () => {
    const step = TOUR_STEPS[tourStep];
    if (step.interaction === 'click-target' && step.navigateTo) {
      // Let the user click the target element - don't block
    }
  };

  // Language dialog
  if (phase === 'lang') {
    return (
      <Dialog open onOpenChange={() => {}}>
        <DialogContent className="max-w-sm rounded-2xl border-primary/30 bg-card p-0 overflow-hidden [&>button]:hidden">
          <div className="flex flex-col items-center text-center px-6 py-8 gap-4">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Globe className="w-12 h-12 text-primary" />
            </div>
            <h2 className="text-xl font-display font-bold text-foreground">
              {t('onboarding.langTitle')}
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t('onboarding.langDesc')}
            </p>
            <div className="flex flex-col gap-2 w-full mt-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={cn(
                    "w-full py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200 border",
                    i18n.language?.startsWith(lang.code)
                      ? "bg-primary/15 border-primary text-foreground"
                      : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between px-6 pb-6">
            <Button variant="ghost" size="sm" onClick={handleFinish} className="text-muted-foreground">
              {t('onboarding.skip')}
            </Button>
            <Button variant="default" size="sm" onClick={handleLangNext}>
              {t('common.next')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Finish screen
  if (phase === 'finish' && !isRevealing) {
    return (
      <Dialog open onOpenChange={() => {}}>
        <DialogContent className="max-w-sm rounded-2xl border-primary/30 bg-card p-0 overflow-hidden [&>button]:hidden">
          <div className="flex flex-col items-center text-center px-6 py-10 gap-4">
            <div className="text-6xl mb-2">🎉</div>
            <h2 className="text-2xl font-display font-bold text-foreground">
              {t('onboarding.finishTitle')}
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t('onboarding.finishDesc')}
            </p>
            <div className="mt-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <p className="text-xs text-muted-foreground">
                💡 {t('onboarding.codeHint')} <span className="font-mono font-bold text-primary">debut</span>
              </p>
            </div>
            <Button
              variant="gold"
              size="lg"
              className="mt-4 w-full text-base font-bold"
              disabled={claimMilestone.isPending}
              onClick={async () => {
                try {
                  const res = await claimMilestone.mutateAsync(undefined);
                  // Mark onboarding done BEFORE showing the reveal,
                  // so that if the user closes midway it's still marked.
                  localStorage.setItem(ONBOARDING_KEY, 'true');
                  if (res?.cards && res.cards.length > 0) {
                    setRevealedCards(res.cards);
                    setIsRevealing(true);
                  } else {
                    // No cards returned: just finish directly
                    setPhase('done');
                  }
                  toast.success('Pack de bienvenue récupéré !');
                } catch (e) {
                  console.error(e);
                  // Even on error, let the user proceed
                  localStorage.setItem(ONBOARDING_KEY, 'true');
                  setPhase('done');
                }
              }}
            >
              {claimMilestone.isPending ? 'Récupération...' : t('onboarding.start')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Interactive spotlight tour
  if (phase === 'tour' && (targetRect || minimized)) {
    const goldenBorder = (
      <div className="fixed inset-0 z-[101] pointer-events-none">
        <div className="absolute inset-0 border-[3px] border-primary/60 rounded-none shadow-[inset_0_0_30px_hsl(45_90%_55%_/_0.15),0_0_30px_hsl(45_90%_55%_/_0.1)]" />
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b from-transparent via-primary/50 to-transparent" />
        <div className="absolute top-0 bottom-0 right-0 w-1 bg-gradient-to-b from-transparent via-primary/50 to-transparent" />
      </div>
    );

    if (minimized) {
      return <>{goldenBorder}<div className="fixed inset-0 z-[100] pointer-events-none" /></>;
    }
    const step = TOUR_STEPS[tourStep];
    const isLast = tourStep === TOUR_STEPS.length - 1;
    const isInteractive = step.interaction !== 'none';
    const allowClickThrough = isInteractive && waitingForInteraction;

    // Tooltip position
    const tooltipStyle: React.CSSProperties = {};
    if (step.position === 'bottom') {
      tooltipStyle.top = targetRect.top + targetRect.height + 16;
      tooltipStyle.left = '50%';
      tooltipStyle.transform = 'translateX(-50%)';
    } else {
      tooltipStyle.bottom = window.innerHeight - targetRect.top + 16;
      tooltipStyle.left = '50%';
      tooltipStyle.transform = 'translateX(-50%)';
    }

    return (
      <>
      {goldenBorder}
      <div className={cn("fixed inset-0 z-[100]", allowClickThrough && "pointer-events-none")}>
        {/* Dark overlay with spotlight cutout */}
        <svg className="absolute inset-0 w-full h-full pointer-events-auto" style={{ pointerEvents: allowClickThrough ? 'none' : 'auto' }}>
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx="12"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0" y="0"
            width="100%" height="100%"
            fill="rgba(0,0,0,0.45)"
            mask="url(#spotlight-mask)"
          />
        </svg>

        {/* Spotlight ring */}
        <div
          className={cn(
            "absolute rounded-xl border-2 border-primary shadow-[0_0_20px_hsl(45_90%_55%_/_0.4)] pointer-events-none transition-all duration-500 ease-out",
            allowClickThrough && "animate-pulse"
          )}
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
          }}
        />

        {/* Floating label on card for flip step */}
        {step.interaction === 'flip-card' && waitingForInteraction && targetRect && (
          <div
            className="absolute pointer-events-none z-10 flex flex-col items-center animate-bounce"
            style={{
              top: targetRect.top + targetRect.height / 2 - 16,
              left: targetRect.left + targetRect.width / 2,
              transform: 'translateX(-50%)',
            }}
          >
            <span className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-lg whitespace-nowrap">
              👆 {t('onboarding.flipHint')}
            </span>
          </div>
        )}

        {/* Tooltip */}
        <div
          className="absolute w-[85vw] max-w-xs animate-fade-in pointer-events-auto"
          style={tooltipStyle}
        >
          <div className="bg-card border border-primary/30 rounded-2xl p-5 shadow-[0_0_30px_hsl(45_90%_55%_/_0.15)]">
            {/* Progress dots */}
            <div className="flex gap-1.5 mb-4">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors duration-300",
                    i <= tourStep ? 'bg-primary' : 'bg-muted'
                  )}
                />
              ))}
            </div>

            <h3 className="text-base font-display font-bold text-foreground mb-1">
              {t(step.titleKey)}
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              {t(step.descKey)}
            </p>

            {isInteractive && waitingForInteraction && (
              <p className="text-primary text-xs font-semibold mb-3 animate-pulse">
                👆 {t('onboarding.interactHint')}
              </p>
            )}

            <div className="flex items-center justify-between">
              {tourStep > 0 ? (
                <Button variant="ghost" size="sm" onClick={handleTourPrev}>
                  {t('common.previous')}
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={handleFinish} className="text-muted-foreground">
                  {t('onboarding.skip')}
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                {tourStep + 1} / {TOUR_STEPS.length}
              </span>
              {isInteractive ? (
                <span className="text-xs text-muted-foreground italic">
                  {t('onboarding.waitAction')}
                </span>
              ) : (
                <Button variant={isLast ? 'gold' : 'default'} size="sm" onClick={handleTourNext}>
                  {isLast ? t('onboarding.start') : t('common.next')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      </>
    );
  }

  // When the user is in 'finish' phase with an active reveal, show the reveal instead of the dialog
  if (isRevealing) {
    return (
      <PackRevealFlow
        cards={revealedCards}
        isOpen={isRevealing}
        onClose={() => {
          setIsRevealing(false);
          setPhase('done');
        }}
        packType="lucky"
      />
    );
  }

  return null;
};
