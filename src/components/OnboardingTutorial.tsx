import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Globe, Gift, Loader2 } from 'lucide-react';
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

type InteractionType = 'none' | 'click-target' | 'flip-card' | 'open-welcome-pack';

interface SpotlightStep {
  selector: string;
  titleKey: string;
  descKey: string;
  position: 'top' | 'bottom';
  interaction: InteractionType;
  navigateTo?: string;
  onPage?: string;
}

const TOUR_STEPS: SpotlightStep[] = [
  { selector: '[data-tour="logo"]', titleKey: 'onboarding.step1Title', descKey: 'onboarding.step1Desc', position: 'bottom', interaction: 'none', onPage: '/' },
  { selector: '[data-tour="timer"]', titleKey: 'onboarding.step2Title', descKey: 'onboarding.step2Desc', position: 'bottom', interaction: 'none', onPage: '/' },
  { selector: '[data-tour="card"]', titleKey: 'onboarding.step3Title', descKey: 'onboarding.step3Desc', position: 'top', interaction: 'flip-card', onPage: '/' },
  { selector: '[data-tour="nav-packs"]', titleKey: 'onboarding.stepNavPacksTitle', descKey: 'onboarding.stepNavPacksDesc', position: 'top', interaction: 'click-target', navigateTo: '/packs' },
  { selector: '[data-tour="pack-booster"]', titleKey: 'onboarding.stepWelcomePackTitle', descKey: 'onboarding.stepWelcomePackDesc', position: 'top', interaction: 'open-welcome-pack', onPage: '/packs' },
  { selector: '[data-tour="nav-collection"]', titleKey: 'onboarding.step4Title', descKey: 'onboarding.step4Desc', position: 'top', interaction: 'click-target', navigateTo: '/collection' },
  { selector: '[data-tour="rarity-tab-common"]', titleKey: 'onboarding.rarityCommonTitle', descKey: 'onboarding.rarityCommonDesc', position: 'bottom', interaction: 'none', onPage: '/collection' },
  { selector: '[data-tour="rarity-tab-rare"]', titleKey: 'onboarding.rarityRareTitle', descKey: 'onboarding.rarityRareDesc', position: 'bottom', interaction: 'none', onPage: '/collection' },
  { selector: '[data-tour="rarity-tab-epic"]', titleKey: 'onboarding.rarityEpicTitle', descKey: 'onboarding.rarityEpicDesc', position: 'bottom', interaction: 'none', onPage: '/collection' },
  { selector: '[data-tour="rarity-tab-legendary"]', titleKey: 'onboarding.rarityLegendaryTitle', descKey: 'onboarding.rarityLegendaryDesc', position: 'bottom', interaction: 'none', onPage: '/collection' },
  { selector: '[data-tour="nav-shop"]', titleKey: 'onboarding.step6Title', descKey: 'onboarding.step6Desc', position: 'top', interaction: 'click-target', navigateTo: '/shop' },
  { selector: '[data-tour="trade-button"]', titleKey: 'onboarding.stepTradeTitle', descKey: 'onboarding.stepTradeDesc', position: 'bottom', interaction: 'none', onPage: '/shop' },
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
  const [claimingPack, setClaimingPack] = useState(false);

  useEffect(() => {
    if (!user) return;
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) {
      const timer = setTimeout(() => setPhase('lang'), 800);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // Allow replay via custom event (fired from Profile "Revoir le tutoriel")
  useEffect(() => {
    const handler = () => {
      localStorage.removeItem(ONBOARDING_KEY);
      setTourStep(0);
      setWaitingForInteraction(false);
      setMinimized(false);
      setPhase('lang');
    };
    window.addEventListener('flipz:replay-tutorial', handler);
    return () => window.removeEventListener('flipz:replay-tutorial', handler);
  }, []);

  const advanceStep = useCallback(() => {
    if (tourStep < TOUR_STEPS.length - 1) {
      setTourStep(tourStep + 1);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setPhase('finish');
    }
  }, [tourStep]);

  // Auto-advance click-target steps once we're on the right page
  useEffect(() => {
    if (phase !== 'tour' || !waitingForInteraction) return;
    const step = TOUR_STEPS[tourStep];
    if (step.interaction === 'click-target' && step.navigateTo && location.pathname === step.navigateTo) {
      setMinimized(true);
      const timer = setTimeout(() => {
        setMinimized(false);
        setWaitingForInteraction(false);
        advanceStep();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, phase, tourStep, waitingForInteraction, advanceStep]);

  // Listen for card flip during flip-card step
  useEffect(() => {
    if (phase !== 'tour' || !waitingForInteraction) return;
    const step = TOUR_STEPS[tourStep];
    if (step.interaction !== 'flip-card') return;

    let cancelled = false;
    const checkFlipped = () => {
      if (cancelled) return;
      const cardInner = document.querySelector('[data-tour="card"] .flip-card-inner');
      if (cardInner?.classList.contains('flipped')) {
        setWaitingForInteraction(false);
        setMinimized(true);
        setTimeout(() => {
          setMinimized(false);
          advanceStep();
        }, 2000);
        return;
      }
      requestAnimationFrame(checkFlipped);
    };
    const id = requestAnimationFrame(checkFlipped);
    return () => { cancelled = true; cancelAnimationFrame(id); };
  }, [phase, tourStep, waitingForInteraction, advanceStep]);

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
    } else {
      setTargetRect(null);
    }
    rafRef.current = requestAnimationFrame(measureTarget);
  }, [phase, tourStep]);

  useEffect(() => {
    if (phase === 'tour') {
      rafRef.current = requestAnimationFrame(measureTarget);
      return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }
  }, [phase, tourStep, measureTarget]);

  // When entering a new step, set up interaction mode and navigate if needed
  useEffect(() => {
    if (phase !== 'tour') return;
    const step = TOUR_STEPS[tourStep];
    // Ensure we're on the right page for onPage steps
    if (step.onPage && location.pathname !== step.onPage) {
      navigate(step.onPage);
    }
    setWaitingForInteraction(step.interaction !== 'none');
  }, [phase, tourStep]);

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('i18nextLng', code);
  };

  const handleLangNext = () => {
    if (location.pathname !== '/') navigate('/');
    setPhase('tour');
  };

  const handleFinish = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setPhase('finish');
  };

  const handleSkip = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setPhase('done');
  };

  const handleTourNext = () => {
    const step = TOUR_STEPS[tourStep];
    if (step.interaction !== 'none') return;
    advanceStep();
  };

  const handleOpenWelcomePack = async () => {
    if (claimingPack) return;
    setClaimingPack(true);
    try {
      const res = await claimMilestone.mutateAsync(undefined);
      if (res?.cards && res.cards.length > 0) {
        setRevealedCards(res.cards);
        setMinimized(true);
        setIsRevealing(true);
        toast.success(t('onboarding.packReceived', 'Pack de bienvenue reçu !'));
      } else {
        // No cards? just move on
        advanceStep();
      }
    } catch (e) {
      console.error(e);
      toast.error(t('onboarding.packError', 'Impossible de récupérer le pack, on continue'));
      advanceStep();
    } finally {
      setClaimingPack(false);
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
            <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
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

  // Finish screen (no more pack claim — already done during tour)
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
              onClick={() => {
                localStorage.setItem(ONBOARDING_KEY, 'true');
                setPhase('done');
              }}
            >
              {t('common.finish')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Pack reveal takes over during tour or finish
  if (isRevealing) {
    return (
      <PackRevealFlow
        cards={revealedCards}
        isOpen={isRevealing}
        onClose={() => {
          setIsRevealing(false);
          setMinimized(false);
          setRevealedCards([]);
          if (phase === 'tour') {
            advanceStep();
          } else {
            setPhase('done');
          }
        }}
        packType="standard"
      />
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

    if (minimized || !targetRect) {
      return <>{goldenBorder}<div className="fixed inset-0 z-[100] pointer-events-none" /></>;
    }
    const step = TOUR_STEPS[tourStep];
    const isLast = tourStep === TOUR_STEPS.length - 1;
    const isInteractive = step.interaction !== 'none';
    const allowClickThrough = isInteractive && waitingForInteraction && step.interaction !== 'open-welcome-pack';

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
        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: allowClickThrough ? 'none' : 'auto' }}>
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
            <div className="flex gap-1 mb-4">
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

            {step.interaction === 'open-welcome-pack' ? (
              <Button
                variant="gold"
                size="lg"
                className="w-full gap-2 font-bold"
                disabled={claimingPack}
                onClick={handleOpenWelcomePack}
              >
                {claimingPack ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {t('common.loading')}</>
                ) : (
                  <><Gift className="w-4 h-4" /> {t('onboarding.openWelcomePack', 'Ouvrir mon pack')}</>
                )}
              </Button>
            ) : (
              <>
                {isInteractive && waitingForInteraction && (
                  <p className="text-primary text-xs font-semibold mb-3 animate-pulse">
                    👆 {t('onboarding.interactHint')}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
                    {t('onboarding.skip')}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {tourStep + 1} / {TOUR_STEPS.length}
                  </span>
                  {isInteractive ? (
                    <span className="text-xs text-muted-foreground italic">
                      {t('onboarding.waitAction')}
                    </span>
                  ) : (
                    <Button variant={isLast ? 'gold' : 'default'} size="sm" onClick={handleTourNext}>
                      {isLast ? t('common.finish') : t('common.next')}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      </>
    );
  }

  return null;
};
